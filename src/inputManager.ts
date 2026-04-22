import * as midi from "./midi";
function arrEq<T>(a: ArrayLike<T> | null, b: ArrayLike<T> | null) {
    // Check for null or undefined values if not the same reference
    if (a == null || b == null) return false;

    // Check if both operands are the exact same object reference
    if (a === b) return true;
    // Check if they have the same length
    if (a.length !== b.length) return false;

    // Compare each element in the arrays
    for (let i = 0; i < a.length && i < 2; i++) {
        // TODO Fix: i < 2 for demo
        if (a[i] !== b[i]) return false;
    }

    return true;
}

type BindState = 'unbound' | 'waiting' | 'bound';
export type MidiCallback = (event: MIDIMessageEvent) => void;

export class BindSelectController {
    private state: BindState = 'unbound';
    private boundData: Uint8Array | undefined = undefined;
    private static waitingController: BindSelectController | null = null; //move to module scope
    private button: HTMLButtonElement;
    private select: HTMLSelectElement;

    constructor(
        button: HTMLButtonElement,
        select: HTMLSelectElement
    ) {
        this.button = button;
        this.select = select;
        this.init();
    }

    private init(): void {
        this.button.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent immediate document click trigger
            this.handleButtonClick();
        });

        // Global listeners for binding logic
        midi.addMidiEventListener((e) => this.handleMidiInput(e));
        window.addEventListener('click', () => this.cancelWaiting());
    }

    private handleButtonClick(): void {
        if (this.state === 'waiting') {
            this.cancelWaiting();
        } else {
            // Cancel any other button currently waiting
            if (BindSelectController.waitingController) {
                BindSelectController.waitingController.cancelWaiting();
            }
            this.setWaiting();
        }
    }

    private setWaiting(): void {
        this.state = 'waiting';
        BindSelectController.waitingController = this;
        this.updateUI("Press any key...");
    }

    private cancelWaiting(): void {
        if (this.state !== 'waiting') return;

        this.state = this.boundData ? 'bound' : 'unbound';
        BindSelectController.waitingController = null;
        if (this.boundData) this.updateUI("Bound")
        else this.updateUI("Bind");
    }

    private handleMidiInput(event: MIDIMessageEvent) {
        console.log('yolo')
        if (this.state === 'waiting') {
            event.preventDefault();
            this.bindKey(event.data!);
        } else if (this.state === 'bound' && arrEq(event.data, this.boundData!)) {
            if (event.data![2] === 0x1)
                this.rotateSelect(false)
            else if (event.data![2] === 0x41) this.rotateSelect(true)
            else this.rotateSelect()
        }
    }

    private bindKey(data: Uint8Array): void {
        this.boundData = data;
        this.state = 'bound';
        BindSelectController.waitingController = null;
        this.updateUI("Bound");
    }

    private rotateSelect(clockwise: boolean = false): void {
        const options = this.select.options;
        const len = options.length;
        if (len === 0) return;

        const inc = clockwise ? -1 : 1;

        const currentIndex = this.select.selectedIndex;
        const nextIndex = (currentIndex + inc + len) % len;
        this.select.selectedIndex = nextIndex;

        // Trigger 'change' event manually if needed by other scripts
        this.select.dispatchEvent(new Event('change'));
    }

    private updateUI(text: string): void {
        this.button.textContent = text;
        this.button.dataset.state = this.state;
    }
}

// An interface helps if you want BindSelectController and BindCallbackController 
// to be able to cancel each other's 'waiting' states globally.
export interface IMidiBindController {
    cancelWaiting(): void;
}

export class BindCallbackController implements IMidiBindController {
    private state: BindState = 'unbound';
    private boundSignature: Uint8Array | undefined = undefined;

    // Updated to use the interface so it plays nicely with your other classes
    public static waitingController: IMidiBindController | null = null;

    private button: HTMLButtonElement;
    private callback: MidiCallback;

    constructor(
        button: HTMLButtonElement,
        callback: MidiCallback
    ) {
        this.button = button;
        this.callback = callback;
        this.init();
    }

    private init(): void {
        this.button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleButtonClick();
        });

        // Global listeners
        midi.addMidiEventListener((e) => this.handleMidiInput(e));
        window.addEventListener('click', () => this.cancelWaiting());
    }

    private handleButtonClick(): void {
        console.log('button clicked')
        if (this.state === 'waiting') {
            this.cancelWaiting();
        } else {
            // Cancel any other controller (Select or Callback) currently waiting
            if (BindCallbackController.waitingController) {
                BindCallbackController.waitingController.cancelWaiting();
            }
            this.setWaiting();
        }
    }

    private setWaiting(): void {
        this.state = 'waiting';
        BindCallbackController.waitingController = this;
        this.updateUI("Press any key...");
    }

    public cancelWaiting(): void {
        if (this.state !== 'waiting') return;

        this.state = this.boundSignature ? 'bound' : 'unbound';
        if (BindCallbackController.waitingController === this) {
            BindCallbackController.waitingController = null;
        }
        this.updateUI(this.boundSignature ? "Bound" : "Bind");
    }

    private handleMidiInput(event: MIDIMessageEvent) {
        const data = event.data;
        if (!data) return;

        if (this.state === 'waiting') {
            event.preventDefault();
            this.bindKey(data);
        } else if (this.state === 'bound' && this.isMatch(data)) {
            // Pass the entire event to the callback
            this.callback(event);
        }
    }

    private bindKey(data: Uint8Array): void {
        // We only save the first 2 bytes (Status and Note/CC Number).
        // We ignore the 3rd byte (Velocity/Value) for the signature.
        this.boundSignature = new Uint8Array([data[0], data[1]]);

        this.state = 'bound';
        BindCallbackController.waitingController = null;
        this.updateUI("Bound");
    }

    private isMatch(incomingData: Uint8Array): boolean {
        if (!this.boundSignature || incomingData.length < 2) return false;

        // Match ONLY the Command/Channel (byte 0) and the Note/CC ID (byte 1)
        return incomingData[0] === this.boundSignature[0] &&
            incomingData[1] === this.boundSignature[1];
    }

    private updateUI(text: string): void {
        this.button.textContent = text;
        this.button.dataset.state = this.state;
    }
}
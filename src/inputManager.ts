import { addMidiEventListener } from "./midi";
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

export class BindController {
    private state: BindState = 'unbound';
    private boundData: Uint8Array | undefined = undefined;
    private static waitingController: BindController | null = null;
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
        addMidiEventListener((e) => this.handleMidiInput(e));
        window.addEventListener('click', () => this.cancelWaiting());
    }

    private handleButtonClick(): void {
        if (this.state === 'waiting') {
            this.cancelWaiting();
        } else {
            // Cancel any other button currently waiting
            if (BindController.waitingController) {
                BindController.waitingController.cancelWaiting();
            }
            this.setWaiting();
        }
    }

    private setWaiting(): void {
        this.state = 'waiting';
        BindController.waitingController = this;
        this.updateUI("Press any key...");
    }

    private cancelWaiting(): void {
        if (this.state !== 'waiting') return;

        this.state = this.boundData ? 'bound' : 'unbound';
        BindController.waitingController = null;
        if (this.boundData) this.updateUI("Bounded")
        else this.updateUI("Click to Bind");
    }

    private handleMidiInput(event: MIDIMessageEvent) {
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
        BindController.waitingController = null;
        this.updateUI("Bounded");
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
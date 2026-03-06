let midiAccess: MIDIAccess;

export function init() {
    getPermission()
    navigator.requestMIDIAccess().then(handleAccessGranted, onMIDIFailure)
}

function handleAccessGranted(access: MIDIAccess) {
    midiAccess = access;
    console.log(midiAccess.inputs, midiAccess.outputs);
    midiAccess.onstatechange = (event) => {
        const port = event.port;
        const state = port?.state; // "connected" or "disconnected"
        const name = port?.name;
        const type = port?.type; // "input" or "output"

        console.log(`${type}: Port ${name} is now ${state}`);
        console.log(midiAccess.inputs, midiAccess.outputs)
    }
}

function getPermission() {
    navigator.permissions.query({ name: "midi" }).then((result) => {
        if (result.state === "granted") {
            // Access granted.
            console.log('Access granted')
        } else if (result.state === "prompt") {
            // Using API will prompt for permission
            console.log('Access will be prompted')
        }
        else {
            throw new Error('Midi Access denied')
        }
        // Permission was denied by user prompt or permission policy
    });
}

function onMIDIFailure(msg: string) {
    console.error(`Failed to get MIDI access - ${msg}`);
}

function listInputsAndOutputs() {
    for (const entry of midiAccess.inputs) {
        const input = entry[1];
        console.log(
            `Input port [type:'${input.type}']` +
            ` id:'${input.id}'` +
            ` manufacturer:'${input.manufacturer}'` +
            ` name:'${input.name}'` +
            ` version:'${input.version}'`,
        );
        break;
    }

    for (const entry of midiAccess.outputs) {
        const output = entry[1];
        console.log(
            `Output port [type:'${output.type}']` +
            `id:'${output.id}'` +
            `manufacturer:'${output.manufacturer}'` +
            `name:'${output.name}'` +
            `version:'${output.version}'`,
        );
        break;
    }
}

function startLoggingMIDIInput(callback: (event: MIDIMessageEvent) => void) {
    let first = true;
    // For some reason the device has 2 input port/channels.
    // So, we'll only listen to one of them.
    midiAccess.inputs.forEach((entry) => {
        if (first)
            console.log(entry)
        entry.onmidimessage = callback;
        first = false;
    });
}

export function addMidiEventListener(callback: (event: MIDIMessageEvent) => void) {
    let first = true;
    midiAccess.inputs.forEach((entry) => {
        if (first)
            entry.addEventListener('midimessage', callback);
        first = false;
    });
}
function getPermission() {
    navigator.permissions.query({ name: "midi", sysex: true }).then((result) => {
        if (result.state === "granted") {
            // Access granted.
            console.log('Access granted')
        } else if (result.state === "prompt") {
            // Using API will prompt for permission
            console.log('Access will be prompted')
        }
        else {
            console.log('Access denied')
        }
        // Permission was denied by user prompt or permission policy
    });
}

let ctx = null; // global MIDIAccess object (context)
function onMIDISuccess(midiAccess) {
    console.log("MIDI ready!");
    ctx = midiAccess; // store in the global (in real usage, would probably keep in an object instance)
}

function onMIDIFailure(msg) {
    console.error(`Failed to get MIDI access - ${msg}`);
}

function listInputsAndOutputs(midiAccess) {
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

function startLoggingMIDIInput(midiAccess, callback) {
    let first = false;
    // For some reason the device has 2 input port/channels.
    // So, we'll only listen to one of them.
    console.log(midiAccess.inputs)
    midiAccess.inputs.forEach((entry) => {
        if (!first)
            console.log(entry)
        entry.onmidimessage = callback;
        first = true;
    });
}


export { getPermission, onMIDISuccess, onMIDIFailure, listInputsAndOutputs, startLoggingMIDIInput, ctx };

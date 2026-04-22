import { initFileInput } from './fileHandler';
import { animate } from './render';
import * as midi from './midi'
import * as toast from './toast';

window.onerror = (msg) => {
    alert(`An error has occured: ${msg}`)
}

window.addEventListener('unhandledrejection', (event) => { alert(`An error has occured: ${event.reason}`) })

//midi
midi.init()

// Header
const inputEl: HTMLInputElement = document.getElementById("input-file") as HTMLInputElement;
inputEl.addEventListener('change', async () => {
    toast.newMessage('Loading file...')
    await initFileInput(inputEl)
    toast.closeToast()
}
)


// Rendering
const canvas: HTMLCanvasElement = document.getElementById('canvas') as HTMLCanvasElement;
animate(canvas)

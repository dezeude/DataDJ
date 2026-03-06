import { initFileInput, parseCSV } from './fileHandler';
import { animate } from './render';
import { setupHeader } from './header';
import * as midi from './midi'

window.onerror = (msg) => {
    alert(`An error has occured: ${msg}`)
}

window.addEventListener('unhandledrejection', (event) => { alert(`An error has occured: ${event.reason}`) })

//midi
midi.init()

// Header
initFileInput()
    .then((file) => parseCSV(file))
    .then((data: string[][]) => {
        setupHeader(data)
    })

// Rendering
const canvas: HTMLCanvasElement = document.getElementById('canvas') as HTMLCanvasElement;
animate(canvas)

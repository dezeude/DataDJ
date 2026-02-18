const toastElement: HTMLDivElement = document.getElementById('toast') as HTMLDivElement;
const defaultDelay = 2000; //2 seconds 
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

function hideToast() {
    toastElement.classList.add('hidden')
    toastTimeout = null
}

function showToast() {
    // if(toastElement.classList.contains('hidden')){
    //remove does nothing if param is not in classList
    toastElement.classList.remove('hidden')
    // }
}

function setText(text: string) {
    toastElement.textContent = text
}

function newMessage(msg: string, delay: number = defaultDelay) {
    if (toastTimeout) { // toast timer has already finished
        clearTimeout(toastTimeout)
    }

    setText(msg)
    showToast()

    toastTimeout = setTimeout(() => {
        hideToast()
    }, delay)
}

export { newMessage }
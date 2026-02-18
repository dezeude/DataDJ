import * as renderer from './render';
import * as toast from './toast';
import * as parser from './file';
import * as THREE from 'three'
import * as midi from './midi'
import { Lut } from 'three/addons/math/Lut.js';

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

function selectNextOption(selectEl: HTMLSelectElement, prev: boolean = false) {
    // console.log(selectEl.options, selectEl.selectedIndex)
    if (!selectEl || selectEl.options.length === 0) return;

    const len = selectEl.options.length;
    const inc = prev ? -1 : 1;

    // Increment the index, using modulo to wrap back to 0 at the end
    const nextIndex = (selectEl.selectedIndex + inc + len) % len

    selectEl.selectedIndex = nextIndex;

    // Manually trigger the 'change' event if other scripts are listening
    selectEl.dispatchEvent(new Event('change'));
}

function setupHeader(data: string[][]) {
    renderer.clearPoints()
    parser.parseData(data)

    const cols: string[] = data[0]

    renderer.initDrawData(data.length)

    const colorSelect = document.getElementById('color-select') as HTMLSelectElement
    colorSelect.addEventListener('change', () => {
        console.log("Changed")
        const colName = colorSelect.value
        if (colName === '' || !parser.parsedData.has(colName)) {
            // reset colors
            renderer.setAllPointColors(1, 1, 0)
            return
        }
        //Should not matter if column is a number column or not, use strColMap

        // Get max
        let max = -Infinity;
        const columnList = parser.parsedData.get(colName) as Float32Array
        for (let i = 0; i < columnList.length; i++) {
            const cellValNum = columnList[i]
            if (max < cellValNum) {
                max = cellValNum;
            }
        }

        const rowMask = new Float16Array(columnList.length)
        for (let i = 0; i < columnList.length; i++) {
            const cellValNum = columnList[i]
            const alpha = cellValNum / max
            rowMask[i] = alpha
        }

        // TODO: Allow user to choose colormap argument for Lut (currently rainbow)
        const colorMap = new Lut("rainbow", parser.uniques.get(colName))

        renderer.colorMapRows(rowMask, colorMap)
        toast.newMessage(`Coloring based off ${colName}`)
    })

    const selectElX = document.getElementById('select-xaxis') as HTMLSelectElement
    selectElX.addEventListener('change', () => {
        const colName = selectElX.value
        const colArr = parser.parsedData.get(colName) as Float32Array
        renderer.setXColumn(colArr)
    })

    const selectElY = document.getElementById('select-yaxis') as HTMLSelectElement
    selectElY.addEventListener('change', () => {
        const colName = selectElY.value
        const colArr = parser.parsedData.get(colName) as Float32Array
        renderer.setYColumn(colArr)
    })

    const selectControlColumnElement = document.getElementById('control-column') as HTMLSelectElement
    const selectControlValueElement = document.getElementById('control-value') as HTMLSelectElement
    // const invalidOptionEl = document.createElement('option') as HTMLOptionElement;
    // invalidOptionEl.value = invalidOptionEl.textContent = '';
    // selectControlValueElement.appendChild(invalidOptionEl);

    selectControlColumnElement.addEventListener('change', () => {
        const selectedColName = selectControlColumnElement.value
        // if (parser.colTypes.get(selectedColName) !== "string") {
        //     toast.newMessage(`${selectedColName} is not a string column`)
        //     selectControlValueElement.replaceChildren(); //clear child nodes
        //     return;
        // }
        const colMap = parser.strColMap.get(selectedColName)
        if (colMap === undefined) {
            throw new Error(`Column ${selectedColName} is not properly parsed (Col map is undefined).`)
        }
        selectControlValueElement.replaceChildren(); //clear child nodes
        colMap.forEach((_, colValue) => {
            const colValueElement = document.createElement("option") as HTMLOptionElement;
            colValueElement.value = colValue;
            colValueElement.textContent = colValue;
            selectControlValueElement.appendChild(colValueElement)
        })
        toast.newMessage(`${selectedColName}: ${selectControlValueElement.value}`)
    })

    selectControlValueElement.addEventListener('change', () => {
        const colName = selectControlColumnElement.value
        const selectedControlColValue = selectControlValueElement.value
        if (selectedControlColValue === '') return;
        const rowMask = new Uint8Array(data.length)
        const colIdx = parser.getColIndex(colName)
        console.log(colName)

        const isNum = !isNaN(parseFloat(data[1][colIdx]))
        // TODO: There is definitely a better and more efficient way to do all of this.
        // 1. Dont need to make a mask array, can just apply the transformation directly
        // 2. Probably Don't need to check if the value is a number or not, the reason I'm doing this is because
        // PapaParse is parsing numbers to an extra decimal point (e.g. 15 is "15.0")

        for (let i = 1; i < data.length; i++) {
            const cell = data[i][colIdx]
            if (isNum) {
                if (parseFloat(cell) === parseFloat(selectedControlColValue))
                    rowMask[i] = 1
            }
            else {
                if (data[i][colIdx] === selectedControlColValue)
                    rowMask[i] = 1
            }
            //else 0
        }
        renderer.showPoints(rowMask)
        toast.newMessage(`${colName}: ${selectControlValueElement.value}`)
    })

    {// TODO make a stack of listening objects for midi inputs
        const bindColBtn = document.getElementById('bind-column') as HTMLButtonElement;
        const bindValBtn = document.getElementById('bind-value') as HTMLButtonElement;

        bindColBtn.onclick = () => {
            bindColBtn.dataset.listening = "true"
            bindColBtn.textContent = "Waiting for Input"
        }
        bindValBtn.onclick = () => {
            bindValBtn.dataset.listening = "true"
            bindValBtn.textContent = "Waiting for Input"
        }
        let arrColBind: Uint8Array | null = null;
        let arrValBind: Uint8Array | null = null;
        midi.addMidiEventListener((event) => {
            // console.log(event.data)
            if (arrEq(event.data, arrColBind)) {
                if (event.data![2] === 0x1)
                    selectNextOption(selectControlColumnElement, false)
                else if (event.data![2] === 0x41) selectNextOption(selectControlColumnElement, true)
            }
            else if (arrEq(event.data, arrValBind)) {
                if (event.data![2] === 0x1)
                    selectNextOption(selectControlValueElement, false)
                else if (event.data![2] === 0x41)
                    selectNextOption(selectControlValueElement, true)
            }

            if (bindColBtn.dataset.listening === "true") {
                bindColBtn.dataset.listening = 'false'
                bindColBtn.textContent = 'Bind'
                arrColBind = event.data;
            }
            if (bindValBtn.dataset.listening === "true") {
                bindValBtn.dataset.listening = "false"
                bindValBtn.textContent = 'Bind'
                arrValBind = event.data;
            }
        })
    }

    cols.forEach((colName: string) => {
        const elX = document.createElement("option") as HTMLOptionElement;
        elX.value = colName;
        elX.textContent = colName;
        selectElX.appendChild(elX)

        const elY = document.createElement("option") as HTMLOptionElement;
        elY.value = colName;
        elY.textContent = colName;
        selectElY.appendChild(elY)

        const optionColElement = document.createElement("option") as HTMLOptionElement;
        optionColElement.value = colName;
        optionColElement.textContent = colName;
        selectControlColumnElement.appendChild(optionColElement)

        const optionColorEl = document.createElement("option") as HTMLOptionElement;
        optionColorEl.value = colName;
        optionColorEl.textContent = colName;
        colorSelect.appendChild(optionColorEl)
    })

    renderer.renderColumns()
    renderer.setAllPointColors(1, 1, 0)
}

export { setupHeader }
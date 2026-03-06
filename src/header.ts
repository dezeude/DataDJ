import * as renderer from './render';
import * as toast from './toast';
import * as parser from './file';
import * as midi from './midi'
import { Lut } from 'three/addons/math/Lut.js';
import { BindController } from './inputManager';

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

function createSelOption(parent: HTMLSelectElement, colName: string) {
    const el = document.createElement("option") as HTMLOptionElement;
    el.value = el.textContent = colName;
    parent.appendChild(el)
}
function setupHeader(data: string[][]) {
    renderer.clearPoints()
    parser.parseData(data)

    const cols: string[] = data[0]

    renderer.initDrawData(data.length)

    {// filter code

        const toggleBtn = document.getElementById('toggle-filters') as HTMLButtonElement;
        const dropdown = document.getElementById('filter-dropdown') as HTMLDivElement;
        const addFilterBtn = document.getElementById('add-filter-row') as HTMLButtonElement;
        const filterList = document.getElementById('filter-list') as HTMLDivElement;

        // Toggle Dropdown Visibility
        toggleBtn.addEventListener('click', () => {
            dropdown.classList.toggle('hidden');
        });

        // Close dropdown if clicking outside
        document.addEventListener('mousedown', (event) => {
            const isClickInside = dropdown.contains(event.target as Node) || toggleBtn.contains(event.target as Node);
            if (!isClickInside) {
                dropdown.classList.add('hidden');
            }
        });

        function applyFilters() {
            // Get the column names and values
            type Pair<T, K> = [T, K];
            let tuples: Pair<string, string>[] = []
            for (const filterRow of filterList.children) {
                const rowSel = filterRow.querySelector('.filter-field') as HTMLSelectElement
                const rowValSel = filterRow.querySelector('.filter-operator') as HTMLSelectElement
                //  const deleteBtn = filterRow.querySelector('.delete-btn') as HTMLButtonElement
                //  const bindBtn = filterRow.querySelector('.bind-btn') as HTMLButtonElement
                const colVal = rowSel.value
                const val = rowValSel.value
                tuples.push([colVal, val])
            }
            console.log(tuples)


            const rowMask = new Uint8Array(data.length)

            // // TODO: There is definitely a better and more efficient way to do all of this.
            // // 1. Dont need to make a mask array, can just apply the transformation directly
            // // 2. Probably Don't need to check if the value is a number or not, the reason I'm doing this is because
            // // PapaParse is parsing numbers to an extra decimal point (e.g. 15 is "15.0")

            for (let i = 1; i < data.length; i++) {
                let flag: boolean = true;
                for (let j = 0; j < tuples.length; j++) {

                    const colName = tuples[j][0]
                    const selectedColValue = tuples[j][1];
                    if (selectedColValue === '') return;

                    const colIdx = parser.getColIndex(colName)
                    const isNum = !isNaN(parseFloat(data[1][colIdx]))

                    const cell = data[i][colIdx]
                    if (isNum) {
                        // TODO: change this to range or float comparison (epsilon)
                        if (parseFloat(cell) !== parseFloat(selectedColValue))
                            flag = false;
                    }
                    else {
                        if (cell !== selectedColValue) {
                            flag = false;
                            break;
                        }
                    }
                }
                rowMask[i] = flag ? 1 : 0;
            }
            renderer.showPoints(rowMask)
        }

        // Function to create a new filter row
        function createFilterRow() {
            const row = document.createElement('div');
            row.className = 'filter-row';

            row.innerHTML = `
        <select class="filter-field">
        </select>
        <select class="filter-operator">
        </select>
        <button class="bind-btn">Bind</button>
        <button class="delete-btn">×</button>
        `;

            const rowSel = row.querySelector('.filter-field') as HTMLSelectElement
            const rowValSel = row.querySelector('.filter-operator') as HTMLSelectElement
            cols.forEach((colName) => createSelOption(rowSel, colName))
            const bindBtn = row.querySelector('.bind-btn') as HTMLButtonElement;

            new BindController(bindBtn, rowValSel);


            // Handle Bind logic
            rowSel.addEventListener('change', () => {
                const colName = rowSel.value
                const vals = parser.strColMap.get(colName)
                if (vals === undefined) {
                    throw new Error(`Column ${colName} is not properly parsed (Col map is undefined).`)
                }
                rowValSel.replaceChildren()
                vals!.forEach((_, val) => {
                    createSelOption(rowValSel, val as string)
                })
                toast.newMessage(`${colName}: ${rowValSel.value}`)
            })


            rowValSel.addEventListener('change', () => {
                // TODO: Make a function that is called whenever any 
                // of the filters changes and call it here
                const colName = rowSel.value
                toast.newMessage(`${colName}: ${rowValSel.value}`)
                applyFilters()
            });

            // Handle Delete logic
            row.querySelector('.delete-btn')?.addEventListener('click', () => {
                row.remove();
                applyFilters()
            });


            filterList.appendChild(row);
        }

        addFilterBtn.addEventListener('click', createFilterRow);

        const colorSelect = document.getElementById('color-select') as HTMLSelectElement
        colorSelect.addEventListener('change', () => {
            // console.log("Changed")
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


        cols.forEach((colName: string) => {
            createSelOption(selectElX, colName)
            createSelOption(selectElY, colName)
            createSelOption(colorSelect, colName)
        })

        renderer.renderColumns()
        renderer.setAllPointColors(1, 1, 0)
    }


}

export { setupHeader }
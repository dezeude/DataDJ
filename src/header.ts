import * as renderer from './render';
import * as toast from './toast';
import * as parser from './file';
import * as midi from './midi'
import { Lut } from 'three/addons/math/Lut.js';
import { BindSelectController, BindCallbackController, type MidiCallback } from './inputManager';
import { LineGeometry } from 'three/examples/jsm/Addons.js';

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

function rotateSelectOption(selectElement: HTMLSelectElement, clockwise: boolean) {
    if (!selectElement || selectElement.options.length <= 1) return;

    const totalOptions = selectElement.options.length;
    const currentIndex = selectElement.selectedIndex;

    // Calculate new index: if not clockwise, go backwards (+ total for positive modulus)
    let nextIndex = clockwise ? (currentIndex + 1) : (currentIndex - 1 + totalOptions);

    // Use modulo operator to loop around
    selectElement.selectedIndex = nextIndex % totalOptions;

    // Optional: Trigger change event so other code knows it changed
    selectElement.dispatchEvent(new Event('change'));
}

function initDropdowns() {
    // const dropdown = document.getElementById('filter-dropdown') as HTMLDivElement;
    document.querySelectorAll(".dropdown-container").forEach((container) => {
        const dropdown = container.querySelector(".dropdown") as HTMLDivElement
        const toggleBtn = container.querySelector('.main-btn') as HTMLButtonElement;
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
    })
}

function initSettingsDropdown() {
    const bindings: { text: string; key: string }[] = [
        { text: 'XMIN', key: 'xmin' },
        { text: 'XMAX', key: 'xmax' },
        { text: 'YMIN', key: 'ymin' },
        { text: 'YMAX', key: 'ymax' },
        { text: 'Point Size', key: 'size' },
        { text: 'Zoom', key: 'zoom' },
    ];
    const rows = document.querySelectorAll(".dropdown-container .container-row");
    rows.forEach((row, i) => {
        const bindBtn = row.querySelector('.bind-btn') as HTMLButtonElement;
        const { text, key } = bindings[i];
        bindBtn.textContent = 'Bind';
        let callback: (event: MIDIMessageEvent) => void;
        callback = () => {
            toast.newMessage("Error: input not assigned")
            throw new Error("Error: MIDI Input not assigned")
        }
        const speed = 1.0;

        // Cast to OrthographicCamera to access left/right/top/bottom properties
        // If parser.renderer.camera is globally accessible, use that.

        switch (key) {
            case "xmin":
                callback = (event) => {
                    const camera = renderer.camera;
                    const clockwise = event.data![2] === 0x1;
                    camera.left += clockwise ? speed : -speed;
                    camera.updateProjectionMatrix();
                    toast.newMessage(`${text} Changed`)
                }
                break;
            case "xmax":
                callback = (event) => {
                    const camera = renderer.camera;
                    const clockwise = event.data![2] === 0x1;
                    camera.right += clockwise ? speed : -speed;
                    camera.updateProjectionMatrix();
                    toast.newMessage(`${text} Changed`)
                }
                break;
            case "ymin":
                callback = (event) => {
                    const camera = renderer.camera;
                    const clockwise = event.data![2] === 0x1;
                    // In WebGL, standard Y grows upwards. 
                    // ymin typically corresponds to the bottom edge.
                    camera.bottom += clockwise ? speed : -speed;
                    camera.updateProjectionMatrix();
                    toast.newMessage(`${text} Changed`)
                }
                break;
            case "ymax":
                callback = (event) => {
                    const camera = renderer.camera;
                    const clockwise = event.data![2] === 0x1;
                    // ymax typically corresponds to the top edge.
                    camera.top += clockwise ? speed : -speed;
                    camera.updateProjectionMatrix();
                    toast.newMessage(`${text} Changed`)
                }
                break;

            case "size":
                callback = (event) => {
                    const camera = renderer.camera;
                    const clockwise = event.data![2] === 0x1;
                    // ymax typically corresponds to the top edge.
                    let nsize = renderer.pointsMaterial.size;

                    nsize = clockwise ? nsize + 1 : nsize - 1;
                    renderer.changePointSize(nsize)
                    toast.newMessage(`${text} Changed`)
                }
                break;

            case "zoom":
                callback = (event) => {
                    const camera = renderer.camera;
                    if (!camera) return;

                    const clockwise = event.data![2] === 0x1;
                    const zoomSpeed = 0.1; // Adjust this if the knob is too sensitive

                    // 2. Read the CURRENT zoom, not the material size
                    let currentZoom = camera.zoom;

                    // 3. Calculate new zoom (Clockwise = Zoom In, Counter-Clockwise = Zoom Out)
                    let newZoom = clockwise ? currentZoom + zoomSpeed : currentZoom - zoomSpeed;

                    // 4. CRITICAL: Never let zoom hit 0 or go negative, it will break the WebGL projection!
                    camera.zoom = Math.max(0.1, newZoom);

                    // 5. CRITICAL: Tell Three.js to apply the math
                    camera.updateProjectionMatrix();

                    toast.newMessage(`${text} Changed: ${camera.zoom.toFixed(1)}x`);
                }
                break;
        }

        new BindCallbackController(bindBtn, callback)
    })
}

function setupHeader(data: string[][]) {
    renderer.clearPoints()
    parser.parseData(data)

    const cols: string[] = data[0]

    renderer.initDrawData(data.length)

    {// filter code

        const addFilterBtn = document.getElementById('add-filter-row') as HTMLButtonElement;
        const filterList = document.getElementById('filter-list') as HTMLDivElement;
        initDropdowns()

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
        Col
        <select class="filter-field">
        </select>
        <!--Dependent:
        <select class="filter-dependents">
        </select> -->
        <select class="filter-operator">
        </select>
        <button class="bind-btn">Bind</button>
        <button class="delete-btn">×</button>
        `;
            // const dependentSel = row.querySelector('.filter-dependents') as HTMLSelectElement
            const rowSel = row.querySelector('.filter-field') as HTMLSelectElement
            const rowValSel = row.querySelector('.filter-operator') as HTMLSelectElement
            cols.forEach((colName) => {
                createSelOption(rowSel, colName)
                // createSelOption(dependentSel, colName)
            })
            const bindBtn = row.querySelector('.bind-btn') as HTMLButtonElement;

            new BindSelectController(bindBtn, rowValSel);

            // dependentSel.addEventListener('change', () => {
            //     const dependentName = dependentSel.value
            //     const colName = rowSel.value
            //     if (colName === '' || dependentName === '') {
            //         toast.newMessage("Dependent or Col Filter cannot be null")
            //         return;
            //     }
            //     parser.dependents.set(colName, dependentName)
            // })

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

        // Color Select
        const colorCycleBtn = document.getElementById('color-cycle') as HTMLButtonElement;
        const colorSelect = document.getElementById('color-select') as HTMLSelectElement

        const cycleCallback: MidiCallback = (event) => {
            const clockwise = event.data![2] === 0x1;
            rotateSelectOption(colorSelect, clockwise);
            toast.newMessage(`Coloring Changed to ${colorSelect.value}`)
        }

        new BindCallbackController(colorCycleBtn, cycleCallback);

        colorSelect.addEventListener('change', () => {
            const legend = document.querySelector('.legend') as HTMLDivElement;
            const colName = colorSelect.value
            if (colName === '' || !parser.parsedData.has(colName)) {
                // reset colors
                renderer.setAllPointColors(1, 1, 0)
                legend.classList.add('hidden')
                return
            }
            //If a discrete column put labels, if a continuous column, display colorbar
            if (parser.colTypes.get(colName) === 'continuous') {

                return
            }
            // Discrete
            // Get max
            let max = -Infinity;
            let min = Infinity;
            const columnList = parser.parsedData.get(colName) as Float32Array
            for (let i = 0; i < columnList.length; i++) {
                const cellValNum = columnList[i]
                if (max < cellValNum) {
                    max = cellValNum;
                }
                if (min > cellValNum) {
                    min = cellValNum;
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

            //Update legend
            legend.classList.remove('hidden');

            let numSteps = parser.uniques.get(colName)!;

            legend.innerHTML = `<div class="legend-title">${colName}</div>`;

            const isStringCol = parser.colTypes.get(colName) === 'discrete';

            for (let i = 0; i < numSteps; i++) {
                const alpha = i / (numSteps - 1);
                const value = (min + alpha * (max - min)).toFixed(2);  // Map back to real value
                const color = colorMap.getColor(alpha);
                const hex = `#${color.getHexString()}`;

                const label = isStringCol
                    ? parser.invertedStrMap.get(colName)?.get(i) ?? String(i)
                    : (min + alpha * (max - min)).toFixed(2);

                legend.innerHTML += `
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${hex};"></div>
                    <span class="legend-label">${label}</span>
                </div>
                `;
            }

        })
        // Axes
        const xAxisCycleBtn = document.getElementById('x-cycle') as HTMLButtonElement;
        const selectElX = document.getElementById('select-xaxis') as HTMLSelectElement
        selectElX.addEventListener('change', () => {
            const colName = selectElX.value
            const colArr = parser.parsedData.get(colName) as Float32Array
            renderer.setXColumn(colArr)
        })

        const xCycleCallback: MidiCallback = (event) => {
            const clockwise = event.data![2] === 0x1;
            rotateSelectOption(selectElX, clockwise);
            toast.newMessage(`X-Axis Changed to ${selectElX.value}`)
        }

        new BindCallbackController(xAxisCycleBtn, xCycleCallback);

        const yAxisCycleBtn = document.getElementById('y-cycle') as HTMLButtonElement;
        const selectElY = document.getElementById('select-yaxis') as HTMLSelectElement
        selectElY.addEventListener('change', () => {
            const colName = selectElY.value
            const colArr = parser.parsedData.get(colName) as Float32Array
            renderer.setYColumn(colArr)
        })

        const yCycleCallback: MidiCallback = (event) => {
            const clockwise = event.data![2] === 0x1;
            rotateSelectOption(selectElY, clockwise);
            toast.newMessage(`-Axis Changed to ${selectElY.value}`)
        }

        new BindCallbackController(yAxisCycleBtn, yCycleCallback);


        cols.forEach((colName: string) => {
            createSelOption(selectElX, colName)
            createSelOption(selectElY, colName)
            createSelOption(colorSelect, colName)
        })

        renderer.renderColumns()
        renderer.setAllPointColors(1, 1, 0)
    }

    initSettingsDropdown()


}

export { setupHeader }
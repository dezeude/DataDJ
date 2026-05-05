import * as renderer from './render';
import * as toast from './toast';
import * as parser from './file';
import { Lut } from 'three/addons/math/Lut.js';
import { BindSelectController, BindCallbackController, type MidiCallback } from './inputManager';
import * as d3 from 'd3';

const maxColorsOnScreen = 10;
// "a human can typically distinguish between 6 to 10 distinct colors" -Internet/Gemini
// function createColorMap(data: Float32Array, selector: string): (v: number) => string {
//     const min = d3.min(data) ?? 0;
//     const max = d3.max(data) ?? 1;

//     document.querySelector(selector)!.classList.remove('hidden')

//     // 1. Create the Sequential Scale
//     // Using interpolateTurbo to match the high-contrast rainbow in your image
//     const colorScale = d3.scaleSequential<string>()
//         .domain([min, max])
//         .interpolator(d3.interpolateTurbo)
//         .clamp(true);

//     // 2. Setup Dimensions for Legend
//     const width = 100;
//     const height = 300;
//     const margin = { top: 20, right: 50, bottom: 20, left: 10 };

//     const svg = d3.select(selector)
//         .append("svg")
//         .attr("width", width + margin.left + margin.right)
//         .attr("height", height + margin.top + margin.bottom)
//         .append("g")
//         .attr("transform", `translate(${margin.left},${margin.top})`);

//     // 3. Define the Gradient
//     const defs = svg.append("defs");
//     const linearGradient = defs.append("linearGradient")
//         .attr("id", "legend-gradient")
//         .attr("x1", "0%").attr("y1", "100%") // Bottom (min)
//         .attr("x2", "0%").attr("y2", "0%");   // Top (max)

//     // Add color stops (every 10% for a smooth transition)
//     const stops = 10;
//     d3.range(stops).forEach(i => {
//         const offset = i / (stops - 1);
//         linearGradient.append("stop")
//             .attr("offset", `${offset * 100}%`)
//             .attr("stop-color", colorScale(min + (max - min) * offset));
//     });

//     // 4. Draw the Legend Rectangle
//     svg.append("rect")
//         .attr("width", 20)
//         .attr("height", height)
//         .style("fill", "url(#legend-gradient)");

//     // 5. Add the Axis
//     const axisScale = d3.scaleLinear()
//         .domain([min, max])
//         .range([height, 0]);

//     const axis = d3.axisRight(axisScale)
//         .ticks(5)
//         .tickFormat(d3.format(".2f"));

//     svg.append("g")
//         .attr("transform", `translate(20, 0)`)
//         .call(axis);

//     return colorScale;
// }

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
        { text: 'Alpha', key: 'alpha' },
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
                    renderer.moveCameraLeft(clockwise ? speed : -speed)
                    camera.updateProjectionMatrix();
                    toast.newMessage(`${text} Changed`)
                }
                break;
            case "xmax":
                callback = (event) => {
                    const camera = renderer.camera;
                    const clockwise = event.data![2] === 0x1;
                    renderer.moveCameraRight(clockwise ? speed : -speed);
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
                    renderer.moveCameraDown(clockwise ? speed : -speed);
                    camera.updateProjectionMatrix();
                    toast.newMessage(`${text} Changed`)
                }
                break;
            case "ymax":
                callback = (event) => {
                    const camera = renderer.camera;
                    const clockwise = event.data![2] === 0x1;
                    // ymax typically corresponds to the top edge.
                    renderer.moveCameraUp(clockwise ? speed : -speed);
                    camera.updateProjectionMatrix();
                    toast.newMessage(`${text} Changed`)
                }
                break;

            case "size":
                callback = (event) => {
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

            case "alpha":
                callback = (event) => {
                    const speed = 0.1; //Should let a knob control this
                    const clockwise = event.data![2] === 0x1;
                    const nAlpha = clockwise ? renderer.getPointsAlpha() + speed : renderer.getPointsAlpha() - speed;
                    renderer.changeTransparency(Math.max(speed, nAlpha));
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
    // TODO: use global data variable

    renderer.initDrawData(data.length)

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
    colorSelect.options.length = 0;
    const cycleCallback: MidiCallback = (event) => {
        const clockwise = event.data![2] === 0x1;
        rotateSelectOption(colorSelect, clockwise);
        toast.newMessage(`Coloring Changed to ${colorSelect.value}`)
    }

    new BindCallbackController(colorCycleBtn, cycleCallback);

    colorSelect.addEventListener('change', () => {
        const legend = document.querySelector('.legend') as HTMLDivElement;
        const legendTitle = legend.querySelector('.legend-title') as HTMLDivElement
        const legendContent = legend.querySelector('.legend-content') as HTMLDivElement
        const colName = colorSelect.value
        if (colName === '' || !parser.parsedData.has(colName)) {
            // reset colors
            renderer.setAllPointColors(1, 1, 0)
            legend.classList.add('hidden')
            return
        }
        toast.newMessage(`Coloring based off ${colName}`)
        legendTitle.innerHTML = colName;
        const columnList = parser.parsedData.get(colName) as Float32Array

        const [min, max] = d3.extent(columnList) as [number, number];

        const uniqueCount = parser.uniques.get(colName) as number

        const rowMask = new Float32Array(columnList.length)

        if (uniqueCount > maxColorsOnScreen) { //color continuously
            console.log(uniqueCount)
            // const legend = document.querySelector('.legend') as HTMLDivElement;
            legend.classList.remove('hidden')
            legend.classList.add('continuous')
            // createColorMap(columnList, selector);
            const colorScale = d3.scaleSequential(d3.interpolatePlasma).domain([min, max]);
            const getColorMap = () => {
                // The HTML preview for your UI
                const previewHtml = d3.ticks(min, max, 14)
                    .map(t => colorScale(t))
                    .map(color => `
                        <span style="
                            background: ${color}; 
                            height: 100%; 
                            flex: 1; 
                            display: inline-block;
                        ">&nbsp;</span>
                        `).join('');

                return {
                    scale: colorScale,
                    preview: previewHtml
                };
            };

            legendContent.innerHTML = getColorMap().preview;

            renderer.colorMapRowsContinuous(columnList, colorScale);
            return;
        } //end continuous
        legend.classList.remove('continuous')

        for (let i = 0; i < columnList.length; i++) {
            rowMask[i] = (columnList[i] - min) / (max - min)
        }

        // TODO: Allow user to choose colormap argument for Lut (currently rainbow)
        const colorMap = new Lut("rainbow", parser.uniques.get(colName))

        renderer.colorMapRowsDiscrete(rowMask, colorMap)

        //Update legend
        legend.classList.remove('hidden');

        let numSteps = parser.uniques.get(colName)!;

        const isDiscreteCol = parser.colTypes.get(colName) === 'string';
        legendContent.innerHTML = ''

        for (let i = 0; i < numSteps; i++) {
            const alpha = i / (numSteps - 1);
            // const value = (min + alpha * (max - min)).toFixed(2);  // Map back to real value
            const color = colorMap.getColor(alpha);
            const hex = `#${color.getHexString()}`;

            const label = isDiscreteCol
                ? parser.invertedStrMap.get(colName)?.get(i) ?? String(i)
                : (min + alpha * (max - min)).toFixed(2);

            legendContent.innerHTML += `
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
    selectElX.options.length = 0;
    selectElX.addEventListener('change', () => {
        const colName = selectElX.value
        if (colName === '' || !parser.parsedData.has(colName)) {
            // reset colors
            renderer.setAllPointColors(1, 1, 0)
            return
        }
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
    selectElY.options.length = 0;
    selectElY.addEventListener('change', () => {
        const colName = selectElY.value
        if (colName === '' || !parser.parsedData.has(colName)) {
            // reset colors
            renderer.setAllPointColors(1, 1, 0)
            return
        }
        const colArr = parser.parsedData.get(colName) as Float32Array
        renderer.setYColumn(colArr)
    })

    const yCycleCallback: MidiCallback = (event) => {
        const clockwise = event.data![2] === 0x1;
        rotateSelectOption(selectElY, clockwise);
        toast.newMessage(`Y-Axis Changed to ${selectElY.value}`)
    }

    new BindCallbackController(yAxisCycleBtn, yCycleCallback);
    // Z axis
    const zAxisCycleBtn = document.getElementById('z-cycle') as HTMLButtonElement;
    const selectElZ = document.getElementById('select-zaxis') as HTMLSelectElement;
    selectElZ.options.length = 0;
    selectElZ.addEventListener('change', () => {
        const colName = selectElZ.value
        if (colName === '' || !parser.parsedData.has(colName)) {
            // reset colors
            renderer.setAllPointColors(1, 1, 0)
            return
        }
        const colArr = parser.parsedData.get(colName) as Float32Array
        renderer.setZColumn(colArr)
    })

    const zCycleCallback: MidiCallback = (event) => {
        const clockwise = event.data![2] === 0x1;
        rotateSelectOption(selectElZ, clockwise);
        toast.newMessage(`Z-Axis Changed to ${selectElZ.value}`)
    }

    new BindCallbackController(zAxisCycleBtn, zCycleCallback);

    //Dimension switch
    const dimensionSelect = document.getElementById('dimension-switch') as HTMLSelectElement;
    dimensionSelect.addEventListener('change', () => {
        const newDim = dimensionSelect.value
        const zCon = document.getElementById('z-axis-container') as HTMLDivElement
        if (newDim === '3D') {
            zCon.classList.remove('hidden')
        }
        else if (newDim === '2D') {
            zCon.classList.add('hidden')
        }
        else return;
        renderer.changeDimension(newDim)
    })


    cols.forEach((colName: string) => {
        createSelOption(colorSelect, colName)
        createSelOption(selectElX, colName)
        createSelOption(selectElY, colName)
        createSelOption(selectElZ, colName)
    })

    renderer.renderColumns()
    renderer.setAllPointColors(1, 1, 0)


    initSettingsDropdown()


}

export { setupHeader }
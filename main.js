import * as THREE from "three";
import { csvParse } from "d3-dsv";
import * as midi from "./midi.js"

midi.getPermission()

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

let camera, points, material;
let xmin, xmax, ymin, ymax;
let columns, curZColumn = "5";

// Load CSV
document.getElementById("fileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target.result;
        const data = csvParse(text);
        renderData(data);
    };
    reader.readAsText(file);
});

let zDataMap = {}; // stores normalized z arrays for each column
let geometry, colors;
let dataGlobal = [];

// Called once when CSV loads
function renderData(data) {
    dataGlobal = data;
    columns = Object.keys(data[0]);
    const zColumns = columns.filter((c) => c.startsWith("z"));
    console.log("zColumns:", zColumns);

    const numPoints = data.length;
    const positions = new Float32Array(numPoints * 3);
    colors = new Float32Array(numPoints * 3);

    // --- Compute XY bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    data.forEach((row, i) => {
        const x = parseFloat(row.x);
        const y = parseFloat(row.y);
        positions.set([x, y, 0], i * 3);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    });

    // --- Preprocess and normalize all z columns
    zColumns.forEach((zCol) => {
        const zVals = data.map(r => parseFloat(r[zCol]));
        const minZ = Math.min(...zVals);
        const maxZ = Math.max(...zVals);
        const rangeZ = maxZ - minZ || 1;

        const normed = new Float32Array(zVals.length);
        for (let i = 0; i < zVals.length; i++) {
            normed[i] = (zVals[i] - minZ) / rangeZ;
        }
        zDataMap[zCol] = normed;
    });

    // --- Build geometry
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // Initial color mapping
    updatePointColors(`z${curZColumn}`);

    material = new THREE.PointsMaterial({
        size: 2,
        vertexColors: true,
    });

    if (points) scene.remove(points);
    points = new THREE.Points(geometry, material);
    scene.add(points);

    // Set up camera bounds
    xmin = minX - 10;
    xmax = maxX + 10;
    ymin = minY - 10;
    ymax = maxY + 10;
    camera = new THREE.OrthographicCamera(xmin, xmax, ymax, ymin, 0.1, 2000);
    camera.position.z = 10;

    animate();
}

function updatePointColors(zColName) {
    if (!geometry || !zDataMap[zColName]) return;

    const zNorms = zDataMap[zColName];
    const color = new THREE.Color();

    for (let i = 0; i < zNorms.length; i++) {
        const zNorm = zNorms[i];
        color.setHSL(0.7 - 0.7 * zNorm, 1.0, 0.5); // blue→red
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    geometry.attributes.color.needsUpdate = true; // 🚀
}



navigator.requestMIDIAccess().then((midiAccess) => {
    console.log(midiAccess)
    midi.listInputsAndOutputs(midiAccess);
    let delta = 1;
    midi.startLoggingMIDIInput(midiAccess, (event) => {
        if (!camera) return; // wait until data loads

        const step = 5;       // how much to move edges
        const sizeStep = 0.5; // how much to change point size


        // TODO: Use Hashmap for all control bindings.
        if (event.data[0] === 0xb0) {
            //turn knobs

            if (event.data[1] == 0x10) {
                //x-min
                if (event.data[2] === 0x41) {
                    //scrolling counter-clockwise
                    xmin -= step;
                } else if (event.data[2] === 0x1) {
                    //scrolling clockwise
                    xmin += step;
                }

            }
            else if (event.data[1] == 0x11) {
                //x-max
                if (event.data[2] === 0x41) {
                    //scrolling counter-clockwise
                    xmax -= step;
                } else if (event.data[2] === 0x1) {
                    //scrolling clockwise
                    xmax += step;
                }
            }

            else if (event.data[1] == 0x12) {
                //y-min
                if (event.data[2] === 0x41) {
                    //scrolling counter-clockwise
                    ymin -= step;
                } else if (event.data[2] === 0x1) {
                    //scrolling clockwise
                    ymin += step;
                }
            }
            else if (event.data[1] == 0x13) {
                //y-max
                if (event.data[2] === 0x41) {
                    //scrolling counter-clockwise
                    ymax -= step;
                } else if (event.data[2] === 0x1) {
                    //scrolling clockwise
                    ymax += step;
                }
            }
            else if (event.data[1] == 0x14) {
                //size of dots
                if (event.data[2] === 0x41) {
                    //scrolling counter-clockwise
                    material.size += sizeStep;
                } else if (event.data[2] === 0x1) {
                    //scrolling clockwise
                    material.size = Math.max(0.1, material.size - sizeStep);
                }
            }
        }
        else if (event.data[0] === 0xe7 && event.data[1] === 0x0) {
            curZColumn = event.data[2];
            console.log(`Cur Z Column: ${curZColumn}`);
            updatePointColors(`z${curZColumn}`);
        }
        // else if (event.data[0] === 0xe0 && event.data[1] === 0x0) {
        //     k = Math.floor(event.data[2] / 40);
        // }

        camera.left = xmin;
        camera.right = xmax;
        camera.top = ymax;
        camera.bottom = ymin;
        camera.updateProjectionMatrix();
    })
})

// Animate
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
    if (!camera) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.updateProjectionMatrix();
});
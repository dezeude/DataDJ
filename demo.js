import * as THREE from "three";
import { csvParse } from "d3-dsv";
import * as midi from "./midi.js";

midi.getPermission();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

let camera, points, material, geometry;
let xmin, xmax, ymin, ymax;
let currentAlgo = "UMAP";
let dataGlobal = [];

// Toast setup (reuse existing CSS)
let toast = document.getElementById("toast");
let toastTimer = null;

// Scatterplot functions that can be mapped
const scatterplotFunctions = {
    "xmin increase": () => (xmin += 5),
    "xmin decrease": () => (xmin -= 5),
    "xmax increase": () => (xmax += 5),
    "xmax decrease": () => (xmax -= 5),
    "ymin increase": () => (ymin += 5),
    "ymin decrease": () => (ymin -= 5),
    "ymax increase": () => (ymax += 5),
    "ymax decrease": () => (ymax -= 5),
    "size increase": () => (material.size += 0.5),
    "size decrease": () => (material.size = Math.max(0.1, material.size - 0.5)),
};

// Holds user-defined MIDI mappings
let midiMappings = {};
let waitingForMapping = null;

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2000);
}

// Load CSV when file selected
document.getElementById("fileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target.result;
        const data = csvParse(text);
        dataGlobal = data;
        renderAlgorithm(currentAlgo);
    };
    reader.readAsText(file);
});

// Handle Settings button
document.getElementById("settingsBtn").addEventListener("click", () => {
    const menu = document.createElement("div");
    menu.className = "settings-menu";

    Object.keys(scatterplotFunctions).forEach((func) => {
        const btn = document.createElement("button");
        btn.textContent = func;
        btn.onclick = () => {
            waitingForMapping = func;
            showToast(`Waiting for MIDI input to map "${func}"...`);
            document.body.removeChild(menu);
        };
        menu.appendChild(btn);
    });

    const cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    cancel.onclick = () => document.body.removeChild(menu);
    menu.appendChild(cancel);

    document.body.appendChild(menu);
});


function renderAlgorithm(algoName) {
    if (!dataGlobal.length) return;

    const xCol = `${algoName}_1`;
    const yCol = `${algoName}_2`;
    const zCol = "Z";

    const numPoints = dataGlobal.length;
    const positions = new Float32Array(numPoints * 3);
    const colors = new Float32Array(numPoints * 3);
    const color = new THREE.Color();

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    dataGlobal.forEach((row, i) => {
        const x = parseFloat(row[xCol]);
        const y = parseFloat(row[yCol]);
        const z = 0;

        positions.set([x, y, z], i * 3);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);

        const label = parseInt(row[zCol]);
        color.setHSL(label / 10, 1.0, 0.5);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    });

    // Geometry and Material
    if (!geometry) {
        geometry = new THREE.BufferGeometry();
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    if (points) scene.remove(points);

    material = new THREE.PointsMaterial({
        size: 2.2,
        vertexColors: true,
    });

    points = new THREE.Points(geometry, material);
    scene.add(points);

    // Camera bounds
    xmin = minX - 5;
    xmax = maxX + 5;
    ymin = minY - 5;
    ymax = maxY + 5;

    if (!camera) {
        camera = new THREE.OrthographicCamera(xmin, xmax, ymax, ymin, 0.1, 1000);
        camera.position.z = 10;
    } else {
        camera.left = xmin;
        camera.right = xmax;
        camera.top = ymax;
        camera.bottom = ymin;
        camera.updateProjectionMatrix();
    }

    showToast(`Rendering: ${algoName}`);
}

// Listen for MIDI inputs to change algorithm
navigator.requestMIDIAccess().then((midiAccess) => {
    midi.listInputsAndOutputs(midiAccess);

    midi.startLoggingMIDIInput(midiAccess, (event) => {
        if (!dataGlobal.length) return;

        // --- Handle user-defined MIDI mappings ---
        const midiKey = event.data.join("-");
        if (waitingForMapping) {
            midiMappings[midiKey] = waitingForMapping;
            showToast(`Mapped ${waitingForMapping} to [${midiKey}]`);
            waitingForMapping = null;
            return;
        }

        if (midiMappings[midiKey]) {
            scatterplotFunctions[midiMappings[midiKey]]();
            if (camera) {
                camera.left = xmin;
                camera.right = xmax;
                camera.top = ymax;
                camera.bottom = ymin;
                camera.updateProjectionMatrix();
            }
        }


        // Match the pattern: 0x90 g 0x7f
        if (event.data[0] === 0x90 && event.data[2] === 0x7f) {
            const g = event.data[1];
            let newAlgo = currentAlgo;

            switch (g) {
                case 0x10:
                    newAlgo = "UMAP";
                    break;
                case 0x08:
                    newAlgo = "TSNE";
                    break;
                case 0x00:
                    newAlgo = "PHATE";
                    break;
                case 0x18:
                    newAlgo = "PCA";
                    break;
            }

            if (newAlgo !== currentAlgo) {
                currentAlgo = newAlgo;
                console.log(`Switched to ${currentAlgo}`);
                renderAlgorithm(currentAlgo);
            }
        }
    });
});

// Animate
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
    if (!camera) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.updateProjectionMatrix();
});

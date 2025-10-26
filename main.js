import * as THREE from "three";
import { csvParse } from "d3-dsv";
import * as midi from "./midi.js";

midi.getPermission();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight - 50);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
let camera, points, material;
let xmin, xmax, ymin, ymax;
let columns, curZColumn = "5";

let zDataMap = {};
let geometry, colors;
let dataGlobal = [];

let toast = document.getElementById("toast");
let toastTimer = null;

// --- MIDI Mapping Logic ---
const midiBindings = {}; // { "status-data1-data2": "functionName" }
let waitingForMapping = null; // the function we're currently mapping

const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");

settingsBtn.addEventListener("click", () => {
    const isVisible = settingsPanel.style.display === "flex";
    settingsPanel.style.display = isVisible ? "none" : "flex";
});

settingsPanel.querySelectorAll("button[data-func]").forEach((btn) => {
    btn.onclick = () => {
        waitingForMapping = btn.dataset.func;
        btn.textContent = `Waiting for MIDI... 🎚️`;
    };
});

// --- CSV Loading ---
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

// --- Render Data ---
function renderData(data) {
    dataGlobal = data;
    columns = Object.keys(data[0]);
    const zColumns = columns.filter((c) => c.startsWith("z"));
    const numPoints = data.length;
    const positions = new Float32Array(numPoints * 3);
    colors = new Float32Array(numPoints * 3);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    data.forEach((row, i) => {
        const x = parseFloat(row.x);
        const y = parseFloat(row.y);
        positions.set([x, y, 0], i * 3);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    });

    // Normalize z columns
    zColumns.forEach((zCol) => {
        const zVals = data.map((r) => parseFloat(r[zCol]));
        const minZ = Math.min(...zVals);
        const maxZ = Math.max(...zVals);
        const rangeZ = maxZ - minZ || 1;
        const normed = new Float32Array(zVals.length);
        for (let i = 0; i < zVals.length; i++) {
            normed[i] = (zVals[i] - minZ) / rangeZ;
        }
        zDataMap[zCol] = normed;
    });

    geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    updatePointColors(`z${curZColumn}`);

    material = new THREE.PointsMaterial({
        size: 2,
        vertexColors: true,
    });

    if (points) scene.remove(points);
    points = new THREE.Points(geometry, material);
    scene.add(points);

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
        color.setHSL(0.7 - 0.7 * zNorm, 1.0, 0.5);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }
    geometry.attributes.color.needsUpdate = true;
}

// --- MIDI Handling ---
navigator.requestMIDIAccess().then((midiAccess) => {
    midi.listInputsAndOutputs(midiAccess);
    const step = 5;
    const sizeStep = 0.5;

    midi.startLoggingMIDIInput(midiAccess, (event) => {
        if (!camera) return;
        const id = `${event.data[0]}-${event.data[1]}-${event.data[2]}`;

        // Mapping mode
        if (waitingForMapping) {
            midiBindings[id] = waitingForMapping;
            console.log(`Mapped ${id} → ${waitingForMapping}`);
            const btn = settingsPanel.querySelector(`button[data-func='${waitingForMapping}']`);
            if (btn) btn.textContent = `${waitingForMapping} ✅`;
            waitingForMapping = null;
            return;
        }

        // --- Handle z-column change (hardcoded to MIDI 0xe7 0x0) ---
        if (event.data[0] === 0xe7 && event.data[1] === 0x0) {
            const newZ = event.data[2];
            if (curZColumn !== newZ) {
                curZColumn = newZ;
                console.log(`Cur Z Column: ${curZColumn}`);
                updatePointColors(`z${curZColumn}`);
                showToast(`Z Column: z${curZColumn}`);
            }
            return; // don't process as mapped control
        }

        // Execute mapped function
        const func = midiBindings[id];
        if (func) {
            switch (func) {
                case "xmin-inc": xmin += step; break;
                case "xmin-dec": xmin -= step; break;
                case "xmax-inc": xmax += step; break;
                case "xmax-dec": xmax -= step; break;
                case "ymin-inc": ymin += step; break;
                case "ymin-dec": ymin -= step; break;
                case "ymax-inc": ymax += step; break;
                case "ymax-dec": ymax -= step; break;
                case "size-inc": material.size += sizeStep; break;
                case "size-dec": material.size = Math.max(0.1, material.size - sizeStep); break;
            }

            camera.left = xmin;
            camera.right = xmax;
            camera.top = ymax;
            camera.bottom = ymin;
            camera.updateProjectionMatrix();
        }
    });
});

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
    if (!camera) return;
    renderer.setSize(window.innerWidth, window.innerHeight - 50);
    camera.updateProjectionMatrix();
});

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    // Reset timer if already visible
    if (toastTimer) clearTimeout(toastTimer);

    // Hide after 1.5 seconds of inactivity
    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 1500);
}

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
let geometry, colors;
let dataGlobal = [];

let dataByMethod = {};
let curMethod = "umap";
let curParamValue = 5; // default starting param
let toast = document.getElementById("toast");
let toastTimer = null;

// --- MIDI Mapping Logic ---
const midiBindings = {}; // { "status-data1-data2": "functionName" }
let waitingForMapping = null;

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

// --- Data Processing ---
let paramValuesByMethod = {};

function renderData(data) {
    // Separate by method
    dataByMethod = {};
    data.forEach(row => {
        const m = row.method;
        if (!dataByMethod[m]) dataByMethod[m] = [];
        dataByMethod[m].push(row);
    });

    // Store sorted param_value arrays for each method
    paramValuesByMethod = {};
    Object.keys(dataByMethod).forEach(m => {
        const vals = [...new Set(dataByMethod[m].map(d => parseFloat(d.param_value)))].sort((a, b) => a - b);
        paramValuesByMethod[m] = vals;
    });

    curMethod = "umap"; // start default
    curParamValue = paramValuesByMethod[curMethod][0]; // first valid param
    renderSubset();
}

// --- Render Subset (filtered by method + param) ---
function renderSubset() {
    if (!dataByMethod[curMethod]) {
        console.warn(`No data for method ${curMethod}`);
        return;
    }

    // Find nearest available param_value to curParamValue
    const subset = dataByMethod[curMethod].filter(
        (r) => Math.abs(parseFloat(r.param_value) - curParamValue) < 1e-6
    );

    if (subset.length === 0) {
        console.warn(`No subset for ${curMethod} param=${curParamValue}`);
        return;
    }

    const numPoints = subset.length;
    const positions = new Float32Array(numPoints * 3);
    const colors = new Float32Array(numPoints * 3);
    let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;

    subset.forEach((row, i) => {
        const x = parseFloat(row.dim1);
        const y = parseFloat(row.dim2);
        positions.set([x, y, 0], i * 3);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);

        // Color by label (optional, gives variety)
        const label = parseInt(row.label) || 0;
        const color = new THREE.Color().setHSL((label % 10) / 10, 1.0, 0.5);
        colors.set([color.r, color.g, color.b], i * 3);
    });

    geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    if (!material)
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

    if (!camera) {
        camera = new THREE.OrthographicCamera(xmin, xmax, ymax, ymin, 0.1, 2000);
        camera.position.z = 10;
        animate();
    } else {
        camera.left = xmin;
        camera.right = xmax;
        camera.top = ymax;
        camera.bottom = ymin;
        camera.updateProjectionMatrix();
    }
}

// --- MIDI Handling ---
navigator.requestMIDIAccess().then((midiAccess) => {
    midi.listInputsAndOutputs(midiAccess);
    const step = 5;
    const sizeStep = 0.5;

    midi.startLoggingMIDIInput(midiAccess, (event) => {
        if (!camera) return;
        const id = `${event.data[0]}-${event.data[1]}-${event.data[2]}`;

        // --- Mapping Mode ---
        if (waitingForMapping) {
            midiBindings[id] = waitingForMapping;
            console.log(`Mapped ${id} → ${waitingForMapping}`);
            const btn = settingsPanel.querySelector(
                `button[data-func='${waitingForMapping}']`
            );
            if (btn) btn.textContent = `${waitingForMapping} ✅`;
            waitingForMapping = null;
            return;
        }

        // --- Parameter Control (mapped MIDI) ---
        const func = midiBindings[id];
        if (func === "param-control") {
            const vals = paramValuesByMethod[curMethod];
            if (!vals || vals.length === 0) return;

            let curIndex = vals.indexOf(curParamValue);
            if (curIndex === -1) curIndex = 0;

            const direction = event.data[2] === 0x41 ? -1 : 1; // knob direction
            curIndex = Math.min(vals.length - 1, Math.max(0, curIndex + direction));

            curParamValue = vals[curIndex];
            showToast(`${curMethod} → ${curParamValue}`);
            renderSubset();
            return;
        }


        // --- Camera + Point Size Controls ---
        if (func) {
            switch (func) {
                case "xmin-inc":
                    xmin += step;
                    showToast(`Xmin → ${Math.round(xmin)}`)
                    break;
                case "xmin-dec":
                    xmin -= step;
                    showToast(`Xmin → ${Math.round(xmin)}`)
                    break;
                case "xmax-inc":
                    xmax += step;
                    showToast(`Xmax → ${Math.round(xmax)}`)
                    break;
                case "xmax-dec":
                    xmax -= step;
                    showToast(`Xmax → ${Math.round(xmax)}`)
                    break;
                case "ymin-inc":
                    ymin += step;
                    showToast(`Ymin → ${Math.round(ymin)}`)
                    break;
                case "ymin-dec":
                    ymin -= step;
                    showToast(`Ymin → ${Math.round(ymin)}`)
                    break;
                case "ymax-inc":
                    ymax += step;
                    showToast(`Ymax → ${Math.round(ymax)}`)
                    break;
                case "ymax-dec":
                    ymax -= step;
                    showToast(`Ymax → ${Math.round(ymax)}`)
                    break;
                case "size-inc":
                    material.size += sizeStep;
                    showToast(`Dot Size → ${Math.round(material.size)}`)
                    break;
                case "size-dec":
                    material.size = Math.max(0.1, material.size - sizeStep);
                    showToast(`Dot Size → ${Math.round(material.size)}`)
                    break;
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

// --- Method Switch ---
document.getElementById("methodSelect").addEventListener("change", (e) => {
    curMethod = e.target.value;
    showToast(`Method: ${curMethod}`);
    renderSubset();
});

// --- Toast UI ---
function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 1500);
}

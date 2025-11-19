// main.js
import * as THREE from "three";
import { csvParse } from "d3-dsv";
import * as midi from "./midi.js";

midi.getPermission();

/*
  Global state
*/
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight - 50);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
let camera = null;
let points = null;
let material = null;

let geometry = null;

let dataByMethod = {}; // { umap: [rows...], tsne: [...], phate: [...] }
let paramValuesByMethod = {}; // { umap: { umap_n_neighbors: [5,10,15], umap_min_dist: [...] }, ... }
let currentParamValues = {}; // { umap: { umap_n_neighbors: 5, umap_min_dist: 1 }, ... }

let curMethod = "umap";

const PARAM_COLUMNS = {
    umap: ["umap_n_neighbors", "umap_min_dist"],
    tsne: ["tsne_perplexity", "tsne_learning_rate"],
    phate: ["phate_knn", "phate_t", "phate_decay"],
};

// UI elements
const fileInput = document.getElementById("fileInput");
const methodSelect = document.getElementById("methodSelect");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const paramMappingContainer = document.getElementById("paramMappingContainer");
const toast = document.getElementById("toast");
const resetViewBtn = document.getElementById("resetViewBtn");

// MIDI mapping state
// midiBindings keyed by "<status>-<data1>" -> { action: "param"|"method-switch"|..., paramCol?, type: "fader"|"knob"|"button" }
const midiBindings = {};
// waitingForMapping: { action: "param", paramCol: "umap_n_neighbors" } or { action: "method-switch" } etc.
let waitingForMapping = null;

// initial view snapshot for reset
let initialViewSnapshot = null;

// helper: show toast
let toastTimer = null;
function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1500);
}

/* -----------------------------
   CSV Loading and preprocessing
   ----------------------------- */
fileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const text = ev.target.result;
        const data = csvParse(text);
        onFileLoaded(data);
    };
    reader.readAsText(file);
});

function onFileLoaded(data) {
    // reset containers
    dataByMethod = {};
    paramValuesByMethod = {};
    currentParamValues = {};

    // Group by method
    data.forEach((row) => {
        const m = String(row.method).toLowerCase();
        if (!dataByMethod[m]) dataByMethod[m] = [];
        dataByMethod[m].push(row);
    });

    // Build param value lists for each method and param column
    Object.keys(PARAM_COLUMNS).forEach((method) => {
        const cols = PARAM_COLUMNS[method];
        paramValuesByMethod[method] = {};
        currentParamValues[method] = {};
        if (!dataByMethod[method]) {
            // empty
            cols.forEach((c) => {
                paramValuesByMethod[method][c] = [];
                currentParamValues[method][c] = null;
            });
            return;
        }

        cols.forEach((col) => {
            const vals = dataByMethod[method]
                .map((r) => {
                    const v = parseFloat(r[col]);
                    return Number.isFinite(v) ? v : NaN;
                })
                .filter((v) => !Number.isNaN(v));

            // unique & sorted
            const uniq = Array.from(new Set(vals)).sort((a, b) => a - b);
            paramValuesByMethod[method][col] = uniq;

            // default current value is first available (user choice 2:A)
            currentParamValues[method][col] = uniq.length > 0 ? uniq[0] : null;
        });
    });

    // set current method to UMAP by default if exists otherwise first
    if (dataByMethod["umap"]) curMethod = "umap";
    else curMethod = Object.keys(dataByMethod)[0] || "umap";

    // update method select UI to available methods
    populateMethodSelect();

    // populate param mapping UI for current method
    populateParamMappingUI();

    // render first embedding (first available params)
    renderForCurrentParams();

    // store snapshot for reset (deep copy)
    initialViewSnapshot = {
        method: curMethod,
        params: JSON.parse(JSON.stringify(currentParamValues)),
        // camera bounds will be set in renderForCurrentParams() once camera exists
        camera: null,
        size: material ? material.size : 2,
    };

    showToast("File loaded");
}

function populateMethodSelect() {
    // clear existing options
    if (!methodSelect) return;
    // keep only methods that exist in dataByMethod
    const existing = Object.keys(dataByMethod || {});
    // if none, leave the select as-is
    if (!existing.length) return;

    methodSelect.innerHTML = "";
    existing.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m.toUpperCase();
        methodSelect.appendChild(opt);
    });

    // set current selection
    methodSelect.value = curMethod;
}

/* -----------------------------
   Param mapping UI
   ----------------------------- */
settingsBtn.addEventListener("click", () => {
    const visible = settingsPanel.style.display === "flex";
    settingsPanel.style.display = visible ? "none" : "flex";
});

function populateParamMappingUI() {
    if (!paramMappingContainer) return;
    paramMappingContainer.innerHTML = "";

    const cols = PARAM_COLUMNS[curMethod] || [];
    cols.forEach((col) => {
        const row = document.createElement("div");
        row.className = "param-row";

        const span = document.createElement("span");
        span.textContent = `${col}`;
        span.style.flex = "1";

        const valSpan = document.createElement("span");
        valSpan.style.minWidth = "70px";
        valSpan.style.textAlign = "right";
        valSpan.style.marginRight = "8px";
        const curVal = currentParamValues[curMethod] && currentParamValues[curMethod][col];
        valSpan.textContent = curVal !== null && curVal !== undefined ? String(curVal) : "—";

        const btn = document.createElement("button");
        btn.textContent = "Map MIDI";
        btn.dataset.param = col;
        btn.addEventListener("click", () => {
            waitingForMapping = { action: "param", paramCol: col };
            btn.textContent = "Waiting for MIDI... 🎚️";
        });

        // store for updating later
        row.appendChild(span);
        row.appendChild(valSpan);
        row.appendChild(btn);
        paramMappingContainer.appendChild(row);
    });

    // show method-switch mapping row as well
    const methodRow = document.createElement("div");
    methodRow.className = "param-row";
    const msSpan = document.createElement("span");
    msSpan.textContent = "Method Switch";
    const msBtn = document.createElement("button");
    msBtn.textContent = "Map MIDI";
    msBtn.addEventListener("click", () => {
        waitingForMapping = { action: "method-switch" };
        msBtn.textContent = "Waiting for MIDI... 🎚️";
    });
    methodRow.appendChild(msSpan);
    methodRow.appendChild(document.createElement("div")); // spacer
    methodRow.appendChild(msBtn);
    paramMappingContainer.appendChild(methodRow);
}

/* -----------------------------
   Render logic: pick best row and draw
   ----------------------------- */
function findBestRowForCurrentParams() {
    const rows = dataByMethod[curMethod];
    if (!rows || rows.length === 0) return null;

    const params = currentParamValues[curMethod] || {};
    const paramCols = PARAM_COLUMNS[curMethod] || [];

    // If no param info, just choose first row
    if (!paramCols.length) return rows[0];

    let bestRow = null;
    let bestDist = Infinity;

    rows.forEach((r) => {
        let dist = 0;
        let valid = true;
        paramCols.forEach((col) => {
            const a = Number(params[col]);
            const b = Number(parseFloat(r[col]));
            if (!Number.isFinite(b)) {
                valid = false;
                return;
            }
            // absolute difference; scale if needed (all params are integers per your note)
            dist += Math.abs(a - b);
        });
        if (!valid) return;
        if (dist < bestDist) {
            bestDist = dist;
            bestRow = r;
        }
    });

    // fallback
    return bestRow || rows[0];
}

function renderForCurrentParams() {
    const chosenRow = findBestRowForCurrentParams();
    if (!chosenRow) {
        console.warn("No embedding available for current method/params");
        return;
    }

    // For this dataset each row seems to represent one point? 
    // But your previous CSV had many points per embedding. 
    // From earlier conversation, each row in this new file is one embedding point? 
    // WAIT — your earlier CSV had many rows representing many points for an embedding.
    // Here we assume the CSV still contains MANY rows: each row is a point but grouped by method+param combination.
    // So we need to render ALL rows that match chosenRow's method+param signature.
    // We'll find all rows in dataByMethod[curMethod] that match the chosenRow's parameter values exactly.
    const paramCols = PARAM_COLUMNS[curMethod] || [];
    const matchRows = dataByMethod[curMethod].filter((r) => {
        let ok = true;
        for (const col of paramCols) {
            const a = parseFloat(r[col]);
            const b = parseFloat(chosenRow[col]);
            if (!Number.isFinite(a) || !Number.isFinite(b) || a !== b) {
                ok = false;
                break;
            }
        }
        return ok;
    });

    if (matchRows.length === 0) {
        // If exact matches fail (floating problems), fall back to best-row selection (maybe same as chosenRow)
        console.warn("No exact group match found; falling back to rendering rows with same param signature by nearest.");
    }

    const rowsToRender = matchRows.length > 0 ? matchRows : [chosenRow];

    // Build buffers
    const numPoints = rowsToRender.length;
    const positions = new Float32Array(numPoints * 3);
    const colors = new Float32Array(numPoints * 3);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    rowsToRender.forEach((r, i) => {
        const x = parseFloat(r.dim1);
        const y = parseFloat(r.dim2);
        positions.set([x, y, 0], i * 3);

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);

        // color by label (categorical)
        const label = parseInt(r.label) || 0;
        const color = new THREE.Color().setHSL(((label % 12) / 12), 0.9, 0.55);
        colors.set([color.r, color.g, color.b], i * 3);
    });

    // geometry
    if (geometry) geometry.dispose();
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    if (!material) {
        material = new THREE.PointsMaterial({ size: 2, vertexColors: true });
    }

    if (points) scene.remove(points);
    points = new THREE.Points(geometry, material);
    scene.add(points);

    let xmin, xmax, ymin, ymax, margin = 0.01;

    // camera bounds
    xmin = minX - margin;
    xmax = maxX + margin;
    ymin = minY - margin;
    ymax = maxY + margin;

    if (!camera) {
        camera = new THREE.OrthographicCamera(xmin, xmax, ymax, ymin, 0.1, 2000);
        camera.position.z = 10;
        animate(); // start loop
    } else {
        camera.left = xmin;
        camera.right = xmax;
        camera.top = ymax;
        camera.bottom = ymin;
        camera.updateProjectionMatrix();
    }

    // Update displayed current param values in UI
    updateParamUIDisplays();

    // Save initial camera in snapshot if not present
    if (initialViewSnapshot && !initialViewSnapshot.camera) {
        initialViewSnapshot.camera = { xmin, xmax, ymin, ymax };
        initialViewSnapshot.size = material.size;
        initialViewSnapshot.method = curMethod;
        initialViewSnapshot.params = JSON.parse(JSON.stringify(currentParamValues));
    }
}

/* -----------------------------
   UI helper: update displayed param values
   ----------------------------- */
function updateParamUIDisplays() {
    // find param rows and update second child (value span)
    const rows = paramMappingContainer.querySelectorAll(".param-row");
    rows.forEach((row) => {
        const btn = row.querySelector("button");
        const spans = row.querySelectorAll("span");
        // format: [span label, valSpan]
        if (!btn || spans.length < 2) return;
        const param = btn.dataset.param;
        if (!param) return;
        const val = currentParamValues[curMethod][param];
        spans[1].textContent = val !== null && val !== undefined ? String(val) : "—";
    });
}

/* -----------------------------
   MIDI Handling
   ----------------------------- */
navigator.requestMIDIAccess().then((midiAccess) => {
    midi.listInputsAndOutputs(midiAccess);

    midi.startLoggingMIDIInput(midiAccess, (event) => {
        // event.data is a Uint8Array of [status, data1, data2]
        if (!event || !event.data) return;
        // use status-data1 as id
        const id = `${event.data[0]}-${event.data[1]}`;
        const value = event.data[2];
        console.log("midi input")

        // If we are waiting for mapping, capture this control
        if (waitingForMapping) {
            // detect type
            let type = "fader"; // default
            if (value === 0x41 || value === 0x01) type = "knob";
            else if (value === 0 || value === 127) type = "button";
            // store mapping
            if (waitingForMapping.action === "param") {
                midiBindings[id] = { action: "param", paramCol: waitingForMapping.paramCol, type };
                // update the UI button text to show mapping success
                const btn = paramMappingContainer.querySelector(`button[data-param='${waitingForMapping.paramCol}']`);
                if (btn) btn.textContent = `Mapped (${type}) ✅`;
            } else if (waitingForMapping.action === "method-switch") {
                midiBindings[id] = { action: "method-switch", type };
                // find method switch map button (last row)
                const rows = paramMappingContainer.querySelectorAll(".param-row");
                if (rows.length) {
                    const msBtn = rows[rows.length - 1].querySelector("button");
                    if (msBtn) msBtn.textContent = `Mapped (${type}) ✅`;
                }
            }
            waitingForMapping = null;
            return;
        }

        // Not mapping — interpret bound action
        const binding = midiBindings[id];
        if (!binding) return;

        // interpret delta/position from control type
        const type = binding.type || "fader";

        // Helper to advance a particular parameter's index list
        function setParamFromIndexArray(method, paramCol, newIndex) {
            const arr = paramValuesByMethod[method] && paramValuesByMethod[method][paramCol];
            if (!arr || arr.length === 0) return;
            newIndex = Math.max(0, Math.min(arr.length - 1, newIndex));
            currentParamValues[method][paramCol] = arr[newIndex];
            // re-render after change
            renderForCurrentParams();
        }

        if (binding.action === "param" && binding.paramCol) {
            const paramCol = binding.paramCol;
            const arr = paramValuesByMethod[curMethod] && paramValuesByMethod[curMethod][paramCol];
            if (!arr || arr.length === 0) return;

            if (type === "fader") {
                // absolute mapping: value 0..127 -> index 0..arr.length-1
                const idx = Math.round((value / 127) * (arr.length - 1));
                setParamFromIndexArray(curMethod, paramCol, idx);
            } else if (type === "knob") {
                // relative: detect common codes 0x41 (65) for CC decrement, 0x01 for increment
                if (value === 0x41) {
                    const curIdx = arr.indexOf(currentParamValues[curMethod][paramCol]);
                    setParamFromIndexArray(curMethod, paramCol, (curIdx === -1 ? 0 : curIdx - 1));
                } else if (value === 0x01) {
                    const curIdx = arr.indexOf(currentParamValues[curMethod][paramCol]);
                    setParamFromIndexArray(curMethod, paramCol, (curIdx === -1 ? 0 : curIdx + 1));
                } else {
                    // fallback: treat intermediate values as small step depending on >64 or <64
                    const curIdx = arr.indexOf(currentParamValues[curMethod][paramCol]);
                    const dir = value > 64 ? 1 : -1;
                    setParamFromIndexArray(curMethod, paramCol, (curIdx === -1 ? 0 : curIdx + dir));
                }
            } else if (type === "button") {
                // treat press (value>0) as increment
                if (value > 0) {
                    const curIdx = arr.indexOf(currentParamValues[curMethod][paramCol]);
                    setParamFromIndexArray(curMethod, paramCol, (curIdx === -1 ? 0 : curIdx + 1));
                }
            }

            return;
        }

        // method-switch action
        if (binding.action === "method-switch") {
            // handle type
            if (binding.type === "fader") {
                // value 0..127 choose method index
                const methods = Object.keys(dataByMethod);
                if (!methods || !methods.length) return;
                const idx = Math.round((value / 127) * (methods.length - 1));
                curMethod = methods[idx];
            } else if (binding.type === "knob") {
                const methods = Object.keys(dataByMethod);
                if (!methods || !methods.length) return;
                const curIdx = methods.indexOf(curMethod);
                if (value === 0x41) curMethod = methods[Math.max(0, curIdx - 1)];
                else if (value === 0x01) curMethod = methods[Math.min(methods.length - 1, curIdx + 1)];
                else {
                    // fallback: pick next when value > 64
                    curMethod = methods[(curIdx + (value > 64 ? 1 : -1) + methods.length) % methods.length];
                }
            } else {
                // button: switch on press
                if (value > 0) {
                    const methods = Object.keys(dataByMethod);
                    const curIdx = methods.indexOf(curMethod);
                    const next = (curIdx + 1) % methods.length;
                    curMethod = methods[next];
                }
            }

            // When method changes, per your choice 2:A pick first available parameter values for that method
            const cols = PARAM_COLUMNS[curMethod] || [];
            cols.forEach((c) => {
                const arr = paramValuesByMethod[curMethod] && paramValuesByMethod[curMethod][c];
                currentParamValues[curMethod][c] = (arr && arr.length > 0) ? arr[0] : null;
            });

            // update UI and rendering
            populateParamMappingUI();
            renderForCurrentParams();
            showToast(`Method: ${curMethod}`);
            return;
        }

        // handle other mapped actions like camera or size if you mapped them earlier
        if (binding.action === "xmin-inc" || binding.action === "xmin-dec" ||
            binding.action === "xmax-inc" || binding.action === "xmax-dec" ||
            binding.action === "ymin-inc" || binding.action === "ymin-dec" ||
            binding.action === "ymax-inc" || binding.action === "ymax-dec" ||
            binding.action === "size-inc" || binding.action === "size-dec" ||
            binding.action === "reset-view") {

            // compute delta depending on type
            let delta = 0;
            if (binding.type === "fader") {
                // normalized [-1..1] for smooth changes
                delta = (value / 127) * 2 - 1;
            } else if (binding.type === "knob") {
                if (value === 0x41) delta = -1;
                else if (value === 0x01) delta = 1;
                else delta = (value > 64) ? 1 : -1;
            } else { // button
                delta = value > 0 ? 1 : 0;
            }

            const step = 5;
            const sizeStep = 0.5;

            switch (binding.action) {
                case "xmin-inc": xmin += step * delta; break;
                case "xmin-dec": xmin -= step * delta; break;
                case "xmax-inc": xmax += step * delta; break;
                case "xmax-dec": xmax -= step * delta; break;
                case "ymin-inc": ymin += step * delta; break;
                case "ymin-dec": ymin -= step * delta; break;
                case "ymax-inc": ymax += step * delta; break;
                case "ymax-dec": ymax -= step * delta; break;
                case "size-inc": material.size = Math.max(0.1, material.size + sizeStep * delta); break;
                case "size-dec": material.size = Math.max(0.1, material.size - sizeStep * delta); break;
                case "reset-view":
                    if (value > 0) resetView();
                    break;
            }

            // apply camera update
            if (camera) {
                camera.left = xmin;
                camera.right = xmax;
                camera.top = ymax;
                camera.bottom = ymin;
                camera.updateProjectionMatrix();
            }
        }
    }); // end startLoggingMIDIInput
}); // end requestMIDIAccess

/* -----------------------------
   Method selector UI
   ----------------------------- */
methodSelect.addEventListener("change", (e) => {
    const newMethod = e.target.value;
    if (!dataByMethod[newMethod]) {
        showToast(`No data for ${newMethod}`);
        return;
    }
    curMethod = newMethod;

    // choose first available param values for this method (2:A)
    const cols = PARAM_COLUMNS[curMethod] || [];
    cols.forEach((c) => {
        const arr = paramValuesByMethod[curMethod] && paramValuesByMethod[curMethod][c];
        currentParamValues[curMethod][c] = (arr && arr.length > 0) ? arr[0] : null;
    });

    populateParamMappingUI();
    renderForCurrentParams();
});

/* -----------------------------
   Reset view
   ----------------------------- */
resetViewBtn && (resetViewBtn.onclick = resetView);

function resetView() {
    if (!initialViewSnapshot) return;
    // restore params
    if (initialViewSnapshot.params) {
        currentParamValues = JSON.parse(JSON.stringify(initialViewSnapshot.params));
    }
    // restore method
    if (initialViewSnapshot.method) curMethod = initialViewSnapshot.method;
    methodSelect.value = curMethod;

    // restore camera
    if (initialViewSnapshot.camera && camera) {
        xmin = initialViewSnapshot.camera.xmin;
        xmax = initialViewSnapshot.camera.xmax;
        ymin = initialViewSnapshot.camera.ymin;
        ymax = initialViewSnapshot.camera.ymax;
        camera.left = xmin;
        camera.right = xmax;
        camera.top = ymax;
        camera.bottom = ymin;
        camera.updateProjectionMatrix();
    }

    // restore point size
    if (initialViewSnapshot.size && material) material.size = initialViewSnapshot.size;

    populateParamMappingUI();
    renderForCurrentParams();
    showToast("View reset");
}

/* -----------------------------
   Animation loop
   ----------------------------- */
function animate() {
    requestAnimationFrame(animate);
    if (!camera) return;
    renderer.render(scene, camera);
}

/* -----------------------------
   Window resize
   ----------------------------- */
window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight - 50);
    if (camera) camera.updateProjectionMatrix();
});

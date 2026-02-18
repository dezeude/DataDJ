import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { newMessage } from './toast';
import { Lut } from 'three/addons/math/Lut.js';
import { color } from 'three/tsl';


const scene = new THREE.Scene();
scene.background = new THREE.Color(0, 0, 0)
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1_000_000_000);
camera.position.z = 2
//position must be > 0 so points are visible in frustum (cube)
const pointsGeometry = new THREE.BufferGeometry();
const pointsMaterial = new THREE.PointsMaterial({ size: 1, vertexColors: true, transparent: true });

const decimalPlaces: number = 2;
const cameraTopElement = document.getElementById('camera-top') as HTMLSpanElement;
const cameraLeftElement = document.getElementById('camera-left') as HTMLSpanElement;
const cameraBottomElement = document.getElementById('camera-bottom') as HTMLSpanElement;
const cameraRightElement = document.getElementById('camera-right') as HTMLSpanElement;
const formatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces })

const mouseVector = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
// Define a plane on the XY axis (Z = 0)
const xyPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
// Compute world coordinates
const worldMousePoint = new THREE.Vector3();

const mouseLeftElement = document.getElementById('mouse-left') as HTMLSpanElement;
const mouseRightElement = document.getElementById('mouse-right') as HTMLSpanElement;

let lastMouseDownX: number;
let lastMouseDownY: number;

function setBackgroundColor(color: THREE.Color) {
    scene.background = color
}

function floatEqual(x1: number, x2: number, epsilon: number = 0.000001): boolean {
    return Math.abs(x1 - x2) <= epsilon;
}

function animate(canvas: HTMLCanvasElement) {
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', (ev) => {
        lastMouseDownX = ev.clientX;
        lastMouseDownY = ev.clientY;
    })
    canvas.addEventListener('mouseup', (ev) => {
        const newX = ev.clientX;
        const newY = ev.clientY;
        if (floatEqual(lastMouseDownX, newX) && floatEqual(lastMouseDownY, newY)) {
            onMouseClick(ev)
        }
    })
    // canvas.addEventListener('click', onMouseClick)
    const renderer = new THREE.WebGLRenderer({ canvas: canvas });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const controls = new OrbitControls(camera, renderer.domElement);
    // Disable all 3D interaction
    controls.enableRotate = false;
    controls.enableZoom = true;
    controls.screenSpacePanning = true; // Pan along XY-plane

    // Optionally tweak speed
    controls.panSpeed = 1.0;

    // Map both left and right buttons to pan
    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;

    // TODO: Show the x and y coordinates that are visible to the camera
    // TODO: make a toast module

    renderer.setAnimationLoop(() => {
        computeAndUpdateCamCoords()
        controls.update()
        renderer.render(scene, camera);
    })
}

function onMouseMove(event: MouseEvent) {
    mouseVector.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouseVector.y = -(event.clientY / window.innerHeight) * 2 + 1;
    const pos = getXYFromMouse();
    mouseLeftElement.textContent = pos.x.toFixed(decimalPlaces)
    mouseRightElement.textContent = pos.y.toFixed(decimalPlaces)
}

function onMouseClick(event: MouseEvent) {
    mouseVector.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouseVector.y = -(event.clientY / window.innerHeight) * 2 + 1;
    const pos = getXYFromMouse();
    newMessage(`Click @ (${pos.x.toFixed(decimalPlaces)}, ${pos.y.toFixed(decimalPlaces)})`)
}

function getXYFromMouse() {
    raycaster.setFromCamera(mouseVector, camera);
    raycaster.ray.intersectPlane(xyPlane, worldMousePoint);
    return worldMousePoint;
}

function computeAndUpdateCamCoords() {
    const left = round(camera.position.x + camera.left / camera.zoom)
    const right = round(camera.position.x + camera.right / camera.zoom)
    const top = round(camera.position.y + camera.top / camera.zoom)
    const bottom = round(camera.position.y + camera.bottom / camera.zoom)

    cameraTopElement.textContent = top
    cameraLeftElement.textContent = left
    cameraRightElement.textContent = right
    cameraBottomElement.textContent = bottom
}

function round(num: number): string {
    return formatter.format(num)
}

function addRandomPoints(count: number) {
    const posSize = 3;
    const colorSize = 4;
    const positions = new Float32Array(count * posSize); // x, y, z for each point
    const colors = new Float32Array(count * colorSize); // x, y, z for each point

    for (let i = 0; i < count; i++) {
        positions[i * posSize] = Math.random() * 10 - 5; // x
        positions[i * posSize + 1] = Math.random() * 10 - 5; // y
        positions[i * posSize + 2] = 0; // z (flat)
        colors[i * colorSize + 0] = Math.random(); // R
        colors[i * colorSize + 1] = Math.random(); // G
        colors[i * colorSize + 2] = Math.random(); // B
    }

    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, posSize));
    pointsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, colorSize));

    const points = new THREE.Points(pointsGeometry, pointsMaterial);

    scene.add(points);

}

const coordsPerPoint = 3;
const channelsPerColor = 4;
let pointPositionsBuffer: Float32Array;
let pointColorsBuffer: Float32Array;// x, y, z for each point

function initDrawData(length: number) {
    pointPositionsBuffer = new Float32Array(length * coordsPerPoint);
    pointColorsBuffer = new Float32Array(length * channelsPerColor); // x, y, z for each point
}

function setXColumn(arr: ArrayLike<number>) {
    if (arr.length >= pointPositionsBuffer.length) throw new Error("Input array bigger than vertex buffer")
    for (let i = 0; i < arr.length; i++) {
        pointPositionsBuffer[i * coordsPerPoint] = arr[i]
    }
    pointsGeometry.getAttribute("position").needsUpdate = true;
}

function setYColumn(arr: ArrayLike<number>) {
    if (arr.length >= pointPositionsBuffer.length) throw new Error("Input array bigger than vertex buffer")
    for (let i = 0; i < arr.length; i++) {
        pointPositionsBuffer[i * coordsPerPoint + 1] = arr[i]
    }
    pointsGeometry.getAttribute("position").needsUpdate = true;
}

function setColumns(x: ArrayLike<number>, y: ArrayLike<number>) {
    if (x.length >= pointPositionsBuffer.length || y.length >= pointPositionsBuffer.length) throw new Error("Input array bigger than vertex buffer")
    if (x.length !== y.length) throw new Error("x and y columns are not the same length")

    for (let i = 0; i < x.length; i++) {
        pointPositionsBuffer[i * coordsPerPoint] = x[i];
        pointPositionsBuffer[i * coordsPerPoint + 1] = y[i];
    }
    pointsGeometry.getAttribute("position").needsUpdate = true;
}
/**
 * Renders only the rows that are included in the array parameters.
 * The points in the specified rows are rendered in the specified color,
 * Every other point is rendered as the background color of the canvas.
 * @param rowMask Array boolean mask that should be colored according to @param selectedColor
 * @param selectedColor Color for selected points
 * @param unselectedColor Color for unselected points
 */
function colorRows(rowMask: ArrayLike<boolean | number>, selectedColor: THREE.Color, unselectedColor: THREE.Color = scene.background as THREE.Color) {
    if (rowMask.length * channelsPerColor !== pointColorsBuffer.length)
        throw new Error(`Row mask should have the same number of rows as data. (${rowMask.length} * 3 != ${pointColorsBuffer.length})`)
    for (let i = 0; i < rowMask.length; i++) {
        if (rowMask[i]) {
            if (selectedColor === undefined) continue;
            pointColorsBuffer[i * channelsPerColor] = selectedColor.r
            pointColorsBuffer[i * channelsPerColor + 1] = selectedColor.g
            pointColorsBuffer[i * channelsPerColor + 2] = selectedColor.b
            pointColorsBuffer[i * channelsPerColor + 3] = 1
        }
        else {
            pointColorsBuffer[i * channelsPerColor] = unselectedColor.r
            pointColorsBuffer[i * channelsPerColor + 1] = unselectedColor.g
            pointColorsBuffer[i * channelsPerColor + 2] = unselectedColor.b
            pointColorsBuffer[i * channelsPerColor + 3] = 0
        }
    }
    pointsGeometry.getAttribute("color").needsUpdate = true;
}

export function showPoints(rowMask: ArrayLike<boolean | number>) {
    if (rowMask.length * channelsPerColor !== pointColorsBuffer.length)
        throw new Error(`Row mask should have the same number of rows as data. (${rowMask.length} * 3 != ${pointColorsBuffer.length})`)
    for (let i = 0; i < rowMask.length; i++) {
        if (rowMask[i]) {
            pointColorsBuffer[i * channelsPerColor + 3] = 1
        }
        else {
            pointColorsBuffer[i * channelsPerColor + 3] = 0
        }
    }
    pointsGeometry.getAttribute("color").needsUpdate = true;
}

/**
 * Changes the color of rows that are included in the array parameters.
 * The points in the specified rows are rendered in the specified color,
 * Every other point is rendered as the background color of the canvas.
 * @param selectedRows Array of row indices that should be colored according to @param selectedColor
 * @param selectedColor Color for selected points
 */
function colorSelectedRows(selectedRows: ArrayLike<number>, selectedColor: THREE.Color) {
    for (let i = 0; i < selectedRows.length; i++) {
        const idx = selectedRows[i]
        pointColorsBuffer[idx * channelsPerColor] = selectedColor.r
        pointColorsBuffer[idx * channelsPerColor + 1] = selectedColor.g
        pointColorsBuffer[idx * channelsPerColor + 2] = selectedColor.b
    }
    pointsGeometry.getAttribute("color").needsUpdate = true;
}

export function colorMapRows(colorValues: ArrayLike<number>, colorMap: Lut) {
    // if (colorValues.length * channelsPerColor !== pointColorsBuffer.length)
    //     throw new Error(`Row mask should have the same number of rows as data. (${colorValues.length * 3} * 3 != ${pointColorsBuffer.length})`)
    for (let i = 0; i < colorValues.length; i++) {
        const color = colorMap.getColor(colorValues[i])
        pointColorsBuffer[i * channelsPerColor] = color.r
        pointColorsBuffer[i * channelsPerColor + 1] = color.g
        pointColorsBuffer[i * channelsPerColor + 2] = color.b
    }
    pointsGeometry.getAttribute("color").needsUpdate = true;
}

function setAllPointColors(red: number, green: number, blue: number, alpha = 1) {
    for (let i = 0; i < pointColorsBuffer.length; i++) {
        pointColorsBuffer[i * channelsPerColor] = red; // R
        pointColorsBuffer[i * channelsPerColor + 1] = green; // G
        pointColorsBuffer[i * channelsPerColor + 2] = blue; //B
        pointColorsBuffer[i * channelsPerColor + 3] = alpha; //opacity
    }
    pointsGeometry.getAttribute("color").needsUpdate = true;
}

function renderColumns() {
    pointsGeometry.setAttribute("position", new THREE.BufferAttribute(pointPositionsBuffer, coordsPerPoint))
    pointsGeometry.setAttribute("color", new THREE.BufferAttribute(pointColorsBuffer, channelsPerColor))
    const points = new THREE.Points(pointsGeometry, pointsMaterial)
    scene.add(points)
}

function clearPoints() {
    scene.clear()
}

/**
 * Renders the columns which are each given as a list of numbers
 * @param x column to be rendered on the x-axis
 * @param y column to be rendered on the y-axis
*/

function renderPoints(x: ArrayLike<number>, y: ArrayLike<number>) {
    // TODO: Add number coloring functionality to this function?
    if (x.length !== y.length) throw new Error("x and y columns are not the same length")

    for (let i = 0; i < x.length; i++) {
        pointPositionsBuffer[i * coordsPerPoint] = x[i];
        pointPositionsBuffer[i * coordsPerPoint + 1] = y[i];
        // Would probably have to set the x and y before clicking a render button and rendering it.


        // What happens if I don't set the values under here
        pointPositionsBuffer[i * coordsPerPoint + 2] = 0;
        // z value (all points should be on xy plane)
        pointColorsBuffer[i * channelsPerColor] = 1; // R
        pointColorsBuffer[i * channelsPerColor + 1] = 1; // G
        pointColorsBuffer[i * channelsPerColor + 2] = 0; //B
    }
    pointsGeometry.setAttribute("position", new THREE.BufferAttribute(pointPositionsBuffer, coordsPerPoint))
    pointsGeometry.setAttribute("color", new THREE.BufferAttribute(pointColorsBuffer, channelsPerColor))
    const points = new THREE.Points(pointsGeometry, pointsMaterial)
    scene.add(points)
}

// function translateCamera(distanceX: number, distanceY: number){}
// function changePointSize(newPointSize: number){}

export { animate, clearPoints, colorRows, initDrawData, setXColumn, setAllPointColors, setYColumn, renderColumns }
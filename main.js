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

// Load CSV
fetch("data.csv")
    .then((res) => res.text())
    .then((text) => {
        const data = csvParse(text);

        const numPoints = data.length;
        const positions = new Float32Array(numPoints * 3);

        // compute bounds
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        data.forEach((row, i) => {
            const x = parseFloat(row.x);
            const y = parseFloat(row.y);
            const z = 0;

            positions.set([x, y, z], i * 3);

            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        });

        // set camera bounds with padding
        xmin = minX - 10;
        xmax = maxX + 10;
        ymin = minY - 10;
        ymax = maxY + 10;

        camera = new THREE.OrthographicCamera(
            xmin, xmax, ymax, ymin, 0.1, 2000
        );
        camera.position.z = 10;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        material = new THREE.PointsMaterial({
            size: 2,
            color: 0xff5533
        });

        points = new THREE.Points(geometry, material);
        scene.add(points);

        animate();
    });

navigator.requestMIDIAccess().then((midiAccess) => {
    console.log(midiAccess)
    midi.listInputsAndOutputs(midiAccess);
    let delta = 1;
    midi.startLoggingMIDIInput(midiAccess, (event) => {
        if (!camera) return; // wait until data loads

        const step = 5;       // how much to move edges
        const sizeStep = 0.5; // how much to change point size



        console.log(event.data)
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
        // else if (event.data[0] === 0xe7 && event.data[1] === 0x0) {
        //     delta = event.data[2];
        // }
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
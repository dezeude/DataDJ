
import * as THREE from "three";
// Scene & Camera
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(
    window.innerWidth / -200,
    window.innerWidth / 200,
    window.innerHeight / 200,
    window.innerHeight / -200,
    0.1,
    1000
);
camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Generate random points
const numPoints = 1000;
const positions = new Float32Array(numPoints * 3);

for (let i = 0; i < numPoints; i++) {
    const x = (Math.random() - 0.5) * 20;
    const y = (Math.random() - 0.5) * 20;
    const z = 0; // keep it 2D
    positions.set([x, y, z], i * 3);
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

const material = new THREE.PointsMaterial({
    size: 0.1,
    color: 0x0077ff
});

const points = new THREE.Points(geometry, material);
scene.add(points);

// Animate
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();

// Handle resize
window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.left = window.innerWidth / -200;
    camera.right = window.innerWidth / 200;
    camera.top = window.innerHeight / 200;
    camera.bottom = window.innerHeight / -200;
    camera.updateProjectionMatrix();
});
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import './style.css';

const memories = [
  { date: 'October 14, 2018', title: 'Salt in the air', short: 'Beach Trip', z: -10, image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', story: 'We got there before the beach had properly woken up. The water was colder than it looked, the snacks were a little sandy, and somehow nobody minded. I still remember the long walk back with the sun in our eyes.' },
  { date: 'November 02, 2019', title: 'Our first dance', short: 'First Dance', z: -6, image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80', story: 'The room was full of music and warm lights. We laughed through the first few steps, then found the rhythm together. It was not perfect, which somehow made it ours.' },
  { date: 'December 25, 2020', title: 'A quieter kind of winter', short: 'Winter Snow', z: -2, image: 'https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?auto=format&fit=crop&w=800&q=80', story: 'The world felt very still that morning. We made something warm, watched the snow gather at the window, and found a little celebration in being together. It was a small day that held a lot.' },
  { date: 'April 11, 2021', title: 'An ordinary Sunday', short: 'Sunday Together', z: 2, image: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=800&q=80', story: 'Nobody had a plan for the afternoon. We stayed around the table, traded stories, and let the hours pass gently. It became one of those ordinary days we wished we could keep.' },
  { date: 'June 05, 2022', title: 'Room to begin again', short: 'New Beginnings', z: 6, image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80', story: 'The boxes were everywhere, the keys felt new in my hand, and the rooms were full of possibility. We opened the windows, let the light in, and started imagining all the ordinary days that would make this place ours.' },
  { date: 'December 24, 2023', title: 'A home full of light', short: 'Christmas Eve', z: 10, image: 'https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=800&q=80', story: 'We put the last ornaments on the tree and waited for everyone to arrive. The little lights made the whole room feel peaceful. For one evening, there was nowhere else we needed to be.' },
];

const canvas = document.querySelector('#game');
const prompt = document.querySelector('#prompt');
const fade = document.querySelector('#fade');
const readingPanel = document.querySelector('#reading');
const readingClose = document.querySelector('#readingClose');
const errorPanel = document.querySelector('#error');
function showRuntimeError(message) {
  console.error(message);
  fade.classList.remove('on');
  errorPanel.hidden = false;
  const detail = message?.stack || message?.message || String(message);
  errorPanel.textContent = `The game stopped while loading: ${detail}`;
}
addEventListener('error', event => showRuntimeError(event.error || event.message || 'Unknown rendering error'));
addEventListener('unhandledrejection', event => showRuntimeError(event.reason || 'Unknown loading error'));
const keys = new Set();
const touchDirections = new Set();
const obstacles = [];
// Measured from both planted feet in the bundled walk clip at normal playback.
const WALK_STANCE_SPEED_AT_BASE_RATE = 1.5;
const BACK_STANCE_SPEED_AT_BASE_RATE = 3.15;
const WALK_CONTACT_START_TIME = 0.4;
const BACK_CONTACT_START_TIME = 0.4;
const player = { x: 0, z: 35, yaw: 0, speed: 2.65, walk: 0 };
let inGallery = false;
let currentRoomIndex = -1;
let outsideChurch = true;
let previousOutsideChurch = true;
let transitioning = false;
let nearestMemory = null;
let nearestPainting = null;
let savedChapelPosition = null;
let readingMemory = null;
let lastTime = 0;
let interactQueued = false;
let cameraTransition = null;
let isSitting = false;
let nearestSeat = null;
let sitAction = null;
let sittingSpot = null;
let sitBlend = 0;
let sittingBones = [];
const sitSpots = [];
let moving = false;
let movingBackward = false;
let actualMovementSpeed = 0;
let cameraYawOffset = 0;
let cameraPitch = 0;
let activeDrag = null;
const cameraHome = new THREE.Vector3(0, 6.4, 21);
const cameraTargetHome = new THREE.Vector3(0, 1.2, 6);
const lastPadButtons = new Map();
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  errorPanel.hidden = false;
  errorPanel.innerHTML = '<strong>3D graphics could not start.</strong><br>Update your browser or Android System WebView, then reopen Memory Chapel.';
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#d9e7ed');
scene.fog = new THREE.Fog('#f3e4cf', 28, 56);
const chapelBackground = new THREE.Color('#f5e6d1');
const gardenBackground = new THREE.Color('#d9e7ed');
const galleryBackground = new THREE.Color('#efe4cf');
const chapelFog = scene.fog;
const gardenFog = new THREE.Fog('#d9e7ed', 70, 130);
const galleryFog = new THREE.Fog('#e9ddc7', 28, 52);
const chapelFogColor = chapelFog.color.clone();
const chapelFogNear = chapelFog.near, chapelFogFar = chapelFog.far;
const churchGroup = new THREE.Group();
scene.add(churchGroup);
const gardenGroup = new THREE.Group(); scene.add(gardenGroup);
const exteriorGroup = new THREE.Group(); scene.add(exteriorGroup);
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 90);
camera.position.copy(cameraHome);
camera.lookAt(cameraTargetHome);

scene.add(new THREE.HemisphereLight('#fff6e8', '#896f55', 2.8));
const chapelKeyLight = new THREE.DirectionalLight('#fff1dc', 1.15);
chapelKeyLight.position.set(-7, 13, 7);
chapelKeyLight.castShadow = true;
chapelKeyLight.shadow.mapSize.set(1024, 1024);
chapelKeyLight.shadow.camera.left = -17;
chapelKeyLight.shadow.camera.right = 17;
chapelKeyLight.shadow.camera.top = 19;
chapelKeyLight.shadow.camera.bottom = -17;
chapelKeyLight.shadow.camera.near = 1;
chapelKeyLight.shadow.camera.far = 38;
chapelKeyLight.shadow.bias = -0.00025;
chapelKeyLight.shadow.normalBias = 0.025;
scene.add(chapelKeyLight, chapelKeyLight.target);
const altarLight = new THREE.PointLight('#ffe5b3', 42, 22, 2);
altarLight.position.set(0, 4, -10);
scene.add(altarLight);
const windowLight = new THREE.PointLight('#ffd8bd', 24, 20, 2);
windowLight.position.set(-8, 5, 1);
scene.add(windowLight);
const windowLightRight = new THREE.PointLight('#ffe6c2', 20, 20, 2);
windowLightRight.position.set(8, 5, 1);
scene.add(windowLightRight);
const candleLight = new THREE.PointLight('#ffd18c', 12, 9, 2);
candleLight.position.set(0, 2.5, -8.2);
scene.add(candleLight);

const mat = (color, roughness = 0.82, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness }, extra));
const stone = mat('#efddc5');
const stoneLight = mat('#fff0d9');
const wood = mat('#59331f');
const woodLight = mat('#87543a');
const floorMat = mat('#ead6b5');
const gold = mat('#e8c77e', 0.32, { metalness: 0.5, emissive: '#80602a', emissiveIntensity: 0.12 });
const red = mat('#981f3b', 0.78);
const glassMats = ['#e8a58d', '#dfa4ab', '#8fb9b0', '#f3d08b', '#e2c18d', '#d58b70'].map(c => mat(c, 0.32, { emissive: c, emissiveIntensity: 0.5 }));

function box(name, size, position, material, rotationY = 0, collision = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  churchGroup.add(mesh);
  if (collision) obstacles.push({ x: position[0], z: position[2], rx: size[0] / 2 + 0.32, rz: size[2] / 2 + 0.32 });
  return mesh;
}

// A sunny garden is the starting area, with one clear stone walk to the church doors.
const gardenGrass = mat('#8faa72');
const gardenStone = mat('#c9b89b');
const gardenEdge = mat('#e8d5b4');
const exteriorGold = mat('#dfbd72', 0.35, { metalness: 0.46 });
const leafCanopy = ['#557c4f', '#6f915a', '#829d63'].map(color => mat(color));
const gardenShrubMaterials = ['#486c45', '#5d804e', '#718c55'].map(color => mat(color));
const outsideObstacles = [];
const entranceDoorHinges = [];
let entranceDoorProgress = 0;
let churchViewBlend = 1;
function gardenMesh(name, geometry, material, position, group = gardenGroup) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name; mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = name === 'garden tree trunk' || name === 'garden tree canopy' || name === 'garden lamp post';
  mesh.receiveShadow = false;
  group.add(mesh); return mesh;
}
function makeGardenTexture(kind) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (kind === 'grass') {
    ctx.fillStyle = '#8faa72'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1800; i++) {
      const seed = i * 73.17;
      const x = (Math.sin(seed) * 0.5 + 0.5) * 512;
      const y = (Math.cos(seed * 1.71) * 0.5 + 0.5) * 512;
      ctx.strokeStyle = i % 3 ? 'rgba(58,91,47,.18)' : 'rgba(224,226,158,.22)';
      ctx.lineWidth = i % 5 === 0 ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(seed) * 3, y - 2 - (i % 4)); ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#c9b89b'; ctx.fillRect(0, 0, 512, 512);
    const rowHeight = 64, tileWidth = 128;
    for (let row = 0; row < 8; row++) {
      const offset = row % 2 ? -tileWidth / 2 : 0;
      for (let col = -1; col < 5; col++) {
        const x = col * tileWidth + offset, y = row * rowHeight;
        const tone = 188 + ((row * 19 + col * 31) % 24);
        ctx.fillStyle = `rgb(${tone + 20},${tone + 9},${tone - 13})`;
        ctx.fillRect(x + 2, y + 2, tileWidth - 4, rowHeight - 4);
        ctx.strokeStyle = 'rgba(115,94,70,.35)'; ctx.lineWidth = 3;
        ctx.strokeRect(x + 1, y + 1, tileWidth - 2, rowHeight - 2);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}
gardenGrass.map = makeGardenTexture('grass'); gardenGrass.map.repeat.set(4, 5); gardenGrass.needsUpdate = true;
gardenStone.map = makeGardenTexture('stone'); gardenStone.map.repeat.set(1.2, 9); gardenStone.needsUpdate = true;
gardenMesh('church garden lawn', new THREE.BoxGeometry(42, 0.36, 52), gardenGrass, [0, -0.38, 37]);
gardenMesh('garden path', new THREE.BoxGeometry(4.5, 0.08, 42), gardenStone, [0, -0.17, 35]);
for (const x of [-2.36, 2.36]) {
  gardenMesh('path edging', new THREE.BoxGeometry(0.16, 0.13, 42), gardenEdge, [x, -0.14, 35]);
}
// Pale joints make the approach read as a broad, welcoming stone walkway.
for (let z = 16; z <= 54; z += 2.4) {
  gardenMesh('path stone joint', new THREE.BoxGeometry(4.32, 0.018, 0.035), mat('#b29d7d'), [0, -0.115, z]);
}

function makeGardenTree(x, z, scale = 1) {
  const trunk = gardenMesh('garden tree trunk', new THREE.CylinderGeometry(0.34 * scale, 0.5 * scale, 4.1 * scale, 14), mat('#72513a'), [x, 1.72 * scale, z]);
  trunk.rotation.z = (x < 0 ? -1 : 1) * 0.035;
  const branchMaterial = mat('#79573b');
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + 0.35;
    const branch = gardenMesh('garden tree branch', new THREE.CylinderGeometry(0.1 * scale, 0.18 * scale, 2.15 * scale, 10), branchMaterial,
      [x + Math.cos(angle) * 0.82 * scale, 3.15 * scale, z + Math.sin(angle) * 0.82 * scale]);
    branch.rotation.z = Math.cos(angle) * 0.62;
    branch.rotation.x = Math.sin(angle) * 0.62;
  }
  const crownShapes = [
    [0, 5.15, 0, 2.15, 1.62, 1.9],
    [-1.12, 4.75, 0.18, 1.42, 1.38, 1.48],
    [1.15, 4.78, -0.1, 1.5, 1.38, 1.52],
    [0.12, 4.62, 1.02, 1.5, 1.28, 1.45],
    [-0.08, 4.64, -1.03, 1.45, 1.32, 1.48],
  ];
  crownShapes.forEach((shape, i) => {
    const crown = gardenMesh('garden tree canopy', new THREE.SphereGeometry(1, 20, 14), leafCanopy[i % leafCanopy.length],
      [x + shape[0] * scale, shape[1] * scale, z + shape[2] * scale]);
    crown.scale.set(shape[3] * scale, shape[4] * scale, shape[5] * scale);
  });
  outsideObstacles.push({ x, z, rx: 1.15 * scale, rz: 1.15 * scale });
}
for (const tree of [[-9.2, 22, 1.05], [9.1, 22.5, 1.02], [-8.3, 32, 0.9], [8.8, 34, 1.08], [-10, 44, 1.08], [10, 45, 1.02], [-13, 54, 1.15], [13, 54, 1.12]]) makeGardenTree(tree[0], tree[1], tree[2]);

function makeShrubCluster(x, z, scale = 1) {
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7;
    const radius = i === 0 ? 0 : 0.78 * scale;
    const shrub = gardenMesh('rounded garden shrub', new THREE.SphereGeometry(1, 16, 10), gardenShrubMaterials[i % gardenShrubMaterials.length],
      [x + Math.cos(angle) * radius, 0.34 + (i % 2) * 0.12, z + Math.sin(angle) * radius]);
    const size = (0.62 + (i % 3) * 0.11) * scale;
    shrub.scale.set(size, size * 0.72, size * 0.9);
  }
}
for (const shrub of [[-5.9, 25, 0.9], [5.7, 27, 0.92], [-7.2, 39, 0.78], [7.0, 49, 0.92], [-11.2, 50, 1.0], [11.4, 20, 0.82]]) makeShrubCluster(shrub[0], shrub[1], shrub[2]);

const gardenFlowerPetals = ['#fff7e7', '#f2c8ad', '#f6e0bc', '#e6a5a3'].map(color => mat(color));
const gardenFlowerCenter = mat('#e2b762', 0.5, { metalness: 0.18 });
const gardenFlowerLocations = [];
function gardenBorder(x, z, length, axis = 'z') {
  const dimensions = axis === 'z' ? [1.7, 0.42, length] : [length, 0.42, 1.7];
  gardenMesh('low garden flower bed', new THREE.BoxGeometry(dimensions[0], 0.18, dimensions[2]), mat('#788a58'), [x, -0.11, z]);
  const count = Math.max(5, Math.floor(length * 1.5));
  for (let i = 0; i < count; i++) {
    const along = (i / (count - 1) - 0.5) * (length - 0.35);
    const px = x + (axis === 'z' ? Math.sin(i * 2.4) * 0.35 : along);
    const pz = z + (axis === 'z' ? along : Math.cos(i * 2.4) * 0.35);
    gardenFlowerLocations.push({ x: px, y: 0.38 + (i % 3) * 0.09, z: pz, color: i % gardenFlowerPetals.length });
  }
}
gardenBorder(-3.7, 34, 26); gardenBorder(3.7, 34, 26);
gardenBorder(-7.1, 18.5, 7, 'x'); gardenBorder(7.1, 18.5, 7, 'x');
for (const x of [-3.7, 3.7]) outsideObstacles.push({ x, z: 34, rx: 1.05, rz: 13.2 });

// Batch flower petals and centers into a few GPU instanced draws for smoother mobile play.
const flowerDummy = new THREE.Object3D();
const flowerPetalGeometry = new THREE.SphereGeometry(0.12, 8, 6);
const flowerCenterGeometry = new THREE.SphereGeometry(0.065, 8, 6);
for (let colorIndex = 0; colorIndex < gardenFlowerPetals.length; colorIndex++) {
  const flowers = gardenFlowerLocations.filter(flower => flower.color === colorIndex);
  const petals = new THREE.InstancedMesh(flowerPetalGeometry, gardenFlowerPetals[colorIndex], flowers.length * 5);
  const centers = new THREE.InstancedMesh(flowerCenterGeometry, gardenFlowerCenter, flowers.length);
  petals.name = `instanced wedding flowers ${colorIndex}`;
  centers.name = `instanced flower centers ${colorIndex}`;
  petals.castShadow = false; petals.receiveShadow = false;
  centers.castShadow = false; centers.receiveShadow = false;
  let petalIndex = 0;
  let centerIndex = 0;
  for (const flower of flowers) {
    for (let petal = 0; petal < 5; petal++) {
      const angle = petal * Math.PI * 2 / 5;
      flowerDummy.position.set(flower.x + Math.cos(angle) * 0.105, flower.y, flower.z + Math.sin(angle) * 0.105);
      flowerDummy.rotation.set(0, -angle, 0);
      flowerDummy.scale.set(0.72, 0.42, 1.45);
      flowerDummy.updateMatrix(); petals.setMatrixAt(petalIndex++, flowerDummy.matrix);
    }
    flowerDummy.position.set(flower.x, flower.y + 0.03, flower.z);
    flowerDummy.rotation.set(0, 0, 0); flowerDummy.scale.setScalar(1); flowerDummy.updateMatrix();
    centers.setMatrixAt(centerIndex++, flowerDummy.matrix);
  }
  petals.instanceMatrix.needsUpdate = true; centers.instanceMatrix.needsUpdate = true;
  gardenGroup.add(petals, centers);
}

// A small reflecting pond opens up the right side of the garden like the reference setting.
const pondWater = new THREE.MeshStandardMaterial({ color: '#86b6b0', roughness: 0.24, metalness: 0.12, emissive: '#245b59', emissiveIntensity: 0.12 });
const pond = gardenMesh('garden reflecting pond', new THREE.CircleGeometry(1, 48), pondWater, [14, -0.185, 37]);
pond.rotation.x = -Math.PI / 2; pond.scale.set(4.15, 5.65, 1);
const pondRim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 10, 56), gardenEdge);
pondRim.rotation.x = Math.PI / 2; pondRim.position.set(14, -0.12, 37); pondRim.scale.set(4.2, 5.7, 1); pondRim.castShadow = true; gardenGroup.add(pondRim);
for (let i = 0; i < 7; i++) {
  const angle = i * 2.4;
  const rock = gardenMesh('pond edge stone', new THREE.DodecahedronGeometry(0.34 + (i % 2) * 0.1, 0), gardenEdge,
    [14 + Math.cos(angle) * 4.05, 0.05, 37 + Math.sin(angle) * 5.45]);
  rock.scale.y = 0.55;
}
outsideObstacles.push({ x: 14, z: 37, rx: 4.1, rz: 5.6 });

function makeGardenLantern(x, z) {
  const darkIron = mat('#40392e', 0.48, { metalness: 0.62 });
  gardenMesh('garden lamp base', new THREE.CylinderGeometry(0.35, 0.42, 0.18, 12), exteriorGold, [x, -0.07, z]);
  gardenMesh('garden lamp post', new THREE.CylinderGeometry(0.09, 0.15, 3.6, 10), darkIron, [x, 1.78, z]);
  gardenMesh('lantern lower cap', new THREE.CylinderGeometry(0.34, 0.22, 0.16, 8), darkIron, [x, 3.62, z]);
  gardenMesh('warm garden lantern', new THREE.OctahedronGeometry(0.36, 1), mat('#ffe8bb', 0.25, { emissive: '#ffc76f', emissiveIntensity: 1.2 }), [x, 4.0, z]);
  gardenMesh('lantern roof cap', new THREE.ConeGeometry(0.52, 0.34, 8), darkIron, [x, 4.39, z]);
  outsideObstacles.push({ x, z, rx: 0.42, rz: 0.42 });
}
for (const x of [-5.8, 5.8]) for (const z of [22, 47]) makeGardenLantern(x, z);

function makeGardenBench(x, z) {
  const benchWood = mat('#805238');
  gardenMesh('garden bench seat', new THREE.BoxGeometry(1.9, 0.14, 0.58), benchWood, [x, 0.72, z]);
  for (let board = 0; board < 3; board++) gardenMesh('bench back slat', new THREE.BoxGeometry(1.9, 0.12, 0.11), benchWood, [x, 1.04 + board * 0.2, z + 0.23]);
  for (const dx of [-0.72, 0.72]) {
    gardenMesh('bench iron leg', new THREE.BoxGeometry(0.12, 0.68, 0.12), exteriorGold, [x + dx, 0.35, z]);
    gardenMesh('bench arm rest', new THREE.BoxGeometry(0.1, 0.1, 0.65), benchWood, [x + dx, 0.98, z]);
  }
  outsideObstacles.push({ x, z, rx: 1.3, rz: 0.72 });
  sitSpots.push({ x, z, approachX: x, approachZ: z + 1.25, kind: 'garden' });
}
makeGardenBench(-6.9, 29); makeGardenBench(6.9, 42);

// Church frontage: a pale stone gable, rose window, cross, and open double doors.
const churchStone = mat('#d7c5a8');
churchStone.side = THREE.DoubleSide;
churchStone.needsUpdate = true;
const churchStoneTrim = mat('#f0dfc1');
const stoneSeam = mat('#bca98d', 0.9);
const roofRidge = mat('#765442', 0.88);
const stoneTextureCanvas = document.createElement('canvas'); stoneTextureCanvas.width = 256; stoneTextureCanvas.height = 256;
const stoneTextureContext = stoneTextureCanvas.getContext('2d');
stoneTextureContext.fillStyle = '#d9c8ad'; stoneTextureContext.fillRect(0, 0, 256, 256);
for (let i = 0; i < 4200; i++) {
  const seed = i * 31.73;
  const x = (Math.sin(seed) * 0.5 + 0.5) * 256;
  const y = (Math.cos(seed * 1.37) * 0.5 + 0.5) * 256;
  const shade = 115 + Math.floor((Math.sin(seed * 2.7) * 0.5 + 0.5) * 65);
  stoneTextureContext.fillStyle = `rgba(${shade + 27},${shade + 17},${shade},.10)`;
  stoneTextureContext.fillRect(x, y, 2 + (i % 5), 1 + (i % 3));
}
const stoneTexture = new THREE.CanvasTexture(stoneTextureCanvas); stoneTexture.colorSpace = THREE.SRGBColorSpace;
stoneTexture.wrapS = stoneTexture.wrapT = THREE.RepeatWrapping; stoneTexture.repeat.set(2.2, 1.4);
stoneTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
churchStone.map = stoneTexture; churchStone.needsUpdate = true;
function exteriorBox(name, size, position, material, rotationY = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.name = name; mesh.position.set(position[0], position[1], position[2]); mesh.rotation.y = rotationY;
  const [width, height, depth] = size;
  mesh.castShadow = width * height * depth > 12;
  mesh.receiveShadow = width * height * depth > 30;
  exteriorGroup.add(mesh); return mesh;
}
const facadeZ = 15.85;
exteriorBox('left church facade', [7.5, 8.4, 0.9], [-6.45, 4.05, facadeZ], churchStone);
exteriorBox('right church facade', [7.5, 8.4, 0.9], [6.45, 4.05, facadeZ], churchStone);
exteriorBox('entry lintel', [5.4, 1.55, 1.05], [0, 6.8, facadeZ], churchStone);
// A triangular gable sits above the nave doors.
const gable = new THREE.BufferGeometry();
gable.setAttribute('position', new THREE.Float32BufferAttribute([
  -10.2, 8.25, 15.34, 10.2, 8.25, 15.34, 0, 12.4, 15.34,
  -10.2, 8.25, 16.3, 0, 12.4, 16.3, 10.2, 8.25, 16.3,
], 3));
gable.setIndex([0, 1, 2, 3, 4, 5, 0, 3, 5, 0, 5, 1, 1, 5, 4, 1, 4, 2, 2, 4, 3, 2, 3, 0]);
gable.computeVertexNormals();
const gableMesh = new THREE.Mesh(gable, churchStone); gableMesh.name = 'church front gable'; gableMesh.castShadow = true; gableMesh.receiveShadow = true; exteriorGroup.add(gableMesh);
// Pitched terracotta roof panels continue the church silhouette above the nave.
const roofClay = mat('#956c53', 0.9);
function roofSlope(points) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: roofClay.color, roughness: 0.9, side: THREE.DoubleSide }));
  mesh.name = 'warm clay church roof'; mesh.castShadow = true; mesh.receiveShadow = true; exteriorGroup.add(mesh);
}
roofSlope([[-10.35, 8.35, 16.5], [0, 12.55, 16.5], [0, 12.55, -14.2], [-10.35, 8.35, -14.2]]);
roofSlope([[0, 12.55, 16.5], [10.35, 8.35, 16.5], [10.35, 8.35, -14.2], [0, 12.55, -14.2]]);
// Close the chapel shell so the outdoor view cannot see through to the interior nave.
exteriorBox('west exterior nave wall', [0.72, 9.2, 30.6], [-10.28, 4.12, 0.7], churchStone);
exteriorBox('east exterior nave wall', [0.72, 9.2, 30.6], [10.28, 4.12, 0.7], churchStone);
exteriorBox('rear exterior sanctuary wall', [20.9, 9.2, 0.72], [0, 4.12, -14.45], churchStone);
outsideObstacles.push(
  { x: -10.28, z: 0.7, rx: 0.72, rz: 15.3 },
  { x: 10.28, z: 0.7, rx: 0.72, rz: 15.3 },
);
// Fine roof courses and staggered stone joints give the outside a crafted finish.
for (let z = -13.3; z <= 15.6; z += 1.45) for (const side of [-1, 1]) {
  const seam = exteriorBox('clay roof tile course', [10.25, 0.055, 0.055], [side * 5.12, 10.48, z], roofRidge, side * -0.386);
  seam.position.y = 12.55 - Math.abs(seam.position.x) * 0.406 + 0.09;
}

// A compact bell tower gives the chapel a recognizable Catholic church silhouette.
const towerX = -8.25, towerZ = 16.18;
exteriorBox('bell tower lower shaft', [3.55, 10.8, 3.1], [towerX, 5.55, towerZ], churchStone);
for (const y of [1.1, 10.85]) exteriorBox('bell tower stone stringcourse', [3.9, 0.3, 3.42], [towerX, y, towerZ], churchStoneTrim);
for (const dx of [-1.55, 1.55]) {
  exteriorBox('bell tower corner pier', [0.25, 10.2, 0.28], [towerX + dx, 5.65, towerZ + 1.58], churchStoneTrim);
}
exteriorBox('belfry chamber', [4.05, 3.35, 3.65], [towerX, 12.65, towerZ], churchStoneTrim);
const belfryOpening = mat('#4a4035', 0.88);
const bellMetal = mat('#ba9658', 0.32, { metalness: 0.68 });
for (const x of [-0.95, 0, 0.95]) {
  const inset = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.075, 9, 22, Math.PI), exteriorGold);
  inset.position.set(towerX + x, 12.86, towerZ + 1.86); inset.rotation.z = Math.PI; exteriorGroup.add(inset);
  exteriorBox('arched bell opening', [0.72, 1.06, 0.09], [towerX + x, 12.5, towerZ + 1.88], belfryOpening);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.68), bellMetal);
  bell.scale.set(1.15, 0.72, 0.95); bell.position.set(towerX + x, 12.4, towerZ + 1.98); exteriorGroup.add(bell);
}
for (const dx of [-1.8, 1.8]) for (const dz of [-1.7, 1.7]) {
  exteriorBox('belfry corner column', [0.26, 3.2, 0.26], [towerX + dx, 12.68, towerZ + dz], exteriorGold);
}
const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(2.45, 2.6, 4), roofClay);
towerRoof.name = 'bell tower pyramidal roof'; towerRoof.position.set(towerX, 15.6, towerZ); towerRoof.rotation.y = Math.PI / 4;
towerRoof.castShadow = true; towerRoof.receiveShadow = true; exteriorGroup.add(towerRoof);
const towerCrossStem = exteriorBox('bell tower cross stem', [0.18, 1.5, 0.18], [towerX, 17.55, towerZ], exteriorGold);
exteriorBox('bell tower cross arms', [0.86, 0.17, 0.18], [towerX, 17.8, towerZ], exteriorGold);
// Two broad entrance steps lead cleanly from the path through the open doors.
exteriorBox('church entrance upper step', [5.9, 0.24, 0.8], [0, -0.02, 16.45], churchStoneTrim);
exteriorBox('church entrance lower step', [6.5, 0.22, 1.05], [0, -0.14, 17.1], gardenEdge);
for (const centerX of [-6.45, 6.45]) {
  exteriorBox('stone facade base course', [7.48, 0.34, 0.11], [centerX, 0.06, 16.35], churchStoneTrim);
  for (let row = 0; row < 6; row++) {
    const y = 0.72 + row * 1.28;
    exteriorBox('masonry horizontal joint', [7.42, 0.045, 0.035], [centerX, y, 16.32], stoneSeam);
    const offset = row % 2 ? 0.0 : 0.62;
    for (let joint = -2; joint <= 2; joint++) {
      const x = centerX + joint * 1.5 + offset;
      if (Math.abs(x - centerX) > 3.55) continue;
      exteriorBox('staggered stone block joint', [0.035, 1.23, 0.035], [x, y + 0.63, 16.32], stoneSeam);
    }
  }
}
for (const x of [-2.9, 2.9]) {
  exteriorBox('stone entry pier', [0.68, 5.45, 1.2], [x, 2.72, 16.48], churchStoneTrim);
  exteriorBox('entry capital', [0.95, 0.3, 1.4], [x, 5.53, 16.48], exteriorGold);
}
for (const x of [-5.45, 5.45]) {
  exteriorBox('front lancet window frame', [1.22, 2.92, 0.16], [x, 4.65, 16.37], exteriorGold);
  exteriorBox('front stained glass lancet', [0.94, 2.64, 0.12], [x, 4.65, 16.47], glassMats[x < 0 ? 0 : 2]);
  exteriorBox('lancet center mullion', [0.09, 2.62, 0.05], [x, 4.65, 16.56], churchStoneTrim);
  exteriorBox('lancet crossbar', [0.94, 0.08, 0.05], [x, 4.55, 16.56], churchStoneTrim);
  const pointedTop = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.075, 8, 24, Math.PI), exteriorGold);
  pointedTop.position.set(x, 5.95, 16.48); pointedTop.castShadow = true; exteriorGroup.add(pointedTop);
}
const entryArch = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.2, 12, 40, Math.PI), churchStoneTrim);
entryArch.position.set(0, 4.25, 16.48); entryArch.castShadow = true; exteriorGroup.add(entryArch);
const innerArch = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.065, 8, 40, Math.PI), exteriorGold);
innerArch.position.set(0, 4.25, 16.5); exteriorGroup.add(innerArch);
const entryTympanum = new THREE.Mesh(new THREE.CircleGeometry(2.43, 48, 0, Math.PI), churchStoneTrim);
entryTympanum.name = 'solid stone arch infill above entrance doors';
entryTympanum.position.set(0, 4.3, 16.32); exteriorGroup.add(entryTympanum);
for (const x of [-3.9, 3.9]) {
  exteriorBox('church wall sconce backplate', [0.22, 0.62, 0.13], [x, 3.82, 16.45], exteriorGold);
  const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.27, 1), mat('#ffe9bf', 0.24, { emissive: '#ffc66c', emissiveIntensity: 1.15 }));
  lantern.position.set(x, 4.22, 16.54); exteriorGroup.add(lantern);
}
// Closed oak double doors swing open as the player approaches from the garden.
for (const side of [-1, 1]) {
  const hinge = new THREE.Group();
  hinge.name = 'church entrance door hinge';
  hinge.position.set(side * 2.7, 0, 16.42);
  // The same real door leaves are visible from either side of the entrance.
  churchGroup.add(hinge);
  const leafX = side < 0 ? 1.35 : -1.35;
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(2.7, 4.5, 0.18), wood);
  leaf.name = 'closed oak church door';
  leaf.position.set(leafX, 2.25, 0); leaf.castShadow = true; leaf.receiveShadow = true; hinge.add(leaf);
  const inset = new THREE.Mesh(new THREE.BoxGeometry(2.34, 3.86, 0.07), woodLight);
  inset.position.set(leafX, 2.25, 0.125); hinge.add(inset);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 8), exteriorGold);
  knob.position.set(side < 0 ? 2.38 : -2.38, 2.15, 0.21); hinge.add(knob);
  entranceDoorHinges.push({ hinge, side });
}
// Rose window and a large Latin cross make the Catholic sanctuary clear from the garden.
const facadeRose = new THREE.Mesh(new THREE.CircleGeometry(1.28, 36), glassMats[3]);
facadeRose.position.set(0, 7.75, 16.42); facadeRose.castShadow = true; exteriorGroup.add(facadeRose);
const facadeRoseRim = new THREE.Mesh(new THREE.TorusGeometry(1.34, 0.12, 10, 40), exteriorGold);
facadeRoseRim.position.copy(facadeRose.position); exteriorGroup.add(facadeRoseRim);
for (let i = 0; i < 8; i++) {
  const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.12, 7), exteriorGold);
  spoke.position.copy(facadeRose.position); spoke.position.z = 16.46; spoke.rotation.z = i * Math.PI / 8; exteriorGroup.add(spoke);
}
exteriorBox('front cross upright', [0.42, 2.15, 0.42], [0, 10.5, 16.42], exteriorGold);
exteriorBox('front cross arms', [1.4, 0.36, 0.42], [0, 10.9, 16.42], exteriorGold);
for (const x of [-6.45, 6.45]) {
  outsideObstacles.push({ x, z: 15.85, rx: 3.5, rz: 0.72 });
}

// Stone floor and tall side walls. The open vaulted roof is drawn below the camera line.
box('floor', [20, 0.4, 30], [0, -0.35, 1], floorMat);
// Build the west wall around real window openings so the stained glass reads as windows.
box('left wall below windows', [0.55, 3.55, 30], [-10, 1.475, 1], stone);
box('left wall above windows', [0.55, 2.7, 30], [-10, 8.35, 1], stone);
const windowCenters = [-9, -3, 3, 9];
const windowHalfWidth = 1.225;
const wallStart = -14, wallEnd = 16;
let wallCursor = wallStart;
for (const center of windowCenters) {
  const openingStart = center - windowHalfWidth;
  if (openingStart > wallCursor) {
    const length = openingStart - wallCursor;
    box('left wall between windows', [0.55, 3.75, length], [-10, 5.125, (wallCursor + openingStart) / 2], stone);
  }
  wallCursor = center + windowHalfWidth;
}
if (wallCursor < wallEnd) {
  const length = wallEnd - wallCursor;
  box('left wall end pier', [0.55, 3.75, length], [-10, 5.125, (wallCursor + wallEnd) / 2], stone);
}
// Cut real arch-sized openings in the east wall instead of placing memory doors over solid masonry.
box('east wall beneath memory doors', [0.55, 0.5, 30], [10, -0.05, 1], stone);
box('east wall above memory arches', [0.55, 4.6, 30], [10, 7.4, 1], stone);
let eastWallCursor = -14;
for (const item of memories) {
  const openingStart = item.z - 1.7;
  if (openingStart > eastWallCursor) {
    const length = openingStart - eastWallCursor;
    box('east wall between memory arches', [0.55, 4.9, length], [10, 2.65, (eastWallCursor + openingStart) / 2], stone);
  }
  box(`shadow beyond ${item.short} doorway`, [0.08, 4.9, 3.34], [10.25, 2.65, item.z], new THREE.MeshBasicMaterial({ color: '#2a1a14' }));
  eastWallCursor = item.z + 1.7;
}
if (eastWallCursor < 16) {
  const length = 16 - eastWallCursor;
  box('east wall end pier', [0.55, 4.9, length], [10, 2.65, (eastWallCursor + 16) / 2], stone);
}
box('rear wall', [20, 10, 0.55], [0, 4.7, -14], stone);
churchGroup.add(new THREE.HemisphereLight('#fff3df', '#8b7153', 1.25));
box('wedding aisle runner', [6.8, 0.055, 27], [0, -0.11, 1], red);
for (const x of [-3.38, 3.38]) box('runner gold edging', [0.07, 0.04, 27], [x, -0.075, 1], gold);
for (let z = -12; z <= 14; z += 2) {
  box(`floor inlay ${z}`, [19.6, 0.025, 0.045], [0, -0.115, z], mat('#b49365', 0.54, { metalness: 0.22 }));
}
// Subtle gold embroidery curves along the pale wedding runner.
const carpetGold = mat('#d2ab70', 0.5, { metalness: 0.22 });
for (const z of [-8, -4, 0, 4, 8]) {
  for (const side of [-1, 1]) {
    const points = [
      new THREE.Vector3(0, -0.073, z - 1.45),
      new THREE.Vector3(side * 0.72, -0.073, z - 0.8),
      new THREE.Vector3(side * 1.72, -0.073, z),
      new THREE.Vector3(side * 0.72, -0.073, z + 0.8),
      new THREE.Vector3(0, -0.073, z + 1.45),
    ];
    const stitch = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.018, 5, false), carpetGold);
    churchGroup.add(stitch);
  }
}

// Open perspective is kept below the roof line so the ceiling never blocks play.
// If the camera is ever raised above the spring of the vault, hide the roof panels.
const vault = new THREE.Group(); churchGroup.add(vault);
const vaultMaterial = mat('#f2dfc3', 0.85, { side: THREE.DoubleSide });
function roofPanel(vertices) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]); geometry.computeVertexNormals();
  const panel = new THREE.Mesh(geometry, vaultMaterial); panel.receiveShadow = true; vault.add(panel);
}
roofPanel([[-9, 7.8, -13], [0, 11.8, -13], [0, 11.8, 15], [-9, 7.8, 15]]);
roofPanel([[0, 11.8, -13], [9, 7.8, -13], [9, 7.8, 15], [0, 11.8, 15]]);
const archMaterial = new THREE.MeshStandardMaterial({ color: '#f4dfc1', metalness: 0.28, roughness: 0.55, emissive: '#8e6734', emissiveIntensity: 0.16 });
for (const z of [-11, -6, -1, 4, 9, 14]) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-8.9, 7.5, z), new THREE.Vector3(-7.6, 8.7, z),
    new THREE.Vector3(-5.2, 9.85, z), new THREE.Vector3(0, 11.65, z),
    new THREE.Vector3(5.2, 9.85, z), new THREE.Vector3(7.6, 8.7, z), new THREE.Vector3(8.9, 7.5, z),
  ]);
  const arch = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, 0.14, 9, false), archMaterial);
  arch.castShadow = true; vault.add(arch);
  const rosette = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 12), gold);
  rosette.position.set(0, 11.45, z); vault.add(rosette);
}

// Keep the east aisle and every memory-door sightline clear of columns.
for (const z of [-11, -1, 9, 14]) {
  const columnXs = [-8.8];
  for (const x of columnXs) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.58, 7.25, 16), stoneLight);
    shaft.position.set(x, 3.65, z); shaft.castShadow = true; shaft.receiveShadow = true; churchGroup.add(shaft);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.78, 0.42, 16), gold);
    base.position.set(x, 0.42, z); churchGroup.add(base);
    const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.58, 0.55, 16), stoneLight);
    capital.position.set(x, 7.55, z); capital.castShadow = true; churchGroup.add(capital);
    const capitalTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.83, 0.83, 0.1, 16), gold);
    capitalTrim.position.set(x, 7.82, z); churchGroup.add(capitalTrim);
    for (let flute = 0; flute < 8; flute++) {
      const a = flute * Math.PI / 4;
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 6.45, 5), mat('#eee0c3', 0.75));
      line.position.set(x + Math.cos(a) * 0.48, 3.67, z + Math.sin(a) * 0.48); churchGroup.add(line);
    }
  }
}

// Three warm pendant chandeliers hang beneath the vault, clear of the follow camera.
for (const z of [-8, 1, 10]) {
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.05, 8), gold);
  chain.position.set(0, 8.95, z); churchGroup.add(chain);
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.1, 8, 32), gold);
  hoop.rotation.x = Math.PI / 2; hoop.position.set(0, 8.35, z); churchGroup.add(hoop);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 8), gold);
    stem.position.set(Math.cos(a) * 1.02, 8.0, z + Math.sin(a) * 1.02); churchGroup.add(stem);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), mat('#ffe5a1', 0.3, { emissive: '#ffb84c', emissiveIntensity: 1.6 }));
    light.position.set(Math.cos(a) * 1.02, 7.72, z + Math.sin(a) * 1.02); churchGroup.add(light);
  }
  const glow = new THREE.PointLight('#ffd293', 10, 10, 2); glow.position.set(0, 7.6, z); churchGroup.add(glow);
}

// Stained glass sits inside the new wall openings and lets warm daylight through.
const windowGlassMats = glassMats.map(source => new THREE.MeshStandardMaterial({
  color: source.color,
  emissive: source.emissive,
  emissiveIntensity: 0.35,
  roughness: 0.28,
  transparent: true,
  opacity: 0.68,
  side: THREE.DoubleSide,
  depthWrite: false,
}));
for (const side of [-1, 1]) for (const z of windowCenters) {
  const x = side * 10.67;
  exteriorBox('exterior side lancet surround', [0.16, 3.55, 2.55], [x, 5.18, z], exteriorGold);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++) {
    exteriorBox('exterior stained-glass pane', [0.08, 0.98, 1.08], [side * 10.77, 6.03 - row * 1.03, z - 0.55 + col * 1.1], windowGlassMats[(row * 2 + col + Math.abs(z)) % windowGlassMats.length]);
  }
  exteriorBox('exterior lancet mullion', [0.08, 3.45, 0.12], [side * 10.78, 5.18, z], exteriorGold);
  exteriorBox('exterior lancet crossbar', [0.08, 0.1, 2.35], [side * 10.78, 5.18, z], exteriorGold);
}
for (const z of windowCenters) {
  box('window frame', [0.18, 3.4, 2.45], [-9.67, 5.25, z], gold);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++) {
    box('stained glass', [0.1, 0.95, 1.03], [-9.55, 6.12 - row * 1.03, z - 0.53 + col * 1.06], windowGlassMats[(row * 2 + col + Math.abs(z)) % windowGlassMats.length]);
  }
  box('window mullion', [0.12, 3.4, 0.12], [-9.49, 5.25, z], gold);
  box('window crossbar', [0.12, 0.12, 2.35], [-9.49, 5.25, z], gold);
}

// Tall side arches and pilasters create the open, repeated nave rhythm in the reference.
for (const side of [-1, 1]) {
  for (const z of windowCenters) {
    const x = side * 9.52;
    const archCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 2.85, z - 1.48),
      new THREE.Vector3(x, 4.25, z - 1.48),
      new THREE.Vector3(x, 5.9, z - 1.08),
      new THREE.Vector3(x, 6.85, z),
      new THREE.Vector3(x, 5.9, z + 1.08),
      new THREE.Vector3(x, 4.25, z + 1.48),
      new THREE.Vector3(x, 2.85, z + 1.48),
    ]);
    const arcadeArch = new THREE.Mesh(new THREE.TubeGeometry(archCurve, 32, 0.12, 8, false), archMaterial);
    arcadeArch.castShadow = true; churchGroup.add(arcadeArch);
    for (const jamb of [-1, 1]) {
      box('side arcade pilaster', [0.34, 5.0, 0.42], [side * 9.47, 4.05, z + jamb * 1.56], stoneLight);
      box('side arcade capital', [0.55, 0.24, 0.7], [side * 9.43, 6.45, z + jamb * 1.56], gold);
      box('side arcade base', [0.55, 0.32, 0.7], [side * 9.43, 0.38, z + jamb * 1.56], gold);
    }
  }
}

// Jewel-toned rose window above the sanctuary cross.
for (const x of [-4.1, 0, 4.1]) {
  box('sanctuary lancet window frame', [1.55, 3.8, 0.16], [x, 5.15, -13.58], gold);
  box('sanctuary lancet stained glass', [1.28, 3.52, 0.08], [x, 5.15, -13.47], windowGlassMats[(Math.abs(x) + 2) % windowGlassMats.length]);
  box('sanctuary lancet mullion', [0.08, 3.45, 0.05], [x, 5.15, -13.4], gold);
  box('sanctuary lancet crossbar', [1.2, 0.08, 0.05], [x, 5.15, -13.4], gold);
}
const rose = new THREE.Mesh(new THREE.CircleGeometry(1.42, 48), glassMats[2]);
rose.position.set(0, 8.65, -13.68); churchGroup.add(rose);
const roseFrame = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.13, 10, 48), gold);
roseFrame.position.set(0, 8.65, -13.62); churchGroup.add(roseFrame);
for (let i = 0; i < 8; i++) {
  const a = i * Math.PI / 4;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.75, 0.06), gold);
  bar.position.set(0, 8.65, -13.55); bar.rotation.z = a; churchGroup.add(bar);
}

// Altar, cross, candles, and a warm pool of light at the end of the nave.
box('sanctuary lower step', [8.1, 0.18, 2.65], [0, -0.02, -10.15], stoneLight);
box('sanctuary upper step', [7.3, 0.22, 2.1], [0, 0.15, -11.0], stoneLight);
box('altar base', [5.8, 1.7, 1.1], [0, 1.02, -12], wood);
box('altar ivory drape', [5.88, 1.42, 1.18], [0, 1.06, -11.88], stoneLight);
box('altar top', [6.5, 0.28, 1.5], [0, 1.98, -12], gold);
box('cross upright', [0.28, 3.5, 0.32], [0, 5.15, -13.25], gold);
box('cross arm', [1.8, 0.28, 0.32], [0, 5.65, -13.25], gold);
for (const x of [-2.35, 2.35]) {
  box('candle stem', [0.13, 0.75, 0.13], [x, 2.5, -11.7], gold);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), mat('#ffd779', 0.3, { emissive: '#ff9b32', emissiveIntensity: 1.7 }));
  flame.position.set(x, 2.98, -11.7); churchGroup.add(flame);
}

// Catholic sanctuary details: the tabernacle, Eucharistic host, and Marian side altar.
const sanctuaryGold = mat('#d5ae68', 0.3, { metalness: 0.55 });
box('tabernacle base', [1.58, 0.18, 0.9], [0, 2.2, -12.02], sanctuaryGold);
box('tabernacle body', [1.25, 1.12, 0.72], [0, 2.82, -12.02], mat('#d9c39a', 0.44, { metalness: 0.2 }));
box('tabernacle crown', [1.48, 0.16, 0.88], [0, 3.46, -12.02], sanctuaryGold);
const host = new THREE.Mesh(new THREE.CircleGeometry(0.31, 24), mat('#fff0ce', 0.45, { emissive: '#ad873d', emissiveIntensity: 0.14 }));
host.position.set(0, 2.85, -11.64); churchGroup.add(host);
box('tabernacle cross upright', [0.09, 0.46, 0.06], [0, 2.86, -11.59], sanctuaryGold);
box('tabernacle cross arm', [0.3, 0.07, 0.06], [0, 2.94, -11.59], sanctuaryGold);
// A sanctuary lamp hangs beside the tabernacle as a familiar Catholic church detail.
const sanctuaryLamp = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 10), mat('#d94f36', 0.28, { emissive: '#e84826', emissiveIntensity: 0.9 }));
sanctuaryLamp.position.set(1.55, 3.35, -11.55); churchGroup.add(sanctuaryLamp);
const lampChain = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 8), sanctuaryGold);
lampChain.position.set(1.55, 4.2, -11.55); churchGroup.add(lampChain);

// Finished wedding pews: rounded walnut frames, soft ivory cushions, and a clear center aisle.
const pewCushion = mat('#74402a', 0.52);
const pewInset = mat('#7c452d', 0.58);
const pewGold = mat('#d4b06b', 0.38, { metalness: 0.42 });
function pewPart(name, size, position, material, radius = 0.055) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 4, radius), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  churchGroup.add(mesh);
  return mesh;
}
function makePew(x, z) {
  pewPart('pew seat frame', [2.75, 0.16, 1.22], [x, 0.84, z], wood, 0.07);
  pewPart('pew seat cushion', [2.58, 0.1, 1.06], [x, 0.94, z], pewCushion, 0.06);
  const back = pewPart('pew back frame', [2.75, 0.88, 0.18], [x, 1.32, z + 0.52], wood, 0.075);
  back.rotation.x = 0.035;
  const inset = pewPart('pew back wood inset', [2.48, 0.62, 0.07], [x, 1.32, z + 0.4], pewInset, 0.065);
  inset.rotation.x = 0.035;
  pewPart('pew back crown rail', [2.68, 0.12, 0.22], [x, 1.78, z + 0.52], woodLight, 0.07);
  pewPart('pew lower stretcher', [2.48, 0.12, 0.14], [x, 0.4, z + 0.48], woodLight, 0.04);
  for (const side of [-1, 1]) {
    const px = x + side * 1.28;
    pewPart('pew front leg', [0.16, 0.68, 0.16], [px, 0.36, z - 0.42], woodLight, 0.05);
    pewPart('pew back post', [0.16, 1.12, 0.18], [px, 0.94, z + 0.48], woodLight, 0.055);
    pewPart('pew arm support', [0.14, 0.34, 0.16], [px, 1.03, z + 0.02], wood, 0.045);
    pewPart('pew arm rest', [0.2, 0.12, 0.9], [px, 1.25, z + 0.06], woodLight, 0.06);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 9), pewGold);
    finial.position.set(px, 1.58, z + 0.5);
    finial.castShadow = true;
    churchGroup.add(finial);
  }
  obstacles.push({ x, z: z + 0.03, rx: 1.5, rz: 0.88 });
  sitSpots.push({ x, z, approachX: x - Math.sign(x) * 2.0, approachZ: z, kind: 'pew' });
}
for (const z of [-5, -1, 3, 7, 11]) {
  makePew(-5.6, z);
  makePew(5.6, z);
}

// Soft blush bows dress the aisle-facing pew ends for a ceremony.
const ribbonMaterial = mat('#c98e83', 0.7);
for (const z of [-5, -1, 3, 7, 11]) for (const side of [-1, 1]) {
  const x = side * 4.12;
  const bow = new THREE.Group();
  bow.position.set(x, 1.32, z + 0.05);
  bow.scale.setScalar(0.58);
  churchGroup.add(bow);
  for (const loopSide of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 18), ribbonMaterial);
    loop.rotation.y = Math.PI / 2;
    loop.rotation.z = loopSide * 0.42;
    loop.position.set(0, 0.03, loopSide * 0.15);
    loop.castShadow = true;
    bow.add(loop);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), pewGold);
  bow.add(knot);
  const tail = pewPart('pew ribbon tail', [0.04, 0.38, 0.09], [x, 1.32, z - 0.08], ribbonMaterial, 0.03);
  tail.rotation.z = -side * 0.08;
}

// Wedding flowers in ivory urns and soft peach/cream clusters along the aisle.
const leafMaterial = mat('#71805b', 0.82);
const petalMaterials = ['#fff6e8', '#f6d8c3', '#eebfae', '#f4e8d1'].map(color => mat(color, 0.72));
const flowerCenter = mat('#d5aa62', 0.68);
function makeFlowerArrangement(x, z, scale = 1) {
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * scale, 0.34 * scale, 0.72 * scale, 16), gold);
  stand.position.set(x, 0.32 * scale, z); stand.castShadow = true; churchGroup.add(stand);
  const urn = new THREE.Mesh(new THREE.SphereGeometry(0.38 * scale, 16, 12), stoneLight);
  urn.scale.set(1, 0.72, 1); urn.position.set(x, 0.82 * scale, z); urn.castShadow = true; churchGroup.add(urn);
  const rng = (seed) => { const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
  for (let i = 0; i < 17; i++) {
    const fx = x + (rng(i + x * 7) - 0.5) * 1.15 * scale;
    const fz = z + (rng(i + z * 11) - 0.5) * 0.9 * scale;
    const fy = (1.35 + rng(i + z) * 0.95) * scale;
    const petalMat = petalMaterials[i % petalMaterials.length];
    const flower = new THREE.Group(); flower.position.set(fx, fy, fz); churchGroup.add(flower);
    for (let p = 0; p < 5; p++) {
      const a = p * Math.PI * 2 / 5;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.16 * scale, 10, 8), petalMat);
      petal.scale.set(1, 0.74, 0.62);
      petal.position.set(Math.cos(a) * 0.15 * scale, 0, Math.sin(a) * 0.15 * scale);
      flower.add(petal);
    }
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.075 * scale, 10, 8), flowerCenter);
    flower.add(center);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22 * scale, 10, 8), leafMaterial);
    leaf.scale.set(1.6, 0.32, 0.55); leaf.position.set((i % 2 ? 1 : -1) * 0.32 * scale, -0.28 * scale, 0); leaf.rotation.z = i % 2 ? -0.38 : 0.38; flower.add(leaf);
  }
}
for (const z of [-8.3]) {
  makeFlowerArrangement(-4.0, z, 1.3);
  makeFlowerArrangement(4.0, z, 1.3);
}

function textTexture(lines) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#271d15'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#d4b575'; g.lineWidth = 5; g.strokeRect(5, 5, c.width - 10, c.height - 10);
  g.textAlign = 'center'; g.fillStyle = '#f4e4c2';
  g.font = '24px Georgia'; g.fillText(lines[0], 256, 48);
  g.fillStyle = '#e5c27a'; g.font = 'bold 20px sans-serif'; g.fillText(lines[1].toUpperCase(), 256, 88);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

function paintingPlaqueTexture(item) {
  const c = document.createElement('canvas'); c.width = 960; c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#211912'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#d8b66f'; g.lineWidth = 6; g.strokeRect(8, 8, c.width - 16, c.height - 16);
  g.textAlign = 'left'; g.fillStyle = '#e8c47b'; g.font = '22px system-ui'; g.fillText(item.date.toUpperCase(), 34, 45);
  g.fillStyle = '#fff0d5'; g.font = 'bold 31px Georgia'; g.fillText(item.title, 34, 91, c.width - 68);
  g.fillStyle = '#e1d1b7'; g.font = '21px Georgia';
  const words = item.story.split(/\s+/); let line = '', y = 138;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (g.measureText(candidate).width > c.width - 68 && line) { g.fillText(line, 34, y); line = word; y += 38; }
    else line = candidate;
  }
  if (line && y <= 300) g.fillText(line, 34, y);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); return texture;
}

const doorGroups = [];
for (const item of memories) {
  const group = new THREE.Group();
  group.position.set(9.35, 0, item.z);
  group.rotation.y = -Math.PI / 2;
  churchGroup.add(group);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.4, 0.28), gold);
  frame.position.y = 1.72; frame.castShadow = true; group.add(frame);
  // A full-height stone surround makes the memory door read as part of the nave arcade.
  const portalCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.58, 2.55, -0.3), new THREE.Vector3(-1.58, 3.55, -0.3),
    new THREE.Vector3(-1.43, 4.2, -0.3), new THREE.Vector3(-0.98, 4.72, -0.3),
    new THREE.Vector3(0, 4.98, -0.3), new THREE.Vector3(0.98, 4.72, -0.3),
    new THREE.Vector3(1.43, 4.2, -0.3), new THREE.Vector3(1.58, 3.55, -0.3),
    new THREE.Vector3(1.58, 2.55, -0.3),
  ]);
  const portalArch = new THREE.Mesh(new THREE.TubeGeometry(portalCurve, 36, 0.15, 9, false), stoneLight);
  portalArch.name = `stone memory arch ${item.short}`; portalArch.castShadow = true; group.add(portalArch);
  for (const side of [-1, 1]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.75, 0.35), stoneLight);
    pier.position.set(side * 1.58, 1.5, -0.3); pier.castShadow = true; group.add(pier);
    const capital = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.48), gold);
    capital.position.set(side * 1.58, 2.95, -0.3); group.add(capital);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.26, 0.48), gold);
    base.position.set(side * 1.58, 0.28, -0.3); group.add(base);
  }
  const doorLeaf = new THREE.Group();
  doorLeaf.name = `swinging memory door ${item.short}`;
  doorLeaf.position.set(-1.125, 0, 0.18); group.add(doorLeaf);
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.25, 3.12, 0.24), wood);
  door.position.set(1.125, 1.7, 0); door.castShadow = true; door.name = `memory door ${item.short}`; doorLeaf.add(door);
  const doorPanels = [
    [-0.43, 1.0], [0.43, 1.0], [-0.43, 2.15], [0.43, 2.15],
  ];
  for (const panelPosition of doorPanels) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.88, 0.055), woodLight);
    panel.position.set(panelPosition[0] + 1.125, panelPosition[1], 0.16); doorLeaf.add(panel);
  }
  // Pointed Gothic arch and a small cross give the dated door a church-built character.
  const archCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.12, 2.65, 0.34), new THREE.Vector3(-0.98, 3.08, 0.34),
    new THREE.Vector3(-0.62, 3.37, 0.34), new THREE.Vector3(0, 3.52, 0.34),
    new THREE.Vector3(0.62, 3.37, 0.34), new THREE.Vector3(0.98, 3.08, 0.34),
    new THREE.Vector3(1.12, 2.65, 0.34),
  ]);
  const doorArch = new THREE.Mesh(new THREE.TubeGeometry(archCurve, 32, 0.055, 8, false), pewGold);
  group.add(doorArch);
  const latch = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), pewGold);
  latch.position.set(0.3, 1.62, 0.21); doorLeaf.add(latch);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.74), new THREE.MeshBasicMaterial({ map: textTexture([item.date, item.short]), side: THREE.DoubleSide }));
  label.position.set(0, 3.78, 0.4); group.add(label);
  const lamp = new THREE.PointLight('#ffca79', 3.8, 5, 2); lamp.position.set(0, 3.2, 0.6); group.add(lamp);
  doorGroups.push({ item, group, door, doorLeaf, position: new THREE.Vector3(8.15, 0, item.z) });
}

// Walnut wainscoting and a fine brass rail echo the wood-lined side walls in the reference.
const naveWainscot = mat('#65412f', 0.7);
const naveWainscotTrim = mat('#bc9256', 0.42, { metalness: 0.32 });
box('west nave wainscoting', [0.14, 2.25, 29.7], [-9.58, 1.12, 1], naveWainscot);
box('west nave brass chair rail', [0.1, 0.11, 29.7], [-9.48, 2.28, 1], naveWainscotTrim);
box('west nave baseboard', [0.1, 0.16, 29.7], [-9.48, 0.12, 1], naveWainscotTrim);
let panelStart = -14;
for (const item of memories) {
  const panelEnd = item.z - 1.72;
  const panelLength = panelEnd - panelStart;
  if (panelLength > 0.2) {
    const mid = (panelStart + panelEnd) / 2;
    box('east nave wainscoting panel', [0.14, 2.25, panelLength], [9.58, 1.12, mid], naveWainscot);
    box('east nave brass chair rail', [0.1, 0.11, panelLength], [9.48, 2.28, mid], naveWainscotTrim);
    box('east nave baseboard', [0.1, 0.16, panelLength], [9.48, 0.12, mid], naveWainscotTrim);
  }
  panelStart = item.z + 1.72;
}
if (panelStart < 16) {
  const length = 16 - panelStart, mid = (16 + panelStart) / 2;
  box('east nave wainscoting panel', [0.14, 2.25, length], [9.58, 1.12, mid], naveWainscot);
  box('east nave brass chair rail', [0.1, 0.11, length], [9.48, 2.28, mid], naveWainscotTrim);
  box('east nave baseboard', [0.1, 0.16, length], [9.48, 0.12, mid], naveWainscotTrim);
}

const galleryObstacles = [];
const galleryPosition = new THREE.Vector3(0, 0, 4.5);
const exitPosition = new THREE.Vector3(0, 0, 6.35);
const galleryWall = mat('#d8c49e');
const galleryTrim = mat('#e6c77e', 0.34, { metalness: 0.5, emissive: '#5c4016', emissiveIntensity: 0.1 });
const galleryFloor = mat('#987450');
const galleryDark = new THREE.MeshBasicMaterial({ color: '#251912' });
const galleryGroup = new THREE.Group();
galleryGroup.name = 'memory rooms';
galleryGroup.visible = false;
scene.add(galleryGroup);
const roomGroups = [];
const roomCeilings = [];
const galleryExitDoors = [];
const portalDoorLeaves = [];
let galleryCeiling = null;
function roomBox(group, name, size, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.name = name; mesh.position.set(position[0], position[1], position[2]); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  return mesh;
}
const galleryArt = [];
const textureLoader = new THREE.TextureLoader();
const roomWalls = ['#f2e3ca', '#efddd1', '#d9e7e4', '#f1e6cf', '#dce8d5', '#eadbc9'];
const roomFloors = ['#a78661', '#ad806d', '#7e9b91', '#a48f68', '#879a72', '#9d8068'];
for (let index = 0; index < memories.length; index++) {
  const item = memories[index];
  const roomGroup = new THREE.Group();
  roomGroup.name = `Memory room: ${item.short}`;
  roomGroup.visible = false;
  galleryGroup.add(roomGroup);
  roomGroups.push(roomGroup);
  const wall = mat(roomWalls[index % roomWalls.length]);
  const floor = mat(roomFloors[index % roomFloors.length]);
  roomBox(roomGroup, 'memory room floor', [16, 0.4, 16], [0, -0.35, 0], floor);
  roomBox(roomGroup, 'memory room photo wall', [16, 7.3, 0.5], [0, 3.45, -7.7], wall);
  roomBox(roomGroup, 'memory room left wall', [0.5, 7.3, 16], [-7.7, 3.45, 0], wall);
  // Leave a generous opening in the east wall so the player can follow the arch onward.
  roomBox(roomGroup, 'memory room right wall north', [0.5, 7.3, 6.1], [7.7, 3.45, -4.95], wall);
  roomBox(roomGroup, 'memory room right wall south', [0.5, 7.3, 6.1], [7.7, 3.45, 4.95], wall);
  roomBox(roomGroup, 'memory room right wall over arch', [0.5, 3.1, 3.8], [7.7, 5.55, 0], wall);
  roomBox(roomGroup, 'memory room entry left', [5.5, 7.3, 0.5], [-5.25, 3.45, 7.7], wall);
  roomBox(roomGroup, 'memory room entry right', [5.5, 7.3, 0.5], [5.25, 3.45, 7.7], wall);
  roomBox(roomGroup, 'memory room entry lintel', [5, 1, 0.5], [0, 6.95, 7.7], wall);
  roomCeilings.push(roomBox(roomGroup, 'memory room ceiling', [15.4, 0.35, 15.4], [0, 7.35, 0], mat('#f4e8d5')));

  // Warm rails and an actual stained-glass window give every memory its own calm little room.
  for (const y of [0.42, 5.7]) {
    roomBox(roomGroup, 'memory room north gold rail', [15.2, 0.12, 0.12], [0, y, -7.39], galleryTrim);
    roomBox(roomGroup, 'memory room west gold rail', [0.12, 0.12, 15.2], [-7.39, y, 0], galleryTrim);
    roomBox(roomGroup, 'memory room east gold rail north', [0.12, 0.12, 5.9], [7.39, y, -4.65], galleryTrim);
    roomBox(roomGroup, 'memory room east gold rail south', [0.12, 0.12, 5.9], [7.39, y, 4.65], galleryTrim);
  }
  roomBox(roomGroup, 'memory room window frame', [0.18, 3.5, 3.1], [-7.39, 4.1, 0.2], galleryTrim);
  for (let pane = 0; pane < 3; pane++) {
    roomBox(roomGroup, 'memory room stained-glass pane', [0.11, 0.98, 0.94], [-7.27, 4.1, -0.76 + pane * 0.96], windowGlassMats[(index + pane) % windowGlassMats.length]);
  }
  roomBox(roomGroup, 'memory room window center mullion', [0.11, 3.35, 0.12], [-7.19, 4.1, 0.2], galleryTrim);
  const roomLight = new THREE.HemisphereLight('#fff8e8', '#8f7758', 2.55); roomGroup.add(roomLight);
  const pictureLight = new THREE.PointLight('#fff0cc', 8.5, 10, 2); pictureLight.position.set(0, 4.8, -4.9); roomGroup.add(pictureLight);
  // A framed memory painting and its date plaque are unique to this room.
  const frameMaterial = new THREE.MeshStandardMaterial({ color: '#e0bd72', metalness: 0.52, roughness: 0.36, emissive: '#39280e', emissiveIntensity: 0.14 });
  const frame = roomBox(roomGroup, 'memory painting frame', [4.4, 3.45, 0.24], [0, 3.1, -7.18], frameMaterial);
  roomBox(roomGroup, 'memory painting liner', [4.12, 3.17, 0.08], [0, 3.1, -7.02], mat('#39291d'));
  const imageMaterial = new THREE.MeshBasicMaterial({ color: '#b8a783', side: THREE.DoubleSide });
  const picture = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 2.94), imageMaterial);
  picture.name = `Photo painting: ${item.short}`;
  picture.userData.memory = item;
  picture.position.set(0, 3.1, -6.96); roomGroup.add(picture);
  textureLoader.load(item.image, texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    imageMaterial.map = texture; imageMaterial.color.set('#ffffff'); imageMaterial.needsUpdate = true;
  }, undefined, () => { imageMaterial.color.set('#8d7760'); });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 1.35), new THREE.MeshBasicMaterial({ map: paintingPlaqueTexture(item), side: THREE.DoubleSide }));
  plaque.position.set(0, 0.82, -6.94); roomGroup.add(plaque);
  // Small reading bench and a pair of warm wall lamps make this feel like a lived-in room.
  roomBox(roomGroup, 'memory room bench seat', [2.6, 0.2, 0.62], [0, 0.72, 2.0], woodLight);
  for (const x of [-0.9, 0.9]) roomBox(roomGroup, 'memory room bench leg', [0.16, 0.68, 0.16], [x, 0.34, 2.0], galleryTrim);
  for (const x of [-5.5, 5.5]) {
    roomBox(roomGroup, 'memory room sconce plate', [0.13, 0.45, 0.32], [x, 4.0, -3.7], galleryTrim);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat('#ffe3ae', 0.25, { emissive: '#ffca76', emissiveIntensity: 1.1 }));
    lamp.position.set(x, 4.2, -3.45); roomGroup.add(lamp);
    const glow = new THREE.PointLight('#ffdcaa', 3.1, 8, 2);
    glow.position.set(x, 4.1, -3.2); roomGroup.add(glow);
  }
  const roomArt = { item, position: new THREE.Vector3(0, 0, -5.2), picture, frame, frameMaterial, imageMaterial, roomGroup, index };
  galleryArt.push(roomArt);

  // Side arch marks the route into the next memory, like a connected chapel aisle.
  const archPoints = [
    new THREE.Vector3(7.28, 0.35, -1.78),
    new THREE.Vector3(7.28, 2.85, -1.78),
    new THREE.Vector3(7.28, 3.85, -1.28),
    new THREE.Vector3(7.28, 4.12, 0),
    new THREE.Vector3(7.28, 3.85, 1.28),
    new THREE.Vector3(7.28, 2.85, 1.78),
    new THREE.Vector3(7.28, 0.35, 1.78),
  ];
  const arch = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPoints), 28, 0.12, 8, false), galleryTrim);
  arch.name = 'arched passage to next memory'; roomGroup.add(arch);
  roomBox(roomGroup, 'shadowed passage beyond side arch', [0.12, 3.8, 3.5], [7.9, 1.9, 0], galleryDark);
  const sideLeaves = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(7.28, 0, side * 1.72);
    hinge.rotation.y = side * 1.22;
    roomGroup.add(hinge);
    roomBox(hinge, 'open walnut side door leaf', [0.13, 3.35, 1.12], [0, 1.68, -side * 0.56], wood);
    roomBox(hinge, 'side door inset panel', [0.055, 2.62, 0.78], [-0.08, 1.68, -side * 0.56], woodLight);
    sideLeaves.push({ hinge, side });
  }
  portalDoorLeaves[index] = sideLeaves;
  const nextMemory = memories[index + 1];
  const portalPlaque = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, 0.82),
    new THREE.MeshBasicMaterial({ map: textTexture(nextMemory ? ['NEXT MEMORY', nextMemory.short] : ['BACK TO THE NAVE', 'CHURCH']), side: THREE.DoubleSide })
  );
  portalPlaque.rotation.y = -Math.PI / 2;
  portalPlaque.position.set(7.2, 4.8, 0); roomGroup.add(portalPlaque);
}

// The rear passage has a deep shadowed threshold and open double doors into the nave.
for (let index = 0; index < roomGroups.length; index++) {
  const roomGroup = roomGroups[index];
  roomBox(roomGroup, 'memory room exit stone surround', [3.2, 4.65, 0.2], [0, 2.45, 7.35], galleryTrim);
  roomBox(roomGroup, 'dark doorway beyond memory room', [2.84, 4.28, 0.09], [0, 2.38, 7.64], galleryDark);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.48, 0.18, 7.28), new THREE.Vector3(-1.48, 2.8, 7.28),
    new THREE.Vector3(-1.28, 3.65, 7.28), new THREE.Vector3(-0.72, 4.25, 7.28),
    new THREE.Vector3(0, 4.43, 7.28), new THREE.Vector3(0.72, 4.25, 7.28),
    new THREE.Vector3(1.28, 3.65, 7.28), new THREE.Vector3(1.48, 2.8, 7.28),
    new THREE.Vector3(1.48, 0.18, 7.28),
  ]);
  const arch = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, 0.12, 8, false), galleryTrim);
  arch.name = 'arched exit into the church'; roomGroup.add(arch);
  const leaves = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * 1.34, 0, 7.28);
    hinge.rotation.y = side * 1.22;
    roomGroup.add(hinge);
    const leaf = roomBox(hinge, 'open walnut exit door leaf', [1.25, 3.95, 0.13], [side < 0 ? 0.625 : -0.625, 2.05, 0], wood);
    const panel = roomBox(hinge, 'exit door raised panel', [0.88, 2.95, 0.06], [side < 0 ? 0.625 : -0.625, 2.05, -0.09], woodLight);
    leaf.castShadow = true; panel.castShadow = true;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), galleryTrim);
    knob.position.set(side < 0 ? 1.05 : -1.05, 1.58, -0.12); hinge.add(knob);
    leaves.push({ hinge, side });
  }
  galleryExitDoors[index] = leaves;
}

// Rigged, animated woman model (bundled locally); retain a soft ground shadow.
const avatar = new THREE.Group(); scene.add(avatar);
const avatarShadow = new THREE.Mesh(new THREE.CircleGeometry(0.68, 24), new THREE.MeshBasicMaterial({ color: '#120e0a', transparent: true, opacity: 0.4 }));
avatarShadow.rotation.x = -Math.PI / 2; avatarShadow.position.y = 0.004; avatar.add(avatarShadow);
let avatarMixer = null;
let avatarModel = null;
let idleAction = null;
let walkAction = null;
let backwardAction = null;
let previousLocomotion = 'idle';
let previousGalleryMode = false;
new GLTFLoader().load('/models/animated-woman.glb', gltf => {
  const model = gltf.scene;
  avatarModel = model;
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = 2.45 / size.y;
  model.scale.setScalar(scale);
  model.position.y = -bounds.min.y * scale;
  model.userData.groundOffset = model.position.y;
  model.rotation.y = Math.PI;
  model.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true; object.receiveShadow = true;
    if (object.material) {
      object.material.side = THREE.DoubleSide;
      object.material.needsUpdate = true;
    }
  });
  avatar.add(model);
  avatarMixer = new THREE.AnimationMixer(model);
  const sitAngles = new Map([
    ['upperleg.l', -1.32], ['upperleg.r', -1.32],
    ['lowerleg.l', -1.48], ['lowerleg.r', -1.48],
    ['foot.l', 0.2], ['foot.r', 0.2],
  ]);
  model.traverse(object => {
    if (!object.isBone) return;
    const angle = sitAngles.get(object.name.toLowerCase());
    if (angle === undefined) return;
    sittingBones.push({
      bone: object,
      rest: object.quaternion.clone(),
      target: object.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle)),
    });
  });
  const idleClip = gltf.animations.find(clip => clip.name.toLowerCase().includes('idle_neutral'))
    || gltf.animations.find(clip => clip.name.toLowerCase().includes('idle'));
  const walkClip = gltf.animations.find(clip => clip.name.toLowerCase().includes('|walk'))
    || gltf.animations.find(clip => clip.name.toLowerCase().includes('walk'));
  const backClip = gltf.animations.find(clip => clip.name.toLowerCase().includes('|run_back'))
    || gltf.animations.find(clip => clip.name.toLowerCase().includes('run_back'));
  const sitClip = gltf.animations.find(clip => clip.name.toLowerCase().includes('sit'));
  if (idleClip) { idleAction = avatarMixer.clipAction(idleClip); idleAction.reset().play(); }
  if (walkClip) {
    walkAction = avatarMixer.clipAction(walkClip);
  }
  if (backClip) {
    backwardAction = avatarMixer.clipAction(backClip);
  }
  if (sitClip) sitAction = avatarMixer.clipAction(sitClip);
}, undefined, error => {
  console.error('Could not load the bundled character model.', error);
  errorPanel.hidden = false;
  errorPanel.textContent = 'The character model could not load. Refresh the game to retry.';
});

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = inGallery ? (h > w ? 72 : 52) : (h > w ? 62 : 52);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

function collides(x, z) {
  if (inGallery) {
    const inSideArch = x > 5.45 && Math.abs(z) < 1.72;
    if (x < -6.95 || (x > 6.95 && (!inSideArch || x > 7.55)) || z < -6.7 || z > 6.55) return true;
    return galleryObstacles.some(o => Math.abs(x - o.x) < o.rx && Math.abs(z - o.z) < o.rz);
  }
  if (z > 14.2) {
    if (x < -19 || x > 19 || z > 56) return true;
    return outsideObstacles.some(o => Math.abs(x - o.x) < o.rx && Math.abs(z - o.z) < o.rz);
  }
  if (x < -8.75 || x > 8.85 || z < -13.1 || z > 15.15) return true;
  return obstacles.some(o => Math.abs(x - o.x) < o.rx && Math.abs(z - o.z) < o.rz);
}

function chooseNearest() {
  let best = 2.1;
  nearestMemory = null;
  for (const entry of doorGroups) {
    const d = Math.hypot(player.x - entry.position.x, player.z - entry.position.z);
    if (d < best) { best = d; nearestMemory = entry; }
  }
  let seatDistance = 1.9;
  nearestSeat = null;
  if (!isSitting) for (const seat of sitSpots) {
    const onCorrectSide = seat.kind === 'garden' ? player.z > 14.2 : player.z <= 14.2;
    if (!onCorrectSide) continue;
    const distance = Math.hypot(player.x - seat.approachX, player.z - seat.approachZ);
    if (distance < seatDistance) { seatDistance = distance; nearestSeat = seat; }
  }
  if (isSitting) {
    prompt.textContent = 'Press E / A or move to stand up';
    prompt.classList.add('show');
  } else if (nearestSeat) {
    prompt.textContent = 'Press E / A to sit';
    prompt.classList.add('show');
  } else if (player.z > 14.2) {
    prompt.textContent = player.z < 18.5
      ? entranceDoorProgress < 0.82 ? 'The church doors are opening · Keep walking forward' : 'Walk through the open doors into the church'
      : 'Follow the garden path to the church';
    prompt.classList.add('show');
  } else {
    prompt.textContent = nearestMemory ? `Press E / A to open · ${nearestMemory.item.date}` : '';
    prompt.classList.toggle('show', !!nearestMemory && !inGallery);
  }
}

function updateGalleryDetails() {
  let bestDistance = 2.35;
  nearestPainting = null;
  for (const artwork of galleryArt) {
    if (artwork.index !== currentRoomIndex) continue;
    const distance = Math.hypot(player.x - artwork.position.x, player.z - artwork.position.z);
    if (distance < bestDistance) { bestDistance = distance; nearestPainting = artwork; }
  }
  for (const artwork of galleryArt) {
    const focused = artwork === nearestPainting;
    artwork.frameMaterial.emissiveIntensity = focused ? 0.8 : 0.16;
    artwork.frame.scale.set(1, focused ? 1.035 : 1, 1);
  }

  const nearExit = Math.hypot(player.x - exitPosition.x, player.z - exitPosition.z) < 1.85;
  const nearNextRoom = player.x > 5.1 && Math.abs(player.z) < 2.0;
  prompt.textContent = nearExit
    ? 'E / A or B / Escape · Return to church'
    : nearNextRoom ? (currentRoomIndex < memories.length - 1
      ? `Follow the arch · E / A · Next: ${memories[currentRoomIndex + 1].short}`
      : 'Follow the arch · E / A · Return to church')
    : nearestPainting ? `Reading · ${nearestPainting.item.short}` : '';
  prompt.classList.toggle('show', nearExit || nearNextRoom || !!nearestPainting);
}

function openPainting(item) {
  if (!item || readingMemory) return;
  readingMemory = item;
  document.querySelector('#readingImage').src = item.image;
  document.querySelector('#readingImage').alt = `${item.short} memory photo`;
  document.querySelector('#readingDate').textContent = item.date;
  document.querySelector('#readingTitle').textContent = item.title;
  document.querySelector('#readingStory').textContent = item.story;
  readingPanel.setAttribute('aria-hidden', 'false');
  readingPanel.classList.add('open');
  prompt.classList.remove('show');
  readingClose.focus({ preventScroll: true });
}

function closePainting() {
  if (!readingMemory) return;
  readingMemory = null;
  readingPanel.classList.remove('open');
  readingPanel.setAttribute('aria-hidden', 'true');
  if (inGallery) updateGalleryDetails();
}

function standUp() {
  if (sittingSpot) {
    player.x = sittingSpot.approachX;
    player.z = sittingSpot.approachZ;
  }
  isSitting = false;
  sittingSpot = null;
}
readingClose.addEventListener('click', closePainting);
readingPanel.addEventListener('click', event => { if (event.target === readingPanel) closePainting(); });

function cameraPose() {
  const yaw = cameraYawOffset;
  const pitchLift = Math.sin(cameraPitch);
  if (inGallery) {
    if (player.z > 3.8) {
      // Turn the follow view toward the gallery exit so the return door stays visible.
      return {
        position: new THREE.Vector3(player.x + Math.sin(yaw) * 4.8, 5.6 - pitchLift * 3, player.z - Math.cos(yaw) * 4.8),
        target: new THREE.Vector3(player.x - Math.sin(yaw) * 1.7, 1.9 + pitchLift * 2, exitPosition.z),
      };
    }
    return {
      position: new THREE.Vector3(player.x + Math.sin(yaw) * 6.2, 5.7 - pitchLift * 5.2, player.z + Math.cos(yaw) * 6.2),
      target: new THREE.Vector3(player.x - Math.sin(yaw) * 2.0, 1.85 + pitchLift * 3.4, player.z - Math.cos(yaw) * 3.4),
    };
  }
  const navePose = {
    position: new THREE.Vector3(player.x * 0.48 + Math.sin(yaw) * 11.5, 6.4 - pitchLift * 8.5, player.z + Math.cos(yaw) * 11.5),
    target: new THREE.Vector3(player.x * 0.35 - Math.sin(yaw) * 4.4, 1.2 + pitchLift * 4.2, player.z - Math.cos(yaw) * 4.4),
  };
  const gardenPose = {
    position: new THREE.Vector3(player.x * 0.35 + Math.sin(yaw) * 10.5, 6.7 - pitchLift * 5.5, player.z + Math.cos(yaw) * 10.5),
    target: new THREE.Vector3(player.x * 0.22 - Math.sin(yaw) * 3.1, 1.45 + pitchLift * 2.6, player.z - Math.cos(yaw) * 7.2),
  };
  return {
    position: navePose.position.clone().lerp(gardenPose.position, churchViewBlend),
    target: navePose.target.clone().lerp(gardenPose.target, churchViewBlend),
  };
}

function snapCamera() {
  const pose = cameraPose();
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
}

function enterGallery(entry) {
  if (!entry || inGallery || transitioning) return;
  transitioning = true;
  savedChapelPosition = { x: player.x, z: player.z, yaw: player.yaw };
  prompt.classList.remove('show');
  const fromTarget = cameraPose().target;
  cameraTransition = {
    startedAt: performance.now(), duration: 1050,
    fromPosition: camera.position.clone(), fromTarget,
    toPosition: new THREE.Vector3(7.0, 2.8, entry.item.z + 2.0),
    toTarget: new THREE.Vector3(8.98, 2.25, entry.item.z),
    doorLeaf: entry.doorLeaf, covered: false,
    onComplete: () => {
    churchGroup.visible = false;
    gardenGroup.visible = false;
    exteriorGroup.visible = false;
    galleryGroup.visible = true;
    inGallery = true;
    cameraYawOffset = 0; cameraPitch = 0;
    const index = memories.indexOf(entry.item);
    currentRoomIndex = index;
    roomGroups.forEach((room, roomIndex) => { room.visible = roomIndex === index; });
    galleryCeiling = roomCeilings[index];
    player.x = 0;
    player.z = 0.2;
    player.yaw = 0;
    nearestMemory = null;
    nearestPainting = null;
    updateGalleryDetails();
    scene.background.copy(galleryBackground);
    scene.fog = galleryFog;
    snapCamera();
    transitioning = false;
    fade.classList.remove('on');
    },
  };
}

function returnToChapel() {
  if (!inGallery || transitioning) return;
  transitioning = true;
  prompt.classList.remove('show');
  const fromTarget = cameraPose().target;
  cameraTransition = {
    startedAt: performance.now(), duration: 920,
    fromPosition: camera.position.clone(), fromTarget,
    toPosition: new THREE.Vector3(0, 2.45, 4.25),
    toTarget: new THREE.Vector3(0, 2.0, 7.6),
    exitLeaves: galleryExitDoors[currentRoomIndex] || [], covered: false,
    onComplete: () => {
    galleryGroup.visible = false;
    roomGroups.forEach(room => { room.visible = false; });
    churchGroup.visible = true;
    gardenGroup.visible = true;
    inGallery = false;
    cameraPitch = 0;
    if (savedChapelPosition) {
      player.x = savedChapelPosition.x; player.z = savedChapelPosition.z; player.yaw = savedChapelPosition.yaw;
    }
    for (const entry of doorGroups) entry.doorLeaf.rotation.y = 0;
    cameraYawOffset = player.yaw;
    savedChapelPosition = null;
    scene.background.copy(chapelBackground);
    scene.fog = chapelFog;
    snapCamera();
    transitioning = false;
    fade.classList.remove('on');
    chooseNearest();
    },
  };
}

function enterNextMemory() {
  if (!inGallery || transitioning) return;
  if (currentRoomIndex >= memories.length - 1) { returnToChapel(); return; }
  transitioning = true;
  prompt.classList.remove('show');
  const fromTarget = cameraPose().target;
  cameraTransition = {
    startedAt: performance.now(), duration: 900,
    fromPosition: camera.position.clone(), fromTarget,
    toPosition: new THREE.Vector3(6.7, 2.8, 2.0),
    toTarget: new THREE.Vector3(8.0, 2.15, 0),
    portalLeaves: portalDoorLeaves[currentRoomIndex] || [], covered: false,
    onComplete: () => {
    roomGroups[currentRoomIndex].visible = false;
    currentRoomIndex += 1;
    roomGroups[currentRoomIndex].visible = true;
    galleryCeiling = roomCeilings[currentRoomIndex];
    player.x = -5.7; player.z = 0; player.yaw = 0;
    cameraYawOffset = 0; cameraPitch = 0;
    nearestPainting = null;
    updateGalleryDetails();
    snapCamera();
    transitioning = false;
    fade.classList.remove('on');
    },
  };
}

addEventListener('keydown', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (k === 'Escape' || k === 'Backspace') {
    if (readingMemory) closePainting();
    else if (inGallery) returnToChapel();
    return;
  }
  if (k === 'e' || e.key === ' ') interactQueued = true;
  keys.add(k);
});
addEventListener('keyup', e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener('blur', () => { keys.clear(); touchDirections.clear(); });

document.querySelectorAll('.pad-button').forEach(button => {
  const direction = button.dataset.dir;
  button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); touchDirections.add(direction); });
  const release = () => touchDirections.delete(direction);
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
});
document.querySelector('#touchAction').addEventListener('pointerdown', e => { e.preventDefault(); interactQueued = true; });

function pickPainting(clientX, clientY) {
  if (!inGallery || transitioning || readingMemory) return;
  const bounds = canvas.getBoundingClientRect();
  pointerNdc.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
  pointerNdc.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  const visibleArt = galleryArt.filter(art => art.index === currentRoomIndex);
  const hit = raycaster.intersectObjects(visibleArt.map(art => art.picture), false)[0];
  if (hit?.object.userData.memory) openPainting(hit.object.userData.memory);
}

canvas.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  activeDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!activeDrag || activeDrag.id !== event.pointerId) return;
  const dx = event.clientX - activeDrag.lastX;
  const dy = event.clientY - activeDrag.lastY;
  if (Math.hypot(event.clientX - activeDrag.x, event.clientY - activeDrag.y) > 5) activeDrag.moved = true;
  if (activeDrag.moved) {
    cameraYawOffset = THREE.MathUtils.euclideanModulo(cameraYawOffset + dx * 0.006 + Math.PI, Math.PI * 2) - Math.PI;
    cameraPitch = THREE.MathUtils.clamp(cameraPitch - dy * 0.003, -0.12, 0.12);
  }
  activeDrag.lastX = event.clientX; activeDrag.lastY = event.clientY;
});
canvas.addEventListener('pointerup', event => {
  if (!activeDrag || activeDrag.id !== event.pointerId) return;
  const drag = activeDrag; activeDrag = null;
  if (!drag.moved) pickPainting(event.clientX, event.clientY);
});
canvas.addEventListener('pointercancel', () => { activeDrag = null; });

function readInput() {
  let x = 0, z = 0;
  if (keys.has('ArrowLeft') || keys.has('a') || touchDirections.has('left')) x -= 1;
  if (keys.has('ArrowRight') || keys.has('d') || touchDirections.has('right')) x += 1;
  if (keys.has('ArrowUp') || keys.has('w') || touchDirections.has('up')) z -= 1;
  if (keys.has('ArrowDown') || keys.has('s') || touchDirections.has('down')) z += 1;
  const gamepads = navigator.getGamepads?.() || [];
  // GamepadList is array-like, but some Android WebViews do not make it iterable.
  let pad = null;
  for (let index = 0; index < (gamepads.length || 0); index++) {
    const candidate = gamepads[index] || gamepads.item?.(index);
    if (candidate) { pad = candidate; break; }
  }
  if (pad) {
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    const stickLength = Math.hypot(ax, ay);
    if (stickLength > 0.18) {
      const strength = Math.min(1, (stickLength - 0.18) / 0.82);
      x += (ax / stickLength) * strength;
      z += (ay / stickLength) * strength;
    }
    if (pad.buttons[14]?.pressed) x -= 1;
    if (pad.buttons[15]?.pressed) x += 1;
    if (pad.buttons[12]?.pressed) z -= 1;
    if (pad.buttons[13]?.pressed) z += 1;
    const a = !!pad.buttons[0]?.pressed, b = !!pad.buttons[1]?.pressed;
    if (a && !lastPadButtons.get(`${pad.index}:a`)) interactQueued = true;
    if (b && !lastPadButtons.get(`${pad.index}:b`)) {
      if (readingMemory) closePainting();
      else if (inGallery) returnToChapel();
    }
    lastPadButtons.set(`${pad.index}:a`, a); lastPadButtons.set(`${pad.index}:b`, b);
  }
  // Keep movement aligned with the view after the player swipes to look around.
  const cameraRelativeX = Math.cos(cameraYawOffset) * x + Math.sin(cameraYawOffset) * z;
  const cameraRelativeZ = -Math.sin(cameraYawOffset) * x + Math.cos(cameraYawOffset) * z;
  x = cameraRelativeX;
  z = cameraRelativeZ;
  const length = Math.hypot(x, z);
  if (length > 1) { x /= length; z /= length; }
  return { x, z };
}

function update(dt) {
  moving = false;
  movingBackward = false;
  actualMovementSpeed = 0;
  if (transitioning) return;
  const { x, z } = readInput();
  if (transitioning) return;
  if (readingMemory) { interactQueued = false; return; }
  if (isSitting && (x || z)) standUp();
  if (x || z) {
    const beforeX = player.x, beforeZ = player.z;
    const nextX = player.x + x * player.speed * dt;
    const nextZ = player.z + z * player.speed * dt;
    if (!collides(nextX, player.z)) player.x = nextX;
    if (!collides(player.x, nextZ)) player.z = nextZ;
    moving = Math.hypot(player.x - beforeX, player.z - beforeZ) > 0.001;
    if (moving) {
      actualMovementSpeed = Math.hypot(player.x - beforeX, player.z - beforeZ) / Math.max(dt, 0.001);
      const desiredYaw = Math.atan2(-x, -z);
      const turn = Math.atan2(Math.sin(desiredYaw - player.yaw), Math.cos(desiredYaw - player.yaw));
      movingBackward = Math.abs(turn) > Math.PI * 0.75;
      if (!movingBackward) player.yaw = desiredYaw;
      player.walk += dt * 10;
    }
  }
  outsideChurch = !inGallery && player.z > 14.2;
  const approachingChurchEntrance = !inGallery && player.z < 23 && player.z > 7.5 && Math.abs(player.x) < 5.8;
  entranceDoorProgress = THREE.MathUtils.damp(entranceDoorProgress, approachingChurchEntrance ? 1 : 0, 4.8, dt);
  if (inGallery) updateGalleryDetails();
  else chooseNearest();
  if (interactQueued) {
    if (inGallery) {
      if (Math.hypot(player.x - exitPosition.x, player.z - exitPosition.z) < 1.85) returnToChapel();
      else if (player.x > 5.1 && Math.abs(player.z) < 2.0) enterNextMemory();
      else if (nearestPainting) openPainting(nearestPainting.item);
      else if (!nearestPainting) { prompt.textContent = 'Follow the arched wall to the next memory, or approach the painting to read its story'; prompt.classList.add('show'); setTimeout(() => { if (!nearestPainting) prompt.classList.remove('show'); }, 1400); }
    } else if (isSitting) { standUp(); chooseNearest(); }
    else if (nearestSeat) {
      player.x = nearestSeat.x;
      player.z = nearestSeat.z;
      player.yaw = 0;
      isSitting = true;
      sittingSpot = nearestSeat;
      nearestSeat = null;
      chooseNearest();
    } else if (nearestMemory) enterGallery(nearestMemory);
    else { prompt.textContent = 'Walk closer to a memory door'; prompt.classList.add('show'); setTimeout(() => { if (!nearestMemory) prompt.classList.remove('show'); }, 1100); }
    interactQueued = false;
  }
}

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000 || 0, 0.04); lastTime = now;
  update(dt);
  if (inGallery !== previousGalleryMode) {
    camera.fov = inGallery ? (innerHeight > innerWidth ? 72 : 52) : (innerHeight > innerWidth ? 62 : 52);
    camera.updateProjectionMatrix();
    previousGalleryMode = inGallery;
  }
  if (outsideChurch !== previousOutsideChurch) previousOutsideChurch = outsideChurch;
  churchViewBlend = THREE.MathUtils.damp(churchViewBlend, outsideChurch ? 1 : 0, 3.8, dt);
  if (!inGallery) {
    scene.fog = chapelFog;
    scene.background.copy(chapelBackground).lerp(gardenBackground, churchViewBlend);
    chapelFog.color.copy(chapelFogColor).lerp(gardenFog.color, churchViewBlend);
    chapelFog.near = THREE.MathUtils.lerp(chapelFogNear, gardenFog.near, churchViewBlend);
    chapelFog.far = THREE.MathUtils.lerp(chapelFogFar, gardenFog.far, churchViewBlend);
  }
  for (const entry of entranceDoorHinges) entry.hinge.rotation.y = entry.side * entranceDoorProgress * 1.28;
  exteriorGroup.visible = outsideChurch && !inGallery;
  churchGroup.visible = !inGallery;
  gardenGroup.visible = !inGallery;
  const onFrontSteps = player.z >= 15.8 && player.z <= 17.8 && Math.abs(player.x) < 3.2;
  const onGardenPath = outsideChurch && Math.abs(player.x) < 2.35 && player.z > 17.8;
  const groundY = inGallery ? -0.15 : outsideChurch ? (onFrontSteps ? (player.z < 16.7 ? 0.08 : -0.035) : onGardenPath ? -0.12 : -0.2) : -0.13;
  avatar.position.set(player.x, groundY, player.z);
  avatar.rotation.y = player.yaw;
  if (avatarMixer) {
    const locomotion = isSitting ? 'sit' : moving ? (movingBackward && backwardAction ? 'back' : 'walk') : 'idle';
    const nextAction = locomotion === 'sit' ? (sitAction || idleAction) : locomotion === 'back' ? backwardAction : locomotion === 'walk' ? walkAction : idleAction;
    if (nextAction && locomotion !== previousLocomotion) {
      const currentAction = previousLocomotion === 'sit' ? (sitAction || idleAction) : previousLocomotion === 'back' ? backwardAction : previousLocomotion === 'walk' ? walkAction : idleAction;
      // Fade weights multiply the action's base weight; reset it to 1 before fading in.
      nextAction.reset().setEffectiveWeight(1);
      if (nextAction === walkAction) nextAction.time = WALK_CONTACT_START_TIME;
      if (nextAction === backwardAction) nextAction.time = BACK_CONTACT_START_TIME;
      nextAction.play();
      if (currentAction && currentAction !== nextAction) currentAction.crossFadeTo(nextAction, 0.2, false);
      else nextAction.setEffectiveWeight(1);
      previousLocomotion = locomotion;
    }
    if (moving) {
      const gaitAction = locomotion === 'back' ? backwardAction : walkAction;
      const stanceSpeed = locomotion === 'back' ? BACK_STANCE_SPEED_AT_BASE_RATE : WALK_STANCE_SPEED_AT_BASE_RATE;
      if (gaitAction) gaitAction.setEffectiveTimeScale(THREE.MathUtils.clamp(actualMovementSpeed / stanceSpeed, 0.1, 3));
    }
    avatarMixer.update(dt);
    sitBlend = THREE.MathUtils.damp(sitBlend, isSitting ? 1 : 0, 7, dt);
    if (avatarModel) avatarModel.position.y = avatarModel.userData.groundOffset - 0.34 * sitBlend;
    if (sitBlend > 0.001) for (const entry of sittingBones) entry.bone.quaternion.slerp(entry.target, sitBlend);
  }
  if (cameraTransition) {
    const transition = cameraTransition;
    const progress = Math.min(1, (now - transition.startedAt) / transition.duration);
    const eased = progress * progress * (3 - 2 * progress);
    camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
    const target = new THREE.Vector3().lerpVectors(transition.fromTarget, transition.toTarget, eased);
    camera.lookAt(target);
    if (transition.doorLeaf) transition.doorLeaf.rotation.y = -1.5 * Math.min(1, eased / 0.72);
    if (transition.portalLeaves) for (const leaf of transition.portalLeaves) leaf.hinge.rotation.y = leaf.side * (1.22 + 0.28 * eased);
    if (transition.exitLeaves) for (const leaf of transition.exitLeaves) leaf.hinge.rotation.y = leaf.side * (1.22 + 0.28 * eased);
    if (!transition.covered && progress >= 0.58) {
      transition.covered = true;
      fade.classList.add('on');
    }
    if (progress >= 1) {
      cameraTransition = null;
      transition.onComplete();
    }
  } else {
    const pose = cameraPose();
    camera.position.lerp(pose.position, 1 - Math.exp(-dt * 3.4));
    camera.lookAt(pose.target);
  }
  vault.visible = camera.position.y < 7.35;
  if (galleryCeiling) galleryCeiling.visible = !inGallery || camera.position.y < 6.95;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

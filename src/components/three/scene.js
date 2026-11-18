// The little 3D neighbourhood on the landing and login pages: a floating island, six
// houses with a job pin over each, and a crew van that drives the loop finishing jobs.
// Plain three.js, loaded only when a page shows it (see CrewScene.jsx).
import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Raycaster,
  RingGeometry,
  Scene,
  SphereGeometry,
  Vector2,
  WebGLRenderer,
} from "three";

const TAU = Math.PI * 2;
const ROAD_RADIUS = 3.1;
const HOUSE_RADIUS = 4.25;
const VAN_SPEED = 0.55; // radians a second
const STOP_SECONDS = 0.7;
const RESET_SECONDS = 2.8;

// What each job is worth, in dollars, and the house it is at.
const JOBS = [
  { price: 180, wall: 0xfff1e0, roof: 0xff7a59 },
  { price: 240, wall: 0xffdbe7, roof: 0x7c5cff },
  { price: 320, wall: 0xdcecff, roof: 0xff5c8a },
  { price: 150, wall: 0xfff3b8, roof: 0x2fbf9f },
  { price: 420, wall: 0xe6dcff, roof: 0xffb020 },
  { price: 275, wall: 0xd8f5e3, roof: 0x5b3df5 },
];

const PIN_TODO = new Color(0x7c5cff);
const PIN_DONE = new Color(0xa6e22e);

const LOOK = {
  light: {
    hemiSky: 0xffffff, hemiGround: 0xc9b8ff, hemi: 1.5,
    sun: 0xfff0d2, sunPower: 2.4,
    windows: 0x000000, windowGlow: 0,
    orb: 0xffd95e, headlights: 0,
  },
  dark: {
    hemiSky: 0x7f8cff, hemiGround: 0x1a1433, hemi: 0.75,
    sun: 0xa9b8ff, sunPower: 1.1,
    windows: 0xffc96b, windowGlow: 1.8,
    orb: 0xe9ecff, headlights: 6,
  },
};

// The same "random" layout every time.
function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function solid(color, extra) {
  return new MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });
}

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const made = new Mesh(geometry, material);
  made.position.set(x, y, z);
  made.castShadow = true;
  made.receiveShadow = true;
  return made;
}

function buildIsland() {
  const island = new Group();
  const grass = mesh(new CylinderGeometry(5, 4.7, 0.5, 44), solid(0x7fd67a), 0, -0.25, 0);
  grass.castShadow = false;
  island.add(grass);
  const earth = mesh(new ConeGeometry(4.7, 3.4, 9), solid(0x8a5a44), 0, -2.2, 0);
  earth.rotation.x = Math.PI;
  earth.castShadow = false;
  island.add(earth);
  const tip = mesh(new ConeGeometry(2.2, 2.4, 7), solid(0x6f4636), 0.6, -3.3, -0.4);
  tip.rotation.x = Math.PI;
  tip.castShadow = false;
  island.add(tip);

  const road = mesh(new RingGeometry(2.7, 3.5, 72), solid(0x4b4568, { roughness: 1 }), 0, 0.012, 0);
  road.rotation.x = -Math.PI / 2;
  road.castShadow = false;
  island.add(road);
  const dashGeometry = new BoxGeometry(0.07, 0.012, 0.3);
  const dashMaterial = solid(0xf6f3ff);
  for (let index = 0; index < 22; index += 1) {
    const angle = (index / 22) * TAU;
    const dash = mesh(dashGeometry, dashMaterial, Math.cos(angle) * ROAD_RADIUS, 0.02, Math.sin(angle) * ROAD_RADIUS);
    dash.rotation.y = -angle;
    dash.castShadow = false;
    island.add(dash);
  }

  const pond = mesh(new CircleGeometry(1.05, 28), solid(0x66c8ff, { roughness: 0.15, flatShading: false }), -0.3, 0.014, 0.2);
  pond.rotation.x = -Math.PI / 2;
  pond.castShadow = false;
  island.add(pond);
  return island;
}

function buildTree(random) {
  const tree = new Group();
  const height = 0.7 + random() * 0.5;
  tree.add(mesh(new CylinderGeometry(0.06, 0.08, 0.3, 6), solid(0x7a4b33), 0, 0.15, 0));
  const leaves = solid(random() > 0.5 ? 0x2fa66a : 0x45bf6c);
  tree.add(mesh(new ConeGeometry(0.34, height, 7), leaves, 0, 0.3 + height / 2, 0));
  tree.add(mesh(new ConeGeometry(0.24, height * 0.7, 7), leaves, 0, 0.55 + height * 0.65, 0));
  return tree;
}

function buildHouse(job, windowMaterial) {
  const house = new Group();
  house.add(mesh(new BoxGeometry(1, 0.75, 0.9), solid(job.wall), 0, 0.375, 0));
  const roof = mesh(new ConeGeometry(0.86, 0.55, 4), solid(job.roof), 0, 1.02, 0);
  roof.rotation.y = Math.PI / 4;
  house.add(roof);
  house.add(mesh(new BoxGeometry(0.2, 0.36, 0.04), solid(0x6b4a3a), 0, 0.18, 0.455));
  house.add(mesh(new BoxGeometry(0.2, 0.2, 0.04), windowMaterial, -0.31, 0.44, 0.455));
  house.add(mesh(new BoxGeometry(0.2, 0.2, 0.04), windowMaterial, 0.31, 0.44, 0.455));
  house.add(mesh(new BoxGeometry(0.14, 0.34, 0.14), solid(0x9a6b57), 0.27, 1.05, -0.12));
  // The path from the door to the road.
  const path = mesh(new BoxGeometry(0.24, 0.012, 0.42), solid(0xe9e2d0), 0, 0.016, 0.62);
  path.castShadow = false;
  house.add(path);
  return house;
}

function buildPin() {
  const pin = new Group();
  const material = solid(PIN_TODO, { emissive: PIN_TODO.clone(), emissiveIntensity: 0.35, roughness: 0.4 });
  pin.add(mesh(new SphereGeometry(0.2, 16, 12), material, 0, 0.22, 0));
  const point = mesh(new ConeGeometry(0.15, 0.3, 12), material, 0, -0.02, 0);
  point.rotation.x = Math.PI;
  pin.add(point);
  pin.add(mesh(new SphereGeometry(0.07, 10, 8), new MeshBasicMaterial({ color: 0xffffff }), 0, 0.24, 0.16));
  pin.traverse((part) => {
    part.castShadow = false;
  });
  return { pin, material };
}

function buildVan() {
  const van = new Group();
  van.add(mesh(new BoxGeometry(0.52, 0.3, 1), solid(0x5b3df5), 0, 0.3, 0));
  van.add(mesh(new BoxGeometry(0.5, 0.26, 0.64), solid(0xffffff), 0, 0.57, -0.17));
  van.add(mesh(new BoxGeometry(0.44, 0.19, 0.03), solid(0x1c1840, { roughness: 0.2 }), 0, 0.57, 0.155));
  van.add(mesh(new BoxGeometry(0.54, 0.05, 0.66), solid(0xa6e22e), 0, 0.46, -0.17));
  // A ladder on the roof.
  van.add(mesh(new BoxGeometry(0.2, 0.03, 0.6), solid(0xffb020), 0, 0.72, -0.17));
  const wheelGeometry = new CylinderGeometry(0.11, 0.11, 0.08, 12);
  const wheelMaterial = solid(0x1b1830);
  for (const [x, z] of [[-0.27, 0.3], [0.27, 0.3], [-0.27, -0.3], [0.27, -0.3]]) {
    const wheel = mesh(wheelGeometry, wheelMaterial, x, 0.11, z);
    wheel.rotation.z = Math.PI / 2;
    van.add(wheel);
  }
  const lamps = new MeshStandardMaterial({ color: 0xfff6c9, emissive: 0xffe9a3, emissiveIntensity: 1.2 });
  van.add(mesh(new BoxGeometry(0.1, 0.07, 0.02), lamps, -0.17, 0.3, 0.505));
  van.add(mesh(new BoxGeometry(0.1, 0.07, 0.02), lamps, 0.17, 0.3, 0.505));
  const beam = new PointLight(0xffe9a3, 0, 3.2, 1.6);
  beam.position.set(0, 0.32, 0.85);
  van.add(beam);
  return { van, beam };
}

function buildCloud(random) {
  const cloud = new Group();
  const material = new MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 });
  for (let index = 0; index < 4; index += 1) {
    const puff = new Mesh(new IcosahedronGeometry(0.35 + random() * 0.3, 0), material);
    puff.position.set(index * 0.42 - 0.6, random() * 0.18, random() * 0.3);
    cloud.add(puff);
  }
  return cloud;
}

function buildStars(random) {
  const points = [];
  for (let index = 0; index < 160; index += 1) {
    const angle = random() * TAU;
    const height = random() * 0.9 - 0.25;
    const distance = 17 + random() * 8;
    const flat = Math.sqrt(1 - height * height);
    points.push(Math.cos(angle) * flat * distance, height * distance, Math.sin(angle) * flat * distance - 6);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
  return new Points(geometry, new PointsMaterial({ color: 0xffffff, size: 0.13, transparent: true, opacity: 0.9 }));
}

// canvas: where to draw. variant: "hero" or "auth" (a closer camera).
// onProgress({ done, total, earned }) runs whenever a job is finished or the day starts over.
// Returns { setTheme("light" | "dark"), dispose() }. Throws if WebGL is not available.
export function createCrewScene(canvas, { variant = "hero", onProgress, reducedMotion = false } = {}) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  canvas.style.touchAction = "pan-y";

  const random = seeded(7);
  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 100);
  const cameraHome = variant === "auth" ? [0, 6.2, 12.4] : [0, 7.4, 13];

  const hemi = new HemisphereLight(0xffffff, 0xc9b8ff, 1.5);
  scene.add(hemi);
  const sun = new DirectionalLight(0xfff0d2, 2.4);
  sun.position.set(-6, 10, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0015;
  scene.add(sun);

  // The sun by day, the moon by night.
  const orbMaterial = new MeshBasicMaterial({ color: 0xffd95e });
  const orb = new Mesh(new SphereGeometry(0.9, 24, 16), orbMaterial);
  orb.position.set(-7.5, 6.2, -9);
  scene.add(orb);
  const stars = buildStars(random);
  scene.add(stars);

  const world = new Group();
  scene.add(world);
  world.add(buildIsland());

  const windowMaterial = new MeshStandardMaterial({ color: 0xbfe3ff, emissive: 0x000000, roughness: 0.3 });
  const jobs = JOBS.map((job, index) => {
    const angle = (index / JOBS.length) * TAU + Math.PI / 6;
    const x = Math.cos(angle) * HOUSE_RADIUS;
    const z = Math.sin(angle) * HOUSE_RADIUS;
    const house = buildHouse(job, windowMaterial);
    house.position.set(x, 0, z);
    house.rotation.y = Math.atan2(-x, -z); // the door faces the road
    house.userData.job = index;
    world.add(house);

    const { pin, material } = buildPin();
    pin.position.set(x, 1.75, z);
    pin.userData.job = index;
    world.add(pin);

    const ringMaterial = new MeshBasicMaterial({ color: PIN_DONE, transparent: true, opacity: 0, depthWrite: false });
    const ring = new Mesh(new RingGeometry(0.5, 0.62, 40), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x * 0.93, 0.05, z * 0.93);
    ring.visible = false;
    world.add(ring);

    return { ...job, angle, house, pin, pinMaterial: material, ring, ringMaterial, done: false, pop: 0, wave: 1, hover: 0 };
  });

  // Trees between the houses and around the pond.
  for (let index = 0; index < JOBS.length; index += 1) {
    const angle = (index / JOBS.length) * TAU - Math.PI / 6 + (random() - 0.5) * 0.25;
    for (const distance of [4.05, 4.55]) {
      const tree = buildTree(random);
      const wobble = (random() - 0.5) * 0.3;
      tree.position.set(Math.cos(angle + wobble) * distance, 0, Math.sin(angle + wobble) * distance);
      world.add(tree);
    }
  }
  for (const [x, z] of [[1.2, -0.9], [1.5, 0.6], [0.4, 1.7], [-1.5, -1.3], [0.2, -1.8]]) {
    const tree = buildTree(random);
    tree.position.set(x, 0, z);
    world.add(tree);
  }
  // Rocks drifting beside the island.
  const rocks = [[-6.2, -1.2, 1.5, 0.5], [6.4, -0.4, -1, 0.38], [5.4, -2.2, 2.6, 0.3]].map(([x, y, z, size]) => {
    const rock = mesh(new DodecahedronGeometry(size, 0), solid(0x8a5a44), x, y, z);
    rock.castShadow = false;
    world.add(rock);
    return rock;
  });

  const { van, beam } = buildVan();
  world.add(van);

  const clouds = [[-5.5, 4.4, -3], [4.8, 5.2, -4.5], [1, 6.1, -7]].map(([x, y, z]) => {
    const cloud = buildCloud(random);
    cloud.position.set(x, y, z);
    scene.add(cloud);
    return cloud;
  });

  // --- What changes over time -------------------------------------------------------
  let vanAngle = Math.PI / 6 - 0.6;
  let stopFor = 0;
  let resetIn = 0;
  let spin = -0.5;
  let clock = 0;
  let hovered = -1;
  let dragging = false;
  let dragMoved = 0;
  let lastX = 0;
  const pointer = new Vector2(0, 0); // -1..1, for the lean toward the mouse
  const lean = new Vector2(0, 0);
  const raycaster = new Raycaster();
  const targets = jobs.flatMap((job) => [job.house, job.pin]);

  function report() {
    const finished = jobs.filter((job) => job.done);
    onProgress?.({
      done: finished.length,
      total: jobs.length,
      earned: finished.reduce((sum, job) => sum + job.price, 0),
    });
  }

  function finish(job) {
    if (job.done) return;
    job.done = true;
    job.pinMaterial.color.copy(PIN_DONE);
    job.pinMaterial.emissive.copy(PIN_DONE);
    if (!reducedMotion) {
      job.pop = 1;
      job.wave = 0;
      job.ring.visible = true;
    }
    if (jobs.every((each) => each.done)) resetIn = RESET_SECONDS;
    report();
  }

  function startOver() {
    for (const job of jobs) {
      job.done = false;
      job.pinMaterial.color.copy(PIN_TODO);
      job.pinMaterial.emissive.copy(PIN_TODO);
    }
    report();
  }

  function placeVan() {
    van.position.set(Math.cos(vanAngle) * ROAD_RADIUS, 0, Math.sin(vanAngle) * ROAD_RADIUS);
    van.rotation.y = -vanAngle;
  }

  function update(dt) {
    clock += dt;
    if (resetIn > 0) {
      resetIn -= dt;
      if (resetIn <= 0) startOver();
    }
    if (stopFor > 0) {
      stopFor -= dt;
    } else if (dt > 0) {
      vanAngle = (vanAngle + VAN_SPEED * dt) % TAU;
      const here = jobs.find((job) => {
        const gap = Math.abs(((vanAngle - job.angle + Math.PI + TAU) % TAU) - Math.PI);
        return !job.done && gap < 0.03;
      });
      if (here) {
        finish(here);
        stopFor = STOP_SECONDS;
      }
    }
    placeVan();
    van.position.y = stopFor > 0 ? 0 : Math.sin(clock * 22) * 0.008;

    jobs.forEach((job, index) => {
      job.pop = Math.max(0, job.pop - dt * 2.6);
      job.hover += ((hovered === index ? 1 : 0) - job.hover) * Math.min(1, dt * 12);
      job.house.scale.setScalar(1 + job.hover * 0.07);
      job.pin.position.y = 1.75 + Math.sin(clock * 2.2 + index) * 0.09 + job.hover * 0.12;
      job.pin.rotation.y = clock * 0.9 + index;
      job.pin.scale.setScalar(1 + Math.sin(job.pop * Math.PI) * 0.7);
      if (job.wave < 1) {
        job.wave = Math.min(1, job.wave + dt * 1.3);
        job.ring.scale.setScalar(1 + job.wave * 2.6);
        job.ringMaterial.opacity = 1 - job.wave;
        job.ring.visible = job.wave < 1;
      }
    });

    if (!dragging) spin += dt * 0.07;
    lean.lerp(pointer, Math.min(1, dt * 4));
    world.rotation.y = spin + lean.x * 0.16;
    world.rotation.x = lean.y * 0.05;
    world.position.y = Math.sin(clock * 0.9) * 0.1;
    rocks.forEach((rock, index) => {
      rock.position.y += Math.sin(clock * 1.1 + index * 2) * dt * 0.12;
      rock.rotation.x += dt * 0.2;
      rock.rotation.y += dt * 0.15;
    });
    clouds.forEach((cloud, index) => {
      cloud.position.x += dt * (0.12 + index * 0.04);
      if (cloud.position.x > 9) cloud.position.x = -9;
    });
  }

  function draw() {
    renderer.render(scene, camera);
  }

  // --- The loop: only while on screen, in a visible tab, with motion allowed -----------
  let frame = 0;
  let last = 0;
  let onScreen = true;
  let disposed = false;

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    draw();
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    const run = !disposed && !reducedMotion && onScreen && !document.hidden;
    if (run && !frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    } else if (!run && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }

  // With reduced motion nothing moves by itself; draw again only when something changed.
  function redraw() {
    if (frame || disposed) return;
    update(0);
    draw();
  }

  function resize() {
    const box = canvas.parentElement.getBoundingClientRect();
    if (!box.width || !box.height) return;
    renderer.setSize(box.width, box.height, false);
    camera.aspect = box.width / box.height;
    // Narrow stages get a camera further back, so the whole island stays in view.
    const back = Math.min(2.3, Math.max(1, 1.5 / camera.aspect));
    camera.position.set(cameraHome[0] * back, cameraHome[1] * back, cameraHome[2] * back);
    camera.lookAt(0, 0.2, 0);
    camera.updateProjectionMatrix();
    redraw();
  }

  function jobAt(event) {
    const box = canvas.getBoundingClientRect();
    const spot = new Vector2(
      ((event.clientX - box.left) / box.width) * 2 - 1,
      -((event.clientY - box.top) / box.height) * 2 + 1,
    );
    raycaster.setFromCamera(spot, camera);
    let hit = raycaster.intersectObjects(targets, true)[0]?.object;
    while (hit && hit.userData.job === undefined) hit = hit.parent;
    return hit ? hit.userData.job : -1;
  }

  function onPointerDown(event) {
    dragging = true;
    dragMoved = 0;
    lastX = event.clientX;
  }

  function onPointerMove(event) {
    if (dragging) {
      const dx = event.clientX - lastX;
      lastX = event.clientX;
      dragMoved += Math.abs(dx);
      if (dragMoved > 4) {
        spin += dx * 0.008;
        canvas.style.cursor = "grabbing";
        redraw();
      }
      return;
    }
    if (event.pointerType !== "mouse") return;
    const box = canvas.getBoundingClientRect();
    if (!reducedMotion) {
      pointer.set(((event.clientX - box.left) / box.width) * 2 - 1, ((event.clientY - box.top) / box.height) * 2 - 1);
    }
    hovered = jobAt(event);
    canvas.style.cursor = hovered >= 0 ? "pointer" : "grab";
  }

  function onPointerUp(event) {
    if (!dragging) return;
    dragging = false;
    canvas.style.cursor = "grab";
    if (dragMoved > 4) return;
    const index = jobAt(event);
    if (index >= 0) finish(jobs[index]);
    redraw();
  }

  function onPointerLeave() {
    dragging = false;
    hovered = -1;
    pointer.set(0, 0);
  }

  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerLeave);
  canvas.addEventListener("pointerleave", onPointerLeave);
  document.addEventListener("visibilitychange", sync);

  const resizer = new ResizeObserver(resize);
  resizer.observe(canvas.parentElement);
  const watcher = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    sync();
  });
  watcher.observe(canvas);

  placeVan();
  resize();
  sync();

  return {
    setTheme(theme) {
      const look = LOOK[theme] || LOOK.light;
      const night = theme === "dark";
      hemi.color.set(look.hemiSky);
      hemi.groundColor.set(look.hemiGround);
      hemi.intensity = look.hemi;
      sun.color.set(look.sun);
      sun.intensity = look.sunPower;
      windowMaterial.emissive.set(look.windows);
      windowMaterial.emissiveIntensity = look.windowGlow;
      orbMaterial.color.set(look.orb);
      beam.intensity = look.headlights;
      stars.visible = night;
      for (const cloud of clouds) cloud.visible = !night;
      redraw();
    },
    dispose() {
      disposed = true;
      sync();
      resizer.disconnect();
      watcher.disconnect();
      document.removeEventListener("visibilitychange", sync);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerLeave);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      scene.traverse((item) => {
        item.geometry?.dispose();
        for (const material of [].concat(item.material || [])) material.dispose();
      });
      renderer.dispose();
    },
  };
}

export function webglAvailable() {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}

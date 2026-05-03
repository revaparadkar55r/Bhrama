// ── State ─────────────────────────────────────────────
const state = {
  projects:      JSON.parse(localStorage.getItem('brahma_projects') || '[]'),
  current:       null,
  currentModel:  null,   // model JSON from AI
  currentGroup:  null,   // Three.js group in workspace scene
  renderer:      null,
  animId:        null,
  scene:         null,
  spherical:     { theta: 0.8, phi: 0.62, radius: 12 },
};

// ── DOM refs ──────────────────────────────────────────
const homePage        = document.getElementById('home-page');
const workspacePage   = document.getElementById('workspace-page');
const newProjectBtn   = document.getElementById('new-project-btn');
const backBtn         = document.getElementById('back-btn');
const projectNameEl   = document.getElementById('project-name');
const recentSection   = document.getElementById('recent-section');
const recentList      = document.getElementById('recent-list');
const tabs            = document.querySelectorAll('.tab');
const tabContents     = document.querySelectorAll('.tab-content');
const canvas          = document.getElementById('three-canvas');
const settingsBtn     = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const vpModelName     = document.getElementById('vp-model-name');

// ══════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════
function showPage(id) {
  homePage.classList.remove('active');
  workspacePage.classList.remove('active');
  document.getElementById(id).classList.add('active');
}

function openProject(name) {
  state.current = name;
  projectNameEl.textContent = name;
  showPage('workspace-page');
  initThree();
}

function goHome() {
  showPage('home-page');
  if (state.animId)   { cancelAnimationFrame(state.animId); state.animId = null; }
  if (state.renderer) { state.renderer.dispose(); state.renderer = null; }
  state.scene = null;
  renderRecentProjects();
}

// ══════════════════════════════════════════════════════
//  PROJECTS
// ══════════════════════════════════════════════════════
function renderRecentProjects() {
  if (!state.projects.length) { recentSection.style.display = 'none'; return; }
  recentSection.style.display = 'block';
  recentList.innerHTML = '';
  [...state.projects].reverse().slice(0, 6).forEach(p => {
    const li   = document.createElement('li');
    li.className = 'recent-item';
    const name = document.createElement('span');
    name.className = 'recent-name';
    name.textContent = p.name;
    name.addEventListener('click', () => openProject(p.name));
    const del  = document.createElement('button');
    del.className   = 'recent-del';
    del.textContent = '✕';
    del.title       = 'Delete project';
    del.addEventListener('click', e => { e.stopPropagation(); deleteProject(p.name); });
    li.appendChild(name);
    li.appendChild(del);
    recentList.appendChild(li);
  });
}

function deleteProject(name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  state.projects = state.projects.filter(p => p.name !== name);
  localStorage.setItem('brahma_projects', JSON.stringify(state.projects));
  if (state.current === name) goHome();
  else renderRecentProjects();
}

newProjectBtn.addEventListener('click', () => {
  const name = prompt('Project name:', `Project ${state.projects.length + 1}`);
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  state.projects.push({ name: trimmed, created: Date.now() });
  localStorage.setItem('brahma_projects', JSON.stringify(state.projects));
  openProject(trimmed);
});

backBtn.addEventListener('click', goHome);

document.getElementById('delete-project-btn').addEventListener('click', () => {
  if (state.current) deleteProject(state.current);
});

document.getElementById('export-btn').addEventListener('click', () => {
  if (!state.current) return;
  const proj = state.projects.find(p => p.name === state.current) || {};
  const data = {
    projectName: state.current,
    created:     new Date(proj.created || Date.now()).toISOString(),
    generatedWith: 'Brahma CAD v0.1',
    model:       state.currentModel || null,
    prompts: {
      generate: document.getElementById('input-generate').value || '',
      edit:     document.getElementById('input-edit').value     || '',
      simulate: document.getElementById('input-simulate').value || '',
    },
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a    = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(blob),
    download: `${state.current.replace(/\s+/g, '_')}.brahma.json`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
});

// ══════════════════════════════════════════════════════
//  TABS
// ══════════════════════════════════════════════════════
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    tabContents.forEach(c => c.classList.remove('active'));
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// ══════════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════════
settingsBtn.addEventListener('click', () => {
  document.getElementById('api-key-input').value = localStorage.getItem('brahma_api_key') || '';
  settingsOverlay.classList.add('open');
});
document.getElementById('close-settings').addEventListener('click', () => {
  settingsOverlay.classList.remove('open');
});
document.getElementById('save-api-key').addEventListener('click', () => {
  const key = document.getElementById('api-key-input').value.trim();
  if (key) localStorage.setItem('brahma_api_key', key);
  settingsOverlay.classList.remove('open');
});

document.getElementById('test-api-key').addEventListener('click', async () => {
  const key = document.getElementById('api-key-input').value.trim();
  const resultEl = document.getElementById('key-test-result');
  resultEl.className = 'key-test-result';
  resultEl.textContent = 'Testing…';
  try {
    const r = await fetch('/api/test-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key }),
    });
    const data = await r.json();
    if (data.ok) {
      resultEl.className = 'key-test-result ok';
      resultEl.textContent = '✓ Key is valid!';
    } else {
      resultEl.className = 'key-test-result err';
      resultEl.textContent = '✗ ' + (data.error || 'Invalid key');
    }
  } catch (e) {
    resultEl.className = 'key-test-result err';
    resultEl.textContent = '✗ Server error: ' + e.message;
  }
});
settingsOverlay.addEventListener('click', e => {
  if (e.target === settingsOverlay) settingsOverlay.classList.remove('open');
});

// ══════════════════════════════════════════════════════
//  AI SYSTEM PROMPTS
// ══════════════════════════════════════════════════════
const SYS_GENERATE = `You are a 3D CAD model generator. Convert ANY description — engineering, food, animals, objects, fantasy — into a Three.js JSON model. Return ONLY raw JSON, no markdown, no explanation.

Available component types and their parameters:
- box:        width, height, depth
- cylinder:   radiusTop, radiusBottom, height, radialSegments  (set radiusTop≠radiusBottom for tapers/cones)
- sphere:     radius, widthSegments, heightSegments
- torus:      radius, tube, radialSegments, tubularSegments
- torusKnot:  radius, tube, p, q
- icosahedron: radius, detail
- cone:       radius, height, radialSegments
- octahedron: radius

JSON format:
{"name":"...","description":"...","components":[{"id":"c1","type":"sphere","label":"Frosting","position":[0,1.2,0],"rotation":[0,0,0],"color":"#f9a8d4","parameters":{"radius":0.9,"widthSegments":16,"heightSegments":12}}],"units":"meters"}

SHAPE-BUILDING RULES:
- Build EVERY object from multiple overlapping/stacked primitives
- Cupcake = cylinder(wrapper) + wide flat cylinder(cake top) + large sphere(frosting dome) + tiny spheres(sprinkles) + small sphere(cherry)
- Tree = cone(canopy) + cylinder(trunk); House = box(walls) + box(roof rotated 45°) + box(door) + box(chimney)
- Car = box(body) + 4 cylinders(wheels) + box(cabin); Human = sphere(head) + box(torso) + 4 cylinders(limbs)
- Spread components so they TOUCH or OVERLAP — never float apart
- Stack vertically: position y=0 at base, build upward

POSITIONING:
- Center the whole assembly around origin
- If a cupcake wrapper is cylinder height=1.2 at y=0, the cake top sits at y=0.7, frosting dome at y=1.4
- All positions are world-space centers of each primitive

COLORS — pick vivid, realistic colors for the object type:
- Food/organic: pinks #f9a8d4, browns #92400e, creams #fef3c7, reds #ef4444, greens #22c55e
- Metal/steel: #6b7280 #5b8def #93c5fd
- Wood: #92400e #a16207
- Plastic/bright: #f59e0b #7c3aed #22d3ee #ef4444

Use 5–14 components. Do NOT wrap in markdown fences.`;

const SYS_EDIT = `You are a 3D CAD model editor for Brahma.
You receive the current model JSON and an edit instruction.
Return the COMPLETE updated model JSON using the exact same schema.
Apply ONLY the requested changes. Preserve all other components exactly.
Return raw JSON only — no markdown, no explanation.`;

const SYS_SIMULATE = `You are a structural and physics simulation analyst for Brahma.
Analyze the given 3D model under the specified conditions and provide a concise technical report covering:
1. Structural integrity assessment
2. Critical stress concentration points
3. Estimated safety factors
4. Material suitability
5. Potential failure modes
6. Recommended design improvements

Write in clear engineering language. Use specific observations based on the geometry.`;

// ══════════════════════════════════════════════════════
//  API CALL
// ══════════════════════════════════════════════════════
async function callAPI(system, userMessage) {
  const apiKey = localStorage.getItem('brahma_api_key') || '';
  if (!apiKey) throw new Error('API key not set. Click ⚙ to configure.');

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system,
      messages: [{ role: 'user', content: userMessage }],
      apiKey,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}. Is the server running? (npm start)`);
  }
  const data = await res.json();
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : data.error.message || 'API error');
  return data.content[0].text;
}

// ══════════════════════════════════════════════════════
//  AI ACTION BUTTONS
// ══════════════════════════════════════════════════════
document.querySelectorAll('.btn-action').forEach(btn => {
  btn.addEventListener('click', async () => {
    const action  = btn.dataset.action;
    const input   = document.getElementById('input-' + action);
    const status  = document.getElementById('status-' + action);
    const prompt  = input.value.trim();
    if (!prompt) { status.textContent = 'Enter a prompt first.'; return; }

    const labels = { generate: 'Generating model', edit: 'Applying edits', simulate: 'Running simulation' };
    status.textContent = labels[action] + '…';
    btn.disabled = true;

    try {
      if (action === 'generate') {
        const text      = await callAPI(SYS_GENERATE, prompt);
        const modelJSON = parseModelJSON(text);
        state.currentModel = modelJSON;
        renderModel(modelJSON);
        status.textContent = `✓ Generated: ${modelJSON.name}`;

      } else if (action === 'edit') {
        if (!state.currentModel) {
          status.textContent = 'Generate a model first, then describe edits.';
          btn.disabled = false; return;
        }
        const userMsg = `Current model JSON:\n${JSON.stringify(state.currentModel, null, 2)}\n\nEdit instruction: ${prompt}`;
        const text      = await callAPI(SYS_EDIT, userMsg);
        const modelJSON = parseModelJSON(text);
        state.currentModel = modelJSON;
        renderModel(modelJSON);
        status.textContent = `✓ Edited: ${modelJSON.name}`;

      } else if (action === 'simulate') {
        const modelCtx = state.currentModel
          ? `3D Model:\n${JSON.stringify(state.currentModel, null, 2)}`
          : 'No model loaded yet — analyze a hypothetical structure based on the description below.';
        const userMsg  = `${modelCtx}\n\nSimulation conditions: ${prompt}`;
        const analysis = await callAPI(SYS_SIMULATE, userMsg);
        status.innerHTML = analysis.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
      }
    } catch (err) {
      status.textContent = `⚠ ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  });
});

// ══════════════════════════════════════════════════════
//  PARSE MODEL JSON
// ══════════════════════════════════════════════════════
function parseModelJSON(text) {
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Could not parse model JSON from API response.');
  }
}

// ══════════════════════════════════════════════════════
//  RENDER AI MODEL IN THREE.JS
// ══════════════════════════════════════════════════════
function renderModel(modelJSON) {
  if (!state.scene) return;

  // Remove old model
  if (state.currentGroup) {
    state.scene.remove(state.currentGroup);
    state.currentGroup = null;
  }
  // Hide placeholder
  state.scene.children.filter(c => c.userData.isPlaceholder).forEach(c => { c.visible = false; });

  const group = new THREE.Group();

  modelJSON.components.forEach(comp => {
    const p = comp.parameters || {};
    let geo;

    switch (comp.type) {
      case 'box':
        geo = new THREE.BoxGeometry(p.width || 1, p.height || 1, p.depth || 1);
        break;
      case 'cylinder':
        geo = new THREE.CylinderGeometry(
          p.radiusTop  ?? p.radius ?? 0.5,
          p.radiusBottom ?? p.radius ?? 0.5,
          p.height || 1,
          Math.max(p.radialSegments || 24, 6)
        );
        break;
      case 'sphere':
        geo = new THREE.SphereGeometry(p.radius || 0.5, p.widthSegments || 32, p.heightSegments || 16);
        break;
      case 'torus':
        geo = new THREE.TorusGeometry(p.radius || 1, p.tube || 0.3, p.radialSegments || 16, p.tubularSegments || 32);
        break;
      case 'torusKnot':
        geo = new THREE.TorusKnotGeometry(p.radius || 1, p.tube || 0.3, p.tubularSegments || 100, p.radialSegments || 16, p.p || 2, p.q || 3);
        break;
      case 'icosahedron':
        geo = new THREE.IcosahedronGeometry(p.radius || 1, Math.min(p.detail ?? 1, 4));
        break;
      case 'cone':
        geo = new THREE.ConeGeometry(p.radius || 0.5, p.height || 1, p.radialSegments || 24);
        break;
      case 'octahedron':
        geo = new THREE.OctahedronGeometry(p.radius || 1, p.detail || 0);
        break;
      default:
        geo = new THREE.BoxGeometry(1, 1, 1);
    }

    const col   = new THREE.Color(comp.color || '#5b8def');
    const solidM = new THREE.MeshPhongMaterial({ color: col, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const wireM  = new THREE.LineBasicMaterial({ color: col.clone().lerp(new THREE.Color('#ffffff'), 0.3) });

    const mesh  = new THREE.Mesh(geo, solidM);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), wireM);

    const pos = comp.position || [0, 0, 0];
    const rot = comp.rotation || [0, 0, 0];

    [mesh, edges].forEach(o => {
      o.position.set(...pos);
      o.rotation.set(
        THREE.MathUtils.degToRad(rot[0]),
        THREE.MathUtils.degToRad(rot[1]),
        THREE.MathUtils.degToRad(rot[2])
      );
    });

    group.add(mesh);
    group.add(edges);
  });

  // Normalise: fit inside a ~4-unit cube
  const box    = new THREE.Box3().setFromObject(group);
  const size   = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0.01) {
    const s = 4 / maxDim;
    group.scale.setScalar(s);
    const centre = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
    group.position.sub(centre);
  }

  state.scene.add(group);
  state.currentGroup = group;

  if (vpModelName) vpModelName.textContent = modelJSON.name || '';
}

// ══════════════════════════════════════════════════════
//  WORKSPACE THREE.JS SCENE
// ══════════════════════════════════════════════════════
function initThree() {
  if (state.renderer) state.renderer.dispose();

  const vp = document.getElementById('viewport');
  const W  = vp.clientWidth, H = vp.clientHeight;

  const scene    = new THREE.Scene();
  scene.fog      = new THREE.FogExp2(0x04040a, 0.03);
  state.scene    = scene;

  const camera   = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x04040a);
  state.renderer = renderer;

  // Grid
  scene.add(new THREE.GridHelper(24, 24, 0x1c1c35, 0x0e0e1c));

  // Placeholder cube
  const placeholder = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2)),
    new THREE.LineBasicMaterial({ color: 0x5b8def })
  );
  placeholder.position.y = 1;
  placeholder.userData.isPlaceholder = true;
  scene.add(placeholder);

  // Lights
  scene.add(new THREE.AmbientLight(0x404080, 0.6));
  const sun = new THREE.DirectionalLight(0x7aadff, 1.4);
  sun.position.set(6, 10, 8);
  scene.add(sun);

  // Orbit
  const sp = state.spherical;
  function applyCamera() {
    camera.position.set(
      sp.radius * Math.sin(sp.phi) * Math.sin(sp.theta),
      sp.radius * Math.cos(sp.phi),
      sp.radius * Math.sin(sp.phi) * Math.cos(sp.theta)
    );
    camera.lookAt(0, 1, 0);
  }
  applyCamera();

  let drag = false, prev = { x: 0, y: 0 };
  canvas.addEventListener('mousedown',  e => { drag = true; prev = { x: e.clientX, y: e.clientY }; });
  window.addEventListener('mouseup',    ()  => { drag = false; });
  canvas.addEventListener('mousemove',  e  => {
    if (!drag) return;
    sp.theta -= (e.clientX - prev.x) * 0.005;
    sp.phi    = Math.max(.12, Math.min(Math.PI - .12, sp.phi + (e.clientY - prev.y) * 0.005));
    prev = { x: e.clientX, y: e.clientY };
    applyCamera();
  });
  canvas.addEventListener('wheel', e => {
    sp.radius = Math.max(3, Math.min(32, sp.radius + e.deltaY * 0.012));
    applyCamera();
    e.preventDefault();
  }, { passive: false });

  document.getElementById('vp-perspective').onclick = () => { sp.theta=0.8; sp.phi=0.62; sp.radius=12; applyCamera(); };
  document.getElementById('vp-top').onclick         = () => { sp.phi=0.01;  sp.radius=12; applyCamera(); };
  document.getElementById('vp-front').onclick       = () => { sp.theta=0;   sp.phi=Math.PI/2; sp.radius=12; applyCamera(); };

  new ResizeObserver(() => {
    const w = vp.clientWidth, h = vp.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }).observe(vp);

  function tick() {
    state.animId = requestAnimationFrame(tick);
    scene.children.forEach(c => { if (c.userData.isPlaceholder && c.visible) c.rotation.y += 0.004; });
    renderer.render(scene, camera);
  }
  tick();

  // Re-render AI model if one already exists from a previous visit
  if (state.currentModel) renderModel(state.currentModel);
}

// ══════════════════════════════════════════════════════
//  HOME BACKGROUND — ROTATING CAD EXAMPLES
// ══════════════════════════════════════════════════════
function initHomeCanvas() {
  const homeCanvas = document.getElementById('home-canvas');
  if (!homeCanvas || typeof THREE === 'undefined') return;

  const W = window.innerWidth, H = window.innerHeight;
  const bgRend = new THREE.WebGLRenderer({ canvas: homeCanvas, alpha: true, antialias: true });
  bgRend.setSize(W, H);
  bgRend.setPixelRatio(Math.min(devicePixelRatio, 2));

  const bgScene  = new THREE.Scene();
  const bgCam    = new THREE.PerspectiveCamera(65, W / H, 0.1, 200);
  bgCam.position.z = 18;

  const palette = [0x5b8def, 0x818cf8, 0x22d3ee, 0x34d399, 0x7c3aed, 0x93c5fd, 0xf59e0b, 0x5b8def];
  const mats    = palette.map(c => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.48 }));

  function wire(geo, matIdx, pos) {
    const m = new THREE.LineSegments(new THREE.EdgesGeometry(geo), mats[matIdx % mats.length]);
    if (pos) m.position.set(...pos);
    geo.dispose();
    return m;
  }

  const models = [];

  // 1 — I-beam bridge section  (top-left)
  {
    const g = new THREE.Group();
    g.add(wire(new THREE.BoxGeometry(4.5, 0.18, 1.4), 0));
    g.add(wire(new THREE.BoxGeometry(4.5, 0.18, 1.4), 0, [0, -1.2, 0]));
    for (let x = -1.8; x <= 1.8; x += 0.9)
      g.add(wire(new THREE.BoxGeometry(0.14, 1.2, 1.4), 0, [x, -0.6, 0]));
    g.position.set(-10, 5, -4);
    g.userData.rot = [0.002, 0.006, 0.001];
    models.push(g);
  }

  // 2 — Gear  (top-right)
  {
    const g = new THREE.Group();
    g.add(wire(new THREE.CylinderGeometry(1.2, 1.2, 0.45, 24), 1));
    g.add(wire(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 12), 1));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const t = wire(new THREE.BoxGeometry(0.28, 0.44, 0.25), 1);
      t.position.set(Math.cos(a) * 1.38, 0, Math.sin(a) * 1.38);
      t.rotation.y = a;
      g.add(t);
    }
    g.position.set(11, 5, -3);
    g.userData.rot = [0.001, 0.009, 0.002];
    models.push(g);
  }

  // 3 — Tower / building  (top-center, far back)
  {
    const g = new THREE.Group();
    g.add(wire(new THREE.BoxGeometry(2, 4.5, 2), 2));
    for (let y = -1.8; y <= 1.8; y += 0.9)
      g.add(wire(new THREE.BoxGeometry(2.05, 0.05, 2.05), 2, [0, y, 0]));
    g.add(wire(new THREE.ConeGeometry(0.7, 1.4, 4), 2, [0, 2.95, 0]));
    g.position.set(1, 7, -10);
    g.userData.rot = [0.003, 0.004, 0.001];
    models.push(g);
  }

  // 4 — Rocket  (bottom-left)
  {
    const g = new THREE.Group();
    g.add(wire(new THREE.CylinderGeometry(0.45, 0.45, 3.2, 16), 3));
    g.add(wire(new THREE.ConeGeometry(0.45, 1.3, 16),  3, [0,  2.25, 0]));
    g.add(wire(new THREE.ConeGeometry(0.28, 0.7, 4),   3, [0, -1.95, 0]));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const fin = wire(new THREE.BoxGeometry(0.06, 1, 0.6), 3);
      fin.position.set(Math.cos(a) * 0.52, -1.4, Math.sin(a) * 0.52);
      fin.rotation.y = a;
      g.add(fin);
    }
    g.position.set(-11, -5, -3);
    g.userData.rot = [0.004, 0.003, 0.002];
    models.push(g);
  }

  // 5 — Torus-knot  (bottom-right)
  {
    const g = new THREE.Group();
    g.add(wire(new THREE.TorusKnotGeometry(1.1, 0.25, 100, 12, 2, 3), 4));
    g.position.set(11, -5, -4);
    g.userData.rot = [0.005, 0.007, 0.003];
    models.push(g);
  }

  // 6 — Geodesic dome  (left-middle)
  {
    const g = new THREE.Group();
    g.add(wire(new THREE.IcosahedronGeometry(1.5, 1), 5));
    g.add(wire(new THREE.CylinderGeometry(1.44, 1.44, 0.12, 24), 5, [0, -0.75, 0]));
    g.position.set(-11, 0, -5);
    g.userData.rot = [0.002, 0.005, 0.004];
    models.push(g);
  }

  // 7 — Hex bolt  (right-middle)
  {
    const g = new THREE.Group();
    g.add(wire(new THREE.CylinderGeometry(0.32, 0.32, 2.6, 8),  6, [0, -0.75, 0]));
    g.add(wire(new THREE.CylinderGeometry(0.65, 0.65, 0.65, 6), 6, [0,  0.95, 0]));
    g.add(wire(new THREE.ConeGeometry(0.28, 0.4, 8),            6, [0, -2.2, 0]));
    g.position.set(11, 0, -2);
    g.userData.rot = [0.005, 0.004, 0.002];
    models.push(g);
  }

  // 8 — Wheel / rim  (bottom-center)
  {
    const g = new THREE.Group();
    g.add(wire(new THREE.TorusGeometry(1.5, 0.16, 8, 32), 7));
    g.add(wire(new THREE.CylinderGeometry(0.2, 0.2, 0.45, 16), 7));
    for (let i = 0; i < 6; i++) {
      const s = wire(new THREE.BoxGeometry(0.08, 0.08, 1.25), 7);
      s.rotation.z = (i / 6) * Math.PI * 2;
      g.add(s);
    }
    g.position.set(0, -6, -3);
    g.userData.rot = [0.001, 0.008, 0.003];
    models.push(g);
  }

  // 9 — Satellite dish  (far bottom-left corner)
  {
    const g = new THREE.Group();
    g.add(wire(new THREE.SphereGeometry(1.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 2));
    g.add(wire(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8), 2, [0, -1.1, 0]));
    g.add(wire(new THREE.SphereGeometry(0.18, 8, 8), 2, [0, 0.5, 0]));
    g.position.set(-6, -6, -2);
    g.userData.rot = [0.003, 0.005, 0.002];
    models.push(g);
  }

  // 10 — Truss bridge segment  (far top-right corner)
  {
    const g = new THREE.Group();
    for (let x = -2; x <= 2; x += 1) {
      g.add(wire(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 6), 0, [x, 0, 0]));
      g.add(wire(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 6), 0, [x, 0, 1.2]));
    }
    g.add(wire(new THREE.BoxGeometry(4.2, 0.1, 1.3), 0, [0, -1.4, 0.6]));
    g.add(wire(new THREE.BoxGeometry(4.2, 0.1, 1.3), 0, [0,  1.4, 0.6]));
    g.position.set(6, 7, -6);
    g.userData.rot = [0.002, 0.004, 0.001];
    models.push(g);
  }

  models.forEach(g => bgScene.add(g));

  function bgTick() {
    requestAnimationFrame(bgTick);
    models.forEach(g => {
      if (!g.userData.rot) return;
      g.rotation.x += g.userData.rot[0];
      g.rotation.y += g.userData.rot[1];
      g.rotation.z += g.userData.rot[2];
    });
    bgRend.render(bgScene, bgCam);
  }
  bgTick();

  window.addEventListener('resize', () => {
    const W = window.innerWidth, H = window.innerHeight;
    bgCam.aspect = W / H;
    bgCam.updateProjectionMatrix();
    bgRend.setSize(W, H);
  });
}

// ══════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════
renderRecentProjects();
initHomeCanvas();

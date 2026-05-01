// ── State ────────────────────────────────────────────
const state = {
  projects: JSON.parse(localStorage.getItem('bhrama_projects') || '[]'),
  current:  null,
  renderer: null,
  animId:   null,
  spherical: { theta: 0.8, phi: 0.62, radius: 12 },
};

// ── DOM refs ─────────────────────────────────────────
const homePage      = document.getElementById('home-page');
const workspacePage = document.getElementById('workspace-page');
const newProjectBtn = document.getElementById('new-project-btn');
const backBtn       = document.getElementById('back-btn');
const projectNameEl = document.getElementById('project-name');
const recentSection = document.getElementById('recent-section');
const recentList    = document.getElementById('recent-list');
const tabs          = document.querySelectorAll('.tab');
const tabContents   = document.querySelectorAll('.tab-content');
const canvas        = document.getElementById('three-canvas');

// ── Navigation ───────────────────────────────────────
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
  renderRecentProjects();
}

// ── Recent projects list ─────────────────────────────
function renderRecentProjects() {
  if (!state.projects.length) { recentSection.style.display = 'none'; return; }
  recentSection.style.display = 'block';
  recentList.innerHTML = '';
  [...state.projects].reverse().slice(0, 6).forEach(p => {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = p.name;
    li.addEventListener('click', () => openProject(p.name));
    recentList.appendChild(li);
  });
}

// ── New Project ──────────────────────────────────────
newProjectBtn.addEventListener('click', () => {
  const name = prompt('Project name:', `Project ${state.projects.length + 1}`);
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  state.projects.push({ name: trimmed, created: Date.now() });
  localStorage.setItem('bhrama_projects', JSON.stringify(state.projects));
  openProject(trimmed);
});

backBtn.addEventListener('click', goHome);

// ── Tabs ─────────────────────────────────────────────
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    tabContents.forEach(c => c.classList.remove('active'));
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// ── AI Action buttons ─────────────────────────────────
document.querySelectorAll('.btn-action').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    const input  = document.getElementById('input-' + action);
    const status = document.getElementById('status-' + action);
    const prompt = input.value.trim();
    if (!prompt) { status.textContent = 'Please enter a prompt first.'; return; }

    const labels = { generate: 'Generating model', edit: 'Applying edits', apply: 'Running simulation' };
    status.textContent = labels[action] + '…';
    btn.disabled = true;

    // Placeholder — wire up your AI API here
    setTimeout(() => {
      status.textContent = `✓ Done. (Connect your AI backend to ${action} with: "${prompt.slice(0, 60)}…")`;
      btn.disabled = false;
    }, 1800);
  });
});

// ── Three.js viewport ────────────────────────────────
function initThree() {
  if (state.renderer) state.renderer.dispose();

  const vp = document.getElementById('viewport');
  const W  = vp.clientWidth;
  const H  = vp.clientHeight;

  const scene    = new THREE.Scene();
  scene.fog      = new THREE.FogExp2(0x04040a, 0.03);

  const camera   = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x04040a);
  state.renderer = renderer;

  // Grid
  scene.add(new THREE.GridHelper(24, 24, 0x1c1c35, 0x0e0e1c));

  // Placeholder wireframe model
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2));
  const lineMat = new THREE.LineBasicMaterial({ color: 0x5b8def });
  const cube  = new THREE.LineSegments(edges, lineMat);
  cube.position.y = 1;
  scene.add(cube);

  // Soft lighting
  scene.add(new THREE.AmbientLight(0x404080, 0.6));
  const sun = new THREE.DirectionalLight(0x7aadff, 1.4);
  sun.position.set(6, 10, 8);
  scene.add(sun);

  // ── Orbit controls (manual) ──────────────────────
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

  // ── View presets ─────────────────────────────────
  document.getElementById('vp-perspective').onclick = () => {
    sp.theta = 0.8; sp.phi = 0.62; sp.radius = 12; applyCamera();
  };
  document.getElementById('vp-top').onclick = () => {
    sp.phi = 0.01; sp.radius = 12; applyCamera();
  };
  document.getElementById('vp-front').onclick = () => {
    sp.theta = 0; sp.phi = Math.PI / 2; sp.radius = 12; applyCamera();
  };

  // ── Resize ───────────────────────────────────────
  const ro = new ResizeObserver(() => {
    const w = vp.clientWidth, h = vp.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  ro.observe(vp);

  // ── Render loop ──────────────────────────────────
  function tick() {
    state.animId = requestAnimationFrame(tick);
    cube.rotation.y += 0.004;
    renderer.render(scene, camera);
  }
  tick();
}

// ── Init ─────────────────────────────────────────────
renderRecentProjects();

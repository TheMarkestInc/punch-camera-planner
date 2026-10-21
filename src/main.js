import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SENSORS, ASPECTS, clamp, optics, fitFrame, validateCameraState, encodeState, decodeState } from './camera-math.js';
import './style.css';

const $ = id => document.getElementById(id);
const base = import.meta.env.BASE_URL;
const icons = {
  camera: '<rect x="3" y="6" width="14" height="12" rx="2"/><path d="m17 10 5-3v10l-5-3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-3m-6 7 6 3"/>',
  save: '<path d="M5 3h12l4 4v14H3V3z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
  move: '<path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"/>',
  orbit: '<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-30 12 12)"/><circle cx="12" cy="12" r="3"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  reset: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .5-1.5 1-1.5 2M12 16v1"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${icons[name] || icons.camera}</svg>`;
const app = $('app');
app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="${base}" aria-label="BATYR QUEST Camera Scout"><img class="brand-logo" src="${base}branding/batyr-quest-ivory.svg" alt="BATYR QUEST" width="112" height="49"/><span class="brand-caption">LOCATION<br/>CAMERA SCOUT</span></a>
    <div class="location-label"><span class="status-dot"></span>PUNCH STAND UP CLUB<span class="subtle"> / АЛМАТЫ</span></div>
    <div class="header-actions"><button id="help" class="icon-button" title="Управление" aria-label="Показать управление">${icon('help')}</button><button id="share" class="button secondary">${icon('share')}<span>Поделиться</span></button></div>
  </header>
  <main class="workspace">
    <section id="viewport" class="viewport" tabindex="0" aria-label="3D-вид локации. В режиме полёта нажмите на вид и используйте WASD, Q, E. Поворот с зажатой правой кнопкой мыши.">
      <div id="canvas-host"></div>
      <div class="viewport-top"><div class="live-tag"><span></span>LIVE VIEW</div><span id="view-name">Выбор ракурса</span><button id="fullscreen" class="quiet-button" title="Развернуть 3D-вид">⛶</button></div>
      <div id="camera-frame" class="camera-frame"><div id="thirds" class="thirds"><i></i><i></i><i></i><i></i></div><div id="safe" class="safe-frame" hidden></div><span class="frame-corner tl"></span><span class="frame-corner tr"></span><span class="frame-corner bl"></span><span class="frame-corner br"></span><div class="frame-readout"><strong id="hud-focal">24 mm</strong><span id="hud-sensor">FULL FRAME</span><span id="hud-aspect">16:9</span></div></div>
      <div class="viewport-bottom"><div class="movement-toggle" role="group" aria-label="Режим навигации"><button id="mode-fly" class="active">${icon('move')}Полёт</button><button id="mode-orbit">${icon('orbit')}Облёт</button></div><div id="navigation-hint" class="navigation-hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>движение</span><kbd>Q</kbd><kbd>E</kbd><span>вверх / вниз · ПКМ — взгляд</span></div><button id="capture" class="capture-button" title="Сохранить кадр PNG">${icon('image')}<span>Снять кадр</span></button></div>
      <div id="loading" class="loading-layer"><div class="loader-ring"></div><strong id="loading-title">Загружаем локацию</strong><span id="loading-detail">Готовим пространство для вашей камеры</span><div class="progress-track"><div id="loading-progress"></div></div><button id="retry" class="button primary" hidden>Повторить загрузку</button></div>
      <div id="help-popover" class="help-popover" hidden><button id="close-help" class="icon-button" aria-label="Закрыть управление">${icon('close')}</button><strong>Ваша камера в локации</strong><p>Нажмите на 3D-вид, чтобы управлять камерой с клавиатуры.</p><dl><dt>W / A / S / D</dt><dd>Движение</dd><dt>Q / E</dt><dd>Вниз / вверх</dd><dt>Shift</dt><dd>Быстрее</dd><dt>Правая кнопка</dt><dd>Удерживайте для поворота</dd><dt>Колесо</dt><dd>Движение вперёд / назад</dd><dt>Облёт</dt><dd>ЛКМ — поворот, ПКМ — сдвиг, колесо — масштаб. На телефоне — один / два пальца.</dd></dl><p>Рамка показывает итоговый кадр с выбранным объективом и форматом. Сохранённый ракурс можно отправить ссылкой.</p></div>
    </section>
    <aside class="sidebar" aria-label="Параметры камеры">
      <section class="panel-section"><div class="section-label"><span>01 / ТОЧКА ОБЗОРА</span><span id="scene-state" class="tiny-tag">ЗАГРУЗКА</span></div><div id="presets" class="preset-grid"></div><div class="height-row"><label for="height">Высота камеры <small>от выбранного пола</small></label><div class="number-unit"><input id="height" type="number" min="-1" max="10" step="0.05" value="1.6"/><span>м</span></div></div><div class="field"><label for="floor">Уровень</label><select id="floor"><option value="ground">Основной зал</option></select></div><details class="position-details"><summary>Координаты камеры <span id="position-summary"></span></summary><div class="coordinate-grid">${['x','y','z'].map(k => `<label>${k.toUpperCase()}<input id="position-${k}" type="number" step=".05" aria-label="Координата ${k.toUpperCase()} в метрах"/></label>`).join('')}</div></details></section>
      <section class="panel-section"><div class="section-label"><span>02 / ОБЪЕКТИВ</span><span class="tiny-tag">ММ</span></div><div class="focal-display"><span>Фокусное расстояние</span><div><input id="focal" type="number" min="8" max="300" step="1" value="24" aria-label="Фокусное расстояние в миллиметрах"/><small>mm</small></div></div><input id="focal-range" type="range" min="12" max="200" step="1" value="24" aria-label="Фокусное расстояние"/><div class="range-labels"><span>12 · широкий</span><span>200 · теле</span></div><div id="focal-presets" class="focal-presets">${[18,24,35,50,85].map(n => `<button data-focal="${n}">${n}</button>`).join('')}</div><div class="field"><label for="sensor">Сенсор</label><select id="sensor">${Object.entries(SENSORS).map(([id,s]) => `<option value="${id}">${s.label}</option>`).join('')}<option value="custom">Свой размер</option></select></div><div id="custom-sensor" class="two-fields" hidden><label>Ширина, мм<input id="sensor-width" type="number" value="36" min="5" max="80" step=".1"/></label><label>Высота, мм<input id="sensor-height" type="number" value="24" min="3" max="80" step=".1"/></label></div><div class="field"><label for="aspect">Формат кадра</label><select id="aspect">${Object.keys(ASPECTS).map(a => `<option>${a}</option>`).join('')}</select></div><div class="optics-readout"><div><small>ГОР. УГОЛ</small><strong id="hfov">73.7°</strong></div><div><small>ВЕРТ. УГОЛ</small><strong id="vfov">45.7°</strong></div><div><small>КАДР НА ФОКУСЕ</small><strong id="coverage">4.5 × 2.5 м</strong></div></div><details class="focus-details"><summary>Фокус и глубина резкости</summary><div class="two-fields"><label>Диафрагма<select id="aperture">${[1.4,2,2.8,4,5.6,8,11,16,22].map(v => `<option value="${v}" ${v===4?'selected':''}>f/${v}</option>`).join('')}</select></label><label>Фокус, м<input id="focus" type="number" min=".1" max="100" step=".1" value="3"/></label></div><div class="dof-readout"><span>ГРИП · расчёт</span><strong id="dof">—</strong></div><p class="microcopy">Диафрагма и фокус используются для расчёта ГРИП. Предпросмотр остаётся резким.</p></details></section>
      <section class="panel-section"><div class="section-label"><span>03 / ПРОСТРАНСТВО И КАДР</span></div><div class="toggle-grid"><label class="toggle"><input id="furniture" type="checkbox" checked/><span>Мебель</span></label><label class="toggle"><input id="roof" type="checkbox" checked/><span>Потолок</span></label><label class="toggle"><input id="thirds-toggle" type="checkbox" checked/><span>Правило третей</span></label><label class="toggle"><input id="safe-toggle" type="checkbox"/><span>Безопасная зона</span></label></div><div class="field compact"><label for="exposure">Экспозиция <output id="exposure-value">1.0</output></label><input id="exposure" type="range" min=".2" max="3" step=".05" value="1"/></div><div class="field compact"><label for="speed">Скорость полёта <output id="speed-value">1.8 м/с</output></label><input id="speed" type="range" min=".3" max="6" step=".1" value="1.8"/></div></section>
      <section class="panel-section shots-section"><div class="section-label"><span>04 / ВАШИ РАКУРСЫ</span><span id="shot-count" class="tiny-tag">0</span></div><div class="save-shot"><input id="shot-name" placeholder="Название ракурса" maxlength="60" aria-label="Название ракурса"/><button id="save-shot" class="button primary" title="Сохранить ракурс">${icon('save')}Сохранить</button></div><div id="shots" class="shots"></div><div class="shots-actions"><button id="export-shots" class="quiet-button">${icon('download')}Экспорт JSON</button><button id="import-shots" class="quiet-button">${icon('upload')}Импорт JSON</button><input id="import-file" type="file" accept="application/json,.json" hidden/></div><p class="microcopy">Ракурсы хранятся в этом браузере. Экспортируйте файл для всей команды.</p></section>
      <footer class="panel-footer"><span>BATYR QUEST</span><span id="model-label">PUNCH / LOCATION SHEET</span></footer>
    </aside>
  </main><div id="toast" class="toast" role="status" aria-live="polite"></div>`;

let renderer, scene, camera, orbit, venue, metadata, frame;
let loaded = false, mode = matchMedia('(pointer: coarse)').matches ? 'orbit' : 'fly';
let cameraState = validateCameraState({ position: [0, 1.6, 4], target: [0, 1.6, 0], focal: 24 });
let lookDrag = false, dragLast = { x: 0, y: 0 }, speed = 1.8, lastTime = 0, toastTimer;
let needsRender = true, activePreset = null, moveOccurred = false;
const keys = new Set(), furnitureNodes = [], roofNodes = [], materialSet = new Set();
const direction = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const viewport = $('viewport');
const STORAGE = 'batyr-camera-shots-v1';
let shots = [];
try { const stored = JSON.parse(localStorage.getItem(STORAGE) || '[]'); shots = stored.filter(s => { try { s.state = validateCameraState(s.state); return true; } catch { return false; } }).slice(0, 50); } catch { /* Storage is optional in private browsing. */ }

function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3600); }
function download(content, filename) { const url = typeof content === 'string' && content.startsWith('data:') ? content : URL.createObjectURL(content); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); if (!url.startsWith('data:')) setTimeout(() => URL.revokeObjectURL(url), 1000); }
function currentFloor() { return metadata?.floorLevels?.find(f => f.id === cameraState.floor) || metadata?.floorLevels?.[0] || { height: 0 }; }
function lens() { const s = SENSORS[cameraState.sensor] || { width: cameraState.sensorWidth, height: cameraState.sensorHeight }; return optics(cameraState.focal, s.width, s.height, ASPECTS[cameraState.aspect], cameraState.focus, cameraState.aperture); }
function syncCameraState() { if (!camera) return; cameraState.position = camera.position.toArray(); camera.getWorldDirection(direction); const distance = Math.max(.2, camera.position.distanceTo(orbit.target)); cameraState.target = camera.position.clone().addScaledVector(direction, distance).toArray(); }
function getState() { syncCameraState(); return validateCameraState(cameraState); }
function applyState(value, { preset = null } = {}) {
  cameraState = validateCameraState(value);
  if (camera) { camera.position.fromArray(cameraState.position); camera.lookAt(new THREE.Vector3().fromArray(cameraState.target)); orbit.target.fromArray(cameraState.target); orbit.update(); }
  activePreset = preset;
  if (!metadata?.floorLevels?.some(f => f.id === cameraState.floor)) cameraState.floor = metadata?.floorLevels?.[0]?.id || 'ground';
  updateUI(); updateVisibility(); updateLens(); updatePosition(); setActivePreset(); needsRender = true;
}
function updateUI() {
  for (const id of ['focal', 'sensor', 'aspect', 'aperture', 'focus', 'exposure']) $(id).value = cameraState[id];
  $('focal-range').value = cameraState.focal;
  $('floor').value = cameraState.floor;
  $('sensor-width').value = cameraState.sensorWidth; $('sensor-height').value = cameraState.sensorHeight;
  $('custom-sensor').hidden = cameraState.sensor !== 'custom';
  for (const id of ['furniture', 'roof']) $(id).checked = cameraState[id];
  $('thirds-toggle').checked = cameraState.thirds; $('safe-toggle').checked = cameraState.safe;
  $('thirds').hidden = !cameraState.thirds; $('safe').hidden = !cameraState.safe;
  $('exposure-value').value = cameraState.exposure.toFixed(1);
  document.querySelectorAll('[data-focal]').forEach(b => b.classList.toggle('active', Number(b.dataset.focal) === cameraState.focal));
}
function updateLens() {
  const o = lens();
  if (camera) { camera.fov = o.vfov; camera.aspect = ASPECTS[cameraState.aspect]; camera.updateProjectionMatrix(); renderer.toneMappingExposure = cameraState.exposure; }
  $('hfov').textContent = o.hfov.toFixed(1) + '°'; $('vfov').textContent = o.vfov.toFixed(1) + '°';
  $('coverage').textContent = `${o.widthAtFocus.toFixed(1)} × ${o.heightAtFocus.toFixed(1)} м`;
  $('dof').textContent = `${o.near.toFixed(2)} — ${Number.isFinite(o.far) ? o.far.toFixed(2) : '∞'} м`;
  $('hud-focal').textContent = cameraState.focal + ' mm'; $('hud-aspect').textContent = cameraState.aspect;
  $('hud-sensor').textContent = cameraState.sensor === 'full' ? 'FULL FRAME' : cameraState.sensor === 'custom' ? `${cameraState.sensorWidth} × ${cameraState.sensorHeight}` : cameraState.sensor.toUpperCase();
  resize(); needsRender = true;
}
function updatePosition() {
  if (!camera) return;
  for (const [index, axis] of ['x', 'y', 'z'].entries()) if (document.activeElement !== $('position-' + axis)) $('position-' + axis).value = camera.position.getComponent(index).toFixed(2);
  if (document.activeElement !== $('height')) $('height').value = (camera.position.y - currentFloor().height).toFixed(2);
  $('position-summary').textContent = `${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)} м`;
}
function updateVisibility() { furnitureNodes.forEach(o => o.visible = cameraState.furniture); roofNodes.forEach(o => o.visible = cameraState.roof); needsRender = true; }
function setActivePreset() { document.querySelectorAll('[data-preset]').forEach(b => b.classList.toggle('active', b.dataset.preset === activePreset)); $('view-name').textContent = metadata?.presets?.find(p => p.id === activePreset)?.label || 'Свободная камера'; }
function setMode(next) {
  mode = next; if (orbit) orbit.enabled = next === 'orbit'; keys.clear(); lookDrag = false;
  $('mode-fly').classList.toggle('active', next === 'fly'); $('mode-orbit').classList.toggle('active', next === 'orbit');
  $('navigation-hint').innerHTML = next === 'fly' ? '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>движение</span><kbd>Q</kbd><kbd>E</kbd><span>вниз / вверх · ПКМ — взгляд</span>' : '<span>ЛКМ / один палец — облёт · ПКМ / два пальца — сдвиг · колесо — масштаб</span>';
  viewport.classList.toggle('orbit-mode', next === 'orbit');
}
function resize() {
  if (!renderer) return;
  const width = Math.max(1, viewport.clientWidth), height = Math.max(1, viewport.clientHeight);
  renderer.setSize(width, height, false); frame = fitFrame(width, height, ASPECTS[cameraState.aspect], width < 600 ? 14 : 32);
  Object.assign($('camera-frame').style, { left: frame.x + 'px', top: frame.y + 'px', width: frame.width + 'px', height: frame.height + 'px' });
  needsRender = true;
}
function render() {
  if (!renderer || !frame || !loaded) return;
  const height = viewport.clientHeight;
  renderer.setScissorTest(false); renderer.setViewport(0, 0, viewport.clientWidth, height); renderer.setClearColor(0x0a0d0d, 1); renderer.clear();
  renderer.setViewport(frame.x, height - frame.y - frame.height, frame.width, frame.height);
  renderer.setScissor(frame.x, height - frame.y - frame.height, frame.width, frame.height); renderer.setScissorTest(true);
  renderer.setClearColor(0x181a1b, 1); renderer.render(scene, camera); renderer.setScissorTest(false); needsRender = false;
}
function snapshot({ width = 1920, guides = false } = {}) {
  if (!loaded) throw new Error('Сначала дождитесь загрузки локации.');
  const height = Math.round(width / ASPECTS[cameraState.aspect]);
  const oldPixelRatio = renderer.getPixelRatio();
  renderer.setPixelRatio(1); renderer.setSize(width, height, false); renderer.setViewport(0, 0, width, height); renderer.setScissorTest(false); renderer.setClearColor(0x181a1b, 1); renderer.render(scene, camera);
  const result = document.createElement('canvas'); result.width = width; result.height = height;
  const ctx = result.getContext('2d'); ctx.drawImage(renderer.domElement, 0, 0);
  if (guides) { ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1; if (cameraState.thirds) { for (const k of [1/3, 2/3]) { ctx.beginPath(); ctx.moveTo(width*k, 0); ctx.lineTo(width*k, height); ctx.moveTo(0,height*k); ctx.lineTo(width,height*k); ctx.stroke(); } } if (cameraState.safe) ctx.strokeRect(width*.05,height*.05,width*.9,height*.9); }
  renderer.setPixelRatio(oldPixelRatio); resize(); render();
  return result.toDataURL('image/png');
}
function storeShots() { try { localStorage.setItem(STORAGE, JSON.stringify(shots)); } catch { shots = shots.map(({ thumbnail, ...shot }) => shot); try { localStorage.setItem(STORAGE, JSON.stringify(shots)); } catch { toast('Браузер не разрешил хранение. Экспортируйте ракурсы в JSON.'); } } renderShots(); }
function renderShots() {
  $('shot-count').textContent = shots.length;
  $('shots').replaceChildren();
  if (!shots.length) { const empty = document.createElement('div'); empty.className = 'empty-shots'; empty.innerHTML = `${icon('camera')}<span>Первый ракурс начинается здесь<small>Сохраните положение камеры и объектив</small></span>`; $('shots').append(empty); return; }
  shots.forEach(shot => {
    const card = document.createElement('div'); card.className = 'shot-card';
    const load = document.createElement('button'); load.className = 'shot-load'; load.title = 'Открыть ракурс';
    if (typeof shot.thumbnail === 'string' && /^data:image\/png;base64,/.test(shot.thumbnail)) { const img = document.createElement('img'); img.src = shot.thumbnail; img.alt = ''; load.append(img); } else { const thumb = document.createElement('span'); thumb.className = 'shot-fallback'; thumb.innerHTML = icon('camera'); load.append(thumb); }
    const info = document.createElement('span'), title = document.createElement('strong'), detail = document.createElement('small'); title.textContent = shot.name || 'Ракурс'; detail.textContent = `${shot.state.focal} мм · ${shot.state.aspect} · ${(shot.state.position[1] - (metadata?.floorLevels?.find(f => f.id === shot.state.floor)?.height || 0)).toFixed(2)} м`; info.append(title, detail); load.append(info); load.addEventListener('click', () => { applyState(shot.state); toast('Ракурс открыт'); });
    const remove = document.createElement('button'); remove.className = 'shot-remove icon-button'; remove.title = 'Удалить ракурс'; remove.setAttribute('aria-label', 'Удалить ракурс ' + shot.name); remove.innerHTML = icon('close'); remove.addEventListener('click', () => { shots = shots.filter(s => s.id !== shot.id); storeShots(); });
    card.append(load, remove); $('shots').append(card);
  });
}
function wireUI() {
  $('mode-fly').onclick = () => setMode('fly'); $('mode-orbit').onclick = () => setMode('orbit');
  $('help').onclick = () => $('help-popover').hidden = !$('help-popover').hidden; $('close-help').onclick = () => $('help-popover').hidden = true;
  $('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await viewport.requestFullscreen(); } catch { toast('Полноэкранный режим недоступен в этом браузере.'); } };
  $('focal').addEventListener('change', () => { cameraState.focal = clamp(Number($('focal').value) || 24, 8, 300); updateUI(); updateLens(); });
  $('focal').addEventListener('input', () => { const value = Number($('focal').value); if ($('focal').value && Number.isFinite(value) && value >= 8 && value <= 300) { cameraState.focal = value; $('focal-range').value = value; document.querySelectorAll('[data-focal]').forEach(b => b.classList.toggle('active', Number(b.dataset.focal) === value)); updateLens(); } });
  $('focal-range').addEventListener('input', () => { cameraState.focal = Number($('focal-range').value); updateUI(); updateLens(); });
  document.querySelectorAll('[data-focal]').forEach(b => b.onclick = () => { cameraState.focal = Number(b.dataset.focal); updateUI(); updateLens(); });
  for (const id of ['sensor', 'aspect']) $(id).addEventListener('change', () => { cameraState[id] = $(id).value; if (id === 'sensor' && SENSORS[cameraState.sensor]) { cameraState.sensorWidth = SENSORS[cameraState.sensor].width; cameraState.sensorHeight = SENSORS[cameraState.sensor].height; } updateUI(); updateLens(); });
  for (const [id, key, min, max] of [['sensor-width','sensorWidth',5,80],['sensor-height','sensorHeight',3,80],['focus','focus',.1,100],['aperture','aperture',.7,64]]) $(id).addEventListener('change', () => { cameraState[key] = clamp(Number($(id).value) || min, min, max); updateUI(); updateLens(); });
  for (const id of ['furniture', 'roof']) $(id).addEventListener('change', () => { cameraState[id] = $(id).checked; updateVisibility(); });
  for (const [id,key] of [['thirds-toggle','thirds'],['safe-toggle','safe']]) $(id).addEventListener('change', () => { cameraState[key] = $(id).checked; updateUI(); });
  $('exposure').addEventListener('input', () => { cameraState.exposure = Number($('exposure').value); $('exposure-value').value = cameraState.exposure.toFixed(1); if (renderer) renderer.toneMappingExposure = cameraState.exposure; needsRender = true; });
  $('speed').addEventListener('input', () => { speed = Number($('speed').value); $('speed-value').value = speed.toFixed(1) + ' м/с'; });
  $('height').addEventListener('change', () => { if (!camera) return; const y = clamp(Number($('height').value) || 0, -1, 10) + currentFloor().height; const delta = y - camera.position.y; camera.position.y = y; orbit.target.y += delta; syncCameraState(); activePreset = null; setActivePreset(); updatePosition(); needsRender = true; });
  $('floor').addEventListener('change', () => { const height = camera ? camera.position.y - currentFloor().height : 1.6; cameraState.floor = $('floor').value; if (camera) { const delta = currentFloor().height + height - camera.position.y; camera.position.y += delta; orbit.target.y += delta; syncCameraState(); activePreset = null; setActivePreset(); updatePosition(); needsRender = true; } });
  for (const [index, axis] of ['x','y','z'].entries()) $('position-' + axis).addEventListener('change', () => { if (!camera) return; const val = Number($('position-' + axis).value); if (!Number.isFinite(val) || Math.abs(val) > 100) return updatePosition(); const delta = val - camera.position.getComponent(index); camera.position.setComponent(index, val); orbit.target.setComponent(index, orbit.target.getComponent(index) + delta); syncCameraState(); activePreset = null; setActivePreset(); updatePosition(); needsRender = true; });
  $('capture').onclick = () => { try { download(snapshot(), `BATYR_QUEST_${cameraState.focal}mm_${new Date().toISOString().slice(0,19).replaceAll(':','-')}.png`); toast('Кадр сохранён в PNG'); } catch (err) { toast(err.message); } };
  $('save-shot').onclick = () => { if (!loaded) return toast('Дождитесь загрузки локации.'); if (shots.length >= 50) return toast('Сохранено 50 ракурсов. Экспортируйте их или удалите лишние.'); const name = $('shot-name').value.trim() || `Ракурс ${shots.length + 1}`; shots.push({ id: crypto.randomUUID(), name, state: getState(), thumbnail: snapshot({width: 320}), created: new Date().toISOString() }); $('shot-name').value = ''; storeShots(); toast('Ракурс сохранён'); };
  $('share').onclick = async () => { if (!loaded) return toast('Дождитесь загрузки локации.'); const hash = 'shot=' + encodeState(getState()); history.replaceState(null, '', '#' + hash); try { await navigator.clipboard.writeText(location.href); toast('Ссылка на этот ракурс скопирована'); } catch { prompt('Ссылка на ракурс — скопируйте её:', location.href); } };
  $('export-shots').onclick = () => { const exportData = { format: 'batyr-camera-shots', version: 1, location: metadata?.title || 'PUNCH', exported: new Date().toISOString(), shots: shots.map(({thumbnail, ...s}) => s) }; download(new Blob([JSON.stringify(exportData, null, 2)], {type:'application/json'}), 'BATYR_QUEST_camera_shots.json'); toast('Ракурсы экспортированы'); };
  $('import-shots').onclick = () => $('import-file').click();
  $('import-file').addEventListener('change', async event => { const file = event.target.files[0]; if (!file) return; try { if (file.size > 2_000_000) throw new Error('Файл слишком большой. Максимум 2 МБ.'); const data = JSON.parse(await file.text()); const items = Array.isArray(data.shots) ? data.shots : [{ state: data, name: 'Импортированный ракурс' }]; if (!items.length || items.length > 50) throw new Error('В файле должно быть от 1 до 50 ракурсов.'); const imported = items.map((item, i) => ({ id: crypto.randomUUID(), name: String(item.name || `Ракурс ${i+1}`).slice(0,60), state: validateCameraState(item.state), created: new Date().toISOString() })); if (shots.length + imported.length > 50) throw new Error('В браузере можно хранить 50 ракурсов. Сначала удалите лишние.'); shots.push(...imported); storeShots(); toast(`Импортировано ракурсов: ${imported.length}`); } catch (err) { toast(err.message || 'Не удалось прочитать файл.'); } event.target.value = ''; });
  window.addEventListener('hashchange', () => { if (!loaded || !location.hash) return; try { applyState(decodeState(location.hash)); toast('Ракурс из ссылки открыт'); } catch (err) { toast(err.message); } });
  $('retry').onclick = () => location.reload();
}
function wireNavigation() {
  viewport.addEventListener('contextmenu', e => e.preventDefault());
  renderer.domElement.addEventListener('pointerdown', e => { viewport.focus({preventScroll: true}); if (mode !== 'fly' || e.button !== 2) return; lookDrag = true; dragLast = {x:e.clientX,y:e.clientY}; renderer.domElement.setPointerCapture(e.pointerId); e.preventDefault(); });
  renderer.domElement.addEventListener('pointermove', e => { if (!lookDrag || mode !== 'fly') return; const dx = e.clientX - dragLast.x, dy = e.clientY - dragLast.y; dragLast = {x:e.clientX,y:e.clientY}; euler.setFromQuaternion(camera.quaternion); euler.y -= dx*.0025; euler.x = clamp(euler.x-dy*.0025, -Math.PI*.49, Math.PI*.49); euler.z = 0; camera.quaternion.setFromEuler(euler); const distance = Math.max(.2,camera.position.distanceTo(orbit.target)); camera.getWorldDirection(direction); orbit.target.copy(camera.position).addScaledVector(direction,distance); syncCameraState(); activePreset = null; setActivePreset(); needsRender = true; });
  const release = () => lookDrag = false; renderer.domElement.addEventListener('pointerup', release); renderer.domElement.addEventListener('lostpointercapture', release);
  renderer.domElement.addEventListener('wheel', e => { if (mode !== 'fly' || !loaded) return; e.preventDefault(); camera.getWorldDirection(direction); const delta = -Math.sign(e.deltaY)*speed*.18; camera.position.addScaledVector(direction,delta); orbit.target.addScaledVector(direction,delta); syncCameraState(); activePreset = null; setActivePreset(); updatePosition(); needsRender = true; }, {passive:false});
  window.addEventListener('keydown', e => { if (mode !== 'fly' || document.activeElement !== viewport || !loaded || e.ctrlKey || e.metaKey || e.altKey) return; if (['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) { e.preventDefault(); keys.add(e.code); } });
  window.addEventListener('keyup', e => keys.delete(e.code)); window.addEventListener('blur', () => {keys.clear(); lookDrag=false;}); viewport.addEventListener('focusout', () => keys.clear());
}
function animate(time) {
  requestAnimationFrame(animate); const dt = Math.min((time-lastTime)/1000 || 0,.05); lastTime = time;
  if (!loaded) return;
  if (mode === 'fly' && keys.size) {
    camera.getWorldDirection(direction); right.crossVectors(direction, up).normalize(); const movement = new THREE.Vector3();
    if (keys.has('KeyW') || keys.has('ArrowUp')) movement.add(direction); if (keys.has('KeyS') || keys.has('ArrowDown')) movement.sub(direction);
    if (keys.has('KeyD') || keys.has('ArrowRight')) movement.add(right); if (keys.has('KeyA') || keys.has('ArrowLeft')) movement.sub(right);
    if (keys.has('KeyE')) movement.y += 1; if (keys.has('KeyQ')) movement.y -= 1;
    movement.normalize().multiplyScalar(speed*dt*((keys.has('ShiftLeft')||keys.has('ShiftRight'))?3:1)); camera.position.add(movement); orbit.target.add(movement); syncCameraState(); updatePosition(); needsRender = true; if (!moveOccurred) {activePreset=null;setActivePreset();moveOccurred=true;}
  } else moveOccurred=false;
  if (mode === 'orbit') orbit.update();
  if (needsRender) render();
}

async function start() {
  try {
    renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true, powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
    $('canvas-host').append(renderer.domElement); scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(45,16/9,.035,150); camera.position.fromArray(cameraState.position); camera.lookAt(0,1.6,0);
    orbit = new OrbitControls(camera,renderer.domElement); orbit.target.fromArray(cameraState.target); orbit.enableDamping = true; orbit.dampingFactor=.10; orbit.minDistance=.15; orbit.maxDistance=80; orbit.maxPolarAngle=Math.PI*.99; orbit.addEventListener('change', () => {needsRender=true; if (loaded&&mode==='orbit') {syncCameraState();updatePosition();activePreset=null;setActivePreset();}});
    setMode(mode); wireNavigation(); new ResizeObserver(resize).observe(viewport);
    const pmrem = new THREE.PMREMGenerator(renderer); const envScene = new RoomEnvironment(); const envTarget = pmrem.fromScene(envScene,.04); scene.environment=envTarget.texture; scene.environmentIntensity=.22; envScene.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xd6e0f1,0x615346,.6));
    const response = await fetch(base+'assets/scene-metadata.json'); if (!response.ok) throw new Error('Не удалось получить описание локации.'); metadata=await response.json();
    if (metadata.units !== 'metres' || metadata.up !== 'Y' || !metadata.modelFile || !Array.isArray(metadata.presets) || !metadata.presets.length) throw new Error('Файл локации имеет неподдерживаемый формат.');
    if (!/^[\w./-]+\.glb$/.test(metadata.modelFile) || metadata.modelFile.includes('..')) throw new Error('Некорректное имя модели.');
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(base+'assets/'+metadata.modelFile, e => { const total=e.total||metadata.modelBytes||0; if(total) {const percent=Math.min(99,Math.round(e.loaded/total*100));$('loading-progress').style.width=percent+'%';$('loading-detail').textContent=`${(e.loaded/1048576).toFixed(1)} / ${(total/1048576).toFixed(1)} МБ · ${percent}%`;} else $('loading-detail').textContent=`Получено ${(e.loaded/1048576).toFixed(1)} МБ`; });
    $('loading-title').textContent='Готовим первый кадр'; $('loading-detail').textContent='Настраиваем материалы и освещение';
    venue=gltf.scene; venue.updateMatrixWorld(true); let lightCount=0, meshCount=0;
    venue.traverse(o => {
      if(o.isLight){lightCount++;o.castShadow=false;if(lightCount>24)o.visible=false;}
      if(o.isMesh){meshCount++;o.frustumCulled=true;const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>{if(m)materialSet.add(m);});}
      const kind=String(o.userData?.kind||'').toLowerCase(), name=o.name||'';
      if(kind==='furniture'||kind==='prop'||/chair|stool|sofa|diningtable|roundtable|tabletop|cubetray|d20|clubmat|barprops/i.test(name)) furnitureNodes.push(o);
      if(kind==='ceiling'||kind==='roof'||/ceiling|roof/i.test(name)) roofNodes.push(o);
    });
    for(const material of materialSet){for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap'])if(material[key])material[key].anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
    scene.add(venue);
    $('floor').replaceChildren(); (metadata.floorLevels||[{id:'ground',label:'Основной зал',height:0}]).forEach(f=>{const option=document.createElement('option');option.value=f.id;option.textContent=f.label;$('floor').append(option);});
    $('presets').replaceChildren(); metadata.presets.forEach((preset,index)=>{const button=document.createElement('button');button.dataset.preset=preset.id;button.className='preset-button';const n=document.createElement('small');n.textContent=String(index+1).padStart(2,'0');const text=document.createElement('span');text.textContent=preset.label;button.append(n,text);button.addEventListener('click',()=>{const state=getState();state.position=preset.position;state.target=preset.target;if(preset.focal)state.focal=preset.focal;if(preset.floor)state.floor=preset.floor;else state.floor=(metadata.floorLevels||[]).reduce((best,f)=>Math.abs(preset.position[1]-f.height-1.6)<Math.abs(preset.position[1]-best.height-1.6)?f:best,{id:'ground',height:0}).id;applyState(state,{preset:preset.id});});$('presets').append(button);});
    const first=metadata.presets[0];let initial={...cameraState,position:first.position,target:first.target,focal:first.focal||24,floor:first.floor||metadata.floorLevels?.[0]?.id||'ground',exposure:metadata.suggestedExposure||1};
    let fromLink=false;if(location.hash){try{initial=decodeState(location.hash);fromLink=true;}catch{toast('Ссылка на ракурс повреждена. Открыт начальный вид.');}}
    loaded=true;applyState(initial,{preset:fromLink?null:first.id}); await renderer.compileAsync(scene,camera); resize(); render();
    $('loading').hidden=true;$('scene-state').textContent='ГОТОВО';$('scene-state').classList.add('ready');$('model-label').textContent='PUNCH / МЕТРЫ';
    renderShots();
    window.__BATYR_CAMERA__={getState,applyState,snapshot,get metadata(){return metadata;},get sceneReady(){return loaded;},getStats:()=>({meshes:meshCount,materials:materialSet.size,lights:lightCount,furnitureNodes:furnitureNodes.length,roofNodes:roofNodes.length,renderer:renderer.info.render,frame}),setPreset:id=>$('presets').querySelector(`[data-preset="${CSS.escape(id)}"]`)?.click(),get camera(){return camera;},get scene(){return scene;}};
  } catch(err) {
    console.error('Camera Scout:',err); $('loading-title').textContent=renderer?'Не удалось загрузить локацию':'3D недоступно в этом браузере';$('loading-detail').textContent=renderer?(err.message||'Проверьте соединение и повторите загрузку.'):'Включите аппаратное ускорение и WebGL 2 или откройте страницу в другом браузере.';$('loading').classList.add('error');$('retry').hidden=false;$('scene-state').textContent='ОШИБКА';
  }
}
wireUI();renderShots();updateUI();updateLens();setMode(mode);requestAnimationFrame(animate);start();

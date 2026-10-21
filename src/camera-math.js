export const SENSORS = {
  full: { label: 'Full Frame · 36 × 24', width: 36, height: 24 },
  s35: { label: 'Super 35 · 24.89 × 18.66', width: 24.89, height: 18.66 },
  apsc: { label: 'APS-C · 23.5 × 15.6', width: 23.5, height: 15.6 },
  mft: { label: 'Micro 4/3 · 17.3 × 13', width: 17.3, height: 13 },
};
export const ASPECTS = { '16:9': 16 / 9, '2.39:1': 2.39, '4:3': 4 / 3, '9:16': 9 / 16 };
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// A centered gate cropped inside the physical sensor, without stretching.
export function optics(focal, sensorWidth, sensorHeight, aspect, focus = 3, aperture = 4) {
  if (![focal, sensorWidth, sensorHeight, aspect, focus, aperture].every(v => Number.isFinite(v) && v > 0)) throw new Error('Invalid optical parameters');
  const gateWidth = Math.min(sensorWidth, sensorHeight * aspect);
  const gateHeight = gateWidth / aspect;
  const hfov = 2 * Math.atan(gateWidth / (2 * focal)) * 180 / Math.PI;
  const vfov = 2 * Math.atan(gateHeight / (2 * focal)) * 180 / Math.PI;
  const coc = Math.hypot(sensorWidth, sensorHeight) / 1500;
  const hyperfocal = focal * focal / (aperture * coc) + focal;
  const distance = focus * 1000;
  const near = hyperfocal * distance / (hyperfocal + distance - focal) / 1000;
  const farDenom = hyperfocal - distance + focal;
  const far = farDenom > 0 ? hyperfocal * distance / farDenom / 1000 : Infinity;
  return { gateWidth, gateHeight, hfov, vfov, near, far, hyperfocal: hyperfocal / 1000, widthAtFocus: focus * gateWidth / focal, heightAtFocus: focus * gateHeight / focal };
}

export function fitFrame(width, height, aspect, margin = 34) {
  const availableWidth = Math.max(1, width - 2 * margin);
  const availableHeight = Math.max(1, height - 2 * margin);
  const frameWidth = Math.min(availableWidth, availableHeight * aspect);
  const frameHeight = frameWidth / aspect;
  return { x: (width - frameWidth) / 2, y: (height - frameHeight) / 2, width: frameWidth, height: frameHeight };
}

const vec = value => Array.isArray(value) && value.length === 3 && value.every(n => Number.isFinite(n) && Math.abs(n) < 1000);
export function validateCameraState(value) {
  if (!value || typeof value !== 'object' || !vec(value.position) || !vec(value.target)) throw new Error('В файле нет корректного положения камеры.');
  if (Math.hypot(...value.position.map((n, i) => n - value.target[i])) < .01) throw new Error('Направление камеры не задано.');
  const numeric = (key, fallback, min, max) => {
    const v = value[key] ?? fallback;
    if (!Number.isFinite(v) || v < min || v > max) throw new Error(`Некорректный параметр: ${key}`);
    return v;
  };
  const sensor = Object.hasOwn(SENSORS, value.sensor) || value.sensor === 'custom' ? value.sensor : 'full';
  const width = numeric('sensorWidth', 36, 5, 80), height = numeric('sensorHeight', 24, 3, 80);
  return {
    version: 1, position: [...value.position], target: [...value.target],
    focal: numeric('focal', 24, 8, 300),
    sensor,
    sensorWidth: SENSORS[sensor]?.width ?? width, sensorHeight: SENSORS[sensor]?.height ?? height,
    aspect: Object.hasOwn(ASPECTS, value.aspect) ? value.aspect : '16:9',
    aperture: numeric('aperture', 4, .7, 64), focus: numeric('focus', 3, .1, 100),
    furniture: value.furniture !== false, roof: value.roof !== false,
    thirds: value.thirds !== false, safe: value.safe === true,
    exposure: numeric('exposure', 1, .2, 3),
    floor: typeof value.floor === 'string' ? value.floor.slice(0, 60) : 'ground',
  };
}

export function encodeState(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(validateCameraState(state)));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export function decodeState(hash) {
  const encoded = hash.replace(/^#(?:shot=)?/, '');
  if (encoded.length > 12000) throw new Error('Ссылка слишком длинная.');
  const binary = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'));
  return validateCameraState(JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)))));
}

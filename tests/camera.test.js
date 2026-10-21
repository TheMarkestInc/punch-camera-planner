import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optics, fitFrame, validateCameraState, encodeState, decodeState } from '../src/camera-math.js';

test('50 mm full frame gives physical horizontal field and a cropped 16:9 gate', () => {
  const result = optics(50, 36, 24, 16 / 9);
  assert.ok(Math.abs(result.hfov - 39.5977527) < .00001);
  assert.equal(result.gateWidth, 36);
  assert.equal(result.gateHeight, 20.25);
  assert.ok(Math.abs(result.widthAtFocus - 2.16) < .00001);
});
test('portrait gate crops sensor width and does not swap sensor dimensions', () => {
  const result = optics(24, 36, 24, 9 / 16);
  assert.equal(result.gateWidth, 13.5);
  assert.equal(result.gateHeight, 24);
  assert.ok(result.vfov > result.hfov);
});
test('focal length and smaller sensors narrow field; distant focus gives infinite far DOF', () => {
  assert.ok(optics(50, 36, 24, 16 / 9).hfov < optics(24, 36, 24, 16 / 9).hfov);
  assert.ok(optics(24, 17.3, 13, 16 / 9).hfov < optics(24, 36, 24, 16 / 9).hfov);
  assert.equal(optics(12, 36, 24, 16 / 9, 20, 8).far, Infinity);
});
test('frame fits requested aspect inside both landscape and portrait viewports', () => {
  for (const [w, h, a] of [[1000, 600, 16 / 9], [400, 800, 16 / 9], [1000, 600, 9 / 16]]) {
    const f = fitFrame(w, h, a);
    assert.ok(Math.abs(f.width / f.height - a) < .000001);
    assert.ok(f.x >= 33.99 && f.y >= 33.99);
    assert.ok(f.x + f.width <= w && f.y + f.height <= h);
  }
});
test('camera share state round trips and rejects invalid imports', () => {
  const state = validateCameraState({ position: [1, 1.6, 2], target: [0, 1, 0], focal: 35, sensor: 's35', aspect: '2.39:1', furniture: false });
  assert.equal(state.sensorWidth, 24.89);
  assert.equal(state.sensorHeight, 18.66);
  assert.deepEqual(decodeState(encodeState(state)), state);
  assert.throws(() => validateCameraState({ position: [NaN, 0, 0], target: [0, 1, 0] }));
  assert.throws(() => validateCameraState({ position: [0, 0, 0], target: [0, 0, 0] }));
  assert.throws(() => validateCameraState({ position: [0, 1, 0], target: [1, 1, 1], focal: 0 }));
});

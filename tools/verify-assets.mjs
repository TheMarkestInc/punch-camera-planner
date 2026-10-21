import { readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const base = new URL('../public/assets/', import.meta.url);
const metadata = JSON.parse(await readFile(new URL('scene-metadata.json', base), 'utf8'));
assert.equal(metadata.units, 'metres');
assert.equal(metadata.up, 'Y');
assert(metadata.presets.length >= 3);
assert(metadata.floorLevels.some(x => x.height === 2.45));
const bytes = await readFile(new URL(metadata.modelFile, base));
assert.equal(bytes.toString('ascii', 0, 4), 'glTF', 'Model must be materialized GLB, not an LFS pointer.');
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
assert(bytes.length < 100 * 1024 * 1024, 'Browser payload unexpectedly large.');
const jsonSize = bytes.readUInt32LE(12);
assert.equal(bytes.toString('ascii', 16, 20), 'JSON');
const document = JSON.parse(bytes.toString('utf8', 20, 20 + jsonSize));
assert(document.meshes.length > 10, 'Venue geometry missing.');
assert(!document.buffers.some(x => x.uri?.startsWith('http')), 'Scene must be self-contained.');
assert(!document.images?.some(x => x.uri?.startsWith('http')), 'Textures must be self-contained.');
for (const node of document.nodes) {
  for (const key of ['translation', 'rotation', 'scale', 'matrix']) {
    if (node[key]) assert(node[key].every(Number.isFinite), `${node.name}: invalid ${key}`);
  }
}
for (const p of metadata.presets) {
  assert(p.position.length === 3 && p.target.length === 3);
  assert([...p.position, ...p.target].every(Number.isFinite));
}
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (metadata.modelSha256) assert.equal(sha256, metadata.modelSha256);
if (metadata.modelBytes) assert.equal(bytes.length, metadata.modelBytes);
console.log(JSON.stringify({ status: 'passed', bytes: bytes.length, sha256, nodes: document.nodes.length, meshes: document.meshes.length, presets: metadata.presets.length }));

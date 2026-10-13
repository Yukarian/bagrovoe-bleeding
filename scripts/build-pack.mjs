import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { compilePack, extractPack } from '@foundryvtt/foundryvtt-cli';
import { organizePack } from './pack-folders.mjs';

const manifest = JSON.parse(fs.readFileSync('module.json', 'utf8'));
const expected = { 'blood-spells': 30, actors: 17, abilities: 96, relics: 7, 'iron-hounds': 8, settlements: 2, 'suigu-residents': 8, 'key-npcs': 2 };
const scratch = fs.mkdtempSync(path.resolve('.build-'));
const assetPrefix = `modules/${manifest.id}/`;
function validate(value) {
  if (typeof value === 'string') {
    assert.ok(!value.includes('modules/bagrovoe-content/'), `Old module path: ${value}`);
    for (const match of value.matchAll(/modules\/bagrovoe-bleeding\/[^\s"'<>]+/g)) {
      const relative = decodeURIComponent(match[0].slice(assetPrefix.length));
      assert.ok(!relative.split('/').includes('..') && fs.existsSync(relative), `Missing asset: ${relative}`);
    }
  } else if (value && typeof value === 'object') Object.values(value).forEach(validate);
}
function keys(d, collection, parent='') {
  assert.match(d._id, /^[A-Za-z0-9]{16}$/);
  d._key = `!${collection}!${parent}${d._id}`;
  for (const child of ['items', 'effects', 'pages']) {
    const seen = new Set();
    for (const e of d[child] ?? []) {
      assert.ok(!seen.has(e._id), `Duplicate embedded ID in ${d.name}`);seen.add(e._id);
      keys(e, collection + '.' + child, parent + d._id + '.');
    }
  }
}
function stripKeys(v) {
  if (Array.isArray(v)) return v.map(stripKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k])=>k !== '_key').map(([k,x])=>[k,stripKeys(x)]));
  return v;
}
try {
  for (const pack of manifest.packs) {
    const {docs,folders} = organizePack(pack,JSON.parse(fs.readFileSync(`packs-src/${pack.name}.json`, 'utf8')));
    assert.equal(docs.length, expected[pack.name]);
    const src = path.join(scratch, pack.name), out = path.join(scratch, pack.name + '-roundtrip');
    fs.mkdirSync(src);
    const seen = new Set();
    for (const doc of docs) {
      assert.ok(!seen.has(doc._id));seen.add(doc._id);validate(doc);
      assert.ok(pack.type === 'JournalEntry' ? Array.isArray(doc.pages) : pack.type === 'Actor' ? doc.type === 'npc' : ['spell','feat','weapon','equipment','consumable'].includes(doc.type));
      keys(doc, {Actor:'actors',Item:'items',JournalEntry:'journal'}[pack.type]);
      fs.writeFileSync(path.join(src, doc._id + '.json'), JSON.stringify(doc));
    }
    for(const folder of folders){
      assert.ok(!seen.has(folder._id));seen.add(folder._id);
      keys(folder,'folders');
      fs.writeFileSync(path.join(src, folder._id+'.json'),JSON.stringify(folder));
    }
    assert.ok(docs.every(d=>folders.some(f=>f._id===d.folder)));
    await compilePack(src, pack.path);
    await extractPack(pack.path, out);
    const restored = fs.readdirSync(out).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(out,f),'utf8')));
    assert.equal(restored.length, docs.length+folders.length);
    const sort = d => d.map(stripKeys).sort((a,b)=>a._id.localeCompare(b._id));
    assert.deepEqual(sort(restored), sort([...docs,...folders]), `Roundtrip failed: ${pack.name}`);
    console.log(`Verified ${pack.name}: ${docs.length} documents, ${folders.length} folders, embedded items/effects and asset paths`);
  }
} finally {
  // mkdtemp creates this directory directly under the repository; never remove external paths.
  assert.equal(path.dirname(scratch), process.cwd());
  fs.rmSync(scratch, {recursive:true,force:true});
}

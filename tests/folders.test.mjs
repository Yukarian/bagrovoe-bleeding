import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {organizePack} from '../scripts/pack-folders.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../module.json',import.meta.url)));
for(const pack of manifest.packs)test(`${pack.name}: folder membership, stable IDs and source preservation`,()=>{
 const source=JSON.parse(fs.readFileSync(new URL(`../packs-src/${pack.name}.json`,import.meta.url)));
 const before=structuredClone(source),{docs,folders}=organizePack(pack,source);
 assert.deepEqual(source,before);assert.deepEqual(organizePack(pack,source),{docs,folders});
 const ids=new Set(folders.map(f=>f._id));assert.equal(ids.size,folders.length);
 for(const f of folders){assert.equal(f.type,pack.type);assert.match(f._id,/^[a-z0-9]{16}$/);assert.ok(docs.some(d=>d.folder===f._id));}
 for(const [i,d] of docs.entries()){assert.ok(ids.has(d.folder));assert.deepEqual({...d,folder:before[i].folder},{...before[i],folder:before[i].folder});}
});
test('all compendiums appear exactly once in the sidebar hierarchy; no legacy world loader',()=>{
 const names=[];function walk(folders){for(const f of folders){names.push(...(f.packs??[]));walk(f.folders??[]);}}
 walk(manifest.packFolders);assert.deepEqual(names.sort(),manifest.packs.map(p=>p.name).sort());
 assert.ok(!manifest.esmodules.includes('bandits/iron-hounds.js'));
});
test('Iron Hounds are a separate native roster with stable embedded IDs and attack formulas',()=>{
 const actors=JSON.parse(fs.readFileSync(new URL('../packs-src/iron-hounds.json',import.meta.url)));
 assert.equal(actors.length,8);assert.equal(actors.find(a=>a.name==='Родерик Варн').system.details.cr,6);
 assert.equal(new Set(actors.map(a=>a._id)).size,8);
 for(const a of actors){
  assert.equal(a.flags['bagrovoe-bleeding'].ironHound,!a.flags['bagrovoe-bleeding'].genericBandit);
  assert.equal(new Set(a.items.map(i=>i._id)).size,a.items.length);
  for(const i of a.items){assert.match(i._id,/^[a-z0-9]{16}$/);for(const activity of Object.values(i.system.activities)){
   if(activity.type!=='attack')continue;assert.equal(activity.attack.flat,true);assert.ok(Number(activity.attack.bonus)>0);
   assert.ok(activity.damage.parts[0].number>0);assert.ok(activity.damage.parts[0].denomination>=4);assert.equal(activity.damage.parts[0].custom.enabled,false);
  }}
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bloodBalancePatch} from '../scripts/blood-balance.mjs';
const load=name=>JSON.parse(fs.readFileSync(new URL('../packs-src/'+name+'.json',import.meta.url)));
test('blood spell upgrades agree with native activities on library and NPC copies and run only once',()=>{
 const spells=load('blood-spells');
 assert.equal(spells.length,30);
 const changed=new Set();
 for(const item of [...spells,...load('abilities'),...load('actors').flatMap(a=>a.items)]){
  const patch=bloodBalancePatch(item);
  if(!Object.keys(patch).length)continue;
  const key=item.flags['bagrovoe-bleeding'].spellKey;changed.add(key);
  for(const [path,v] of Object.entries(patch)){
   const bits=path.split('.'),last=bits.pop();bits.reduce((obj,k)=>obj[k],item)[last]=v;
  }
  assert.deepEqual(bloodBalancePatch(item),{},item.name);
  for(const a of Object.values(item.system.activities)){
   const part=a.damage?.parts?.[0];
   if(part?.number)assert.ok(item.system.description.value.includes(part.number+'к'+part.denomination),item.name);
   if(a.healing)assert.ok(item.system.description.value.includes(a.healing.bonus+' временных'),item.name);
  }
 }
 assert.equal(changed.size,15);
});

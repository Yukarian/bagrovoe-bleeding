import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const MOD='bagrovoe-bleeding',read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url))),all=read('packs-src/key-npcs.json'),pair=all.filter(a=>a.flags[MOD].midnight);
const item=(a,k)=>a.items.find(i=>i.system.identifier===k),acts=i=>Object.values(i.system.activities);
test('two distinct level20 aasimar NPCs have correct half-caster slots and unchanged token provenance',()=>{
 assert.deepEqual(pair.map(a=>a.name),['Нимраэль','Эзракиль']);assert.equal(new Set(pair.map(a=>a._id)).size,2);
 const hashes=read('assets/midnight/provenance.json').sha256;
 for(const a of pair){assert.equal(a.type,'npc');assert.equal(a.flags[MOD].classLevel,20);assert.equal(a.system.details.type.value,'humanoid');assert.equal(a.system.details.type.subtype,'Аасимар');assert.deepEqual(Object.values(a.system.spells).map(x=>x.value),[4,3,3,3,2,0,0,0,0]);assert.equal(a.system.resources.legact.max,0);assert.equal(a.ownership.default,0);assert.equal(a.prototypeToken.actorLink,true);assert.equal(a.prototypeToken.texture.src,a.img);const file=a.flags[MOD].sourceSlug+'.png';assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../assets/midnight/'+file,import.meta.url))).digest('hex'),hashes[file]);}
});
test('channel divinity is shared by oath powers, with one use on short rest and all on long rest',()=>{
 for(const a of pair){const c=item(a,'midnight-channel');assert.equal(c.system.uses.max,'3');assert.deepEqual(c.system.uses.recovery,[{period:'lr',type:'recoverAll'},{period:'sr',type:'formula',formula:'1'}]);for(const key of ['midnight-night-cloak','midnight-abjure'])assert.deepEqual(acts(item(a,key))[0].consumption.targets,[{type:'itemUses',target:c._id,value:'1'}]);assert.equal(acts(item(a,'midnight-night-cloak'))[0].duration.concentration,true);}
});
test('shadow smites are bonus-action alternatives spending exactly one channel and one slot',()=>{
 for(const a of pair){const s=item(a,'divine-smite'),c=item(a,'midnight-channel');assert.equal(s.system.level,1);const night=acts(s).filter(x=>x.name.startsWith('Клинок тени'));assert.equal(night.length,4);for(const x of night){assert.equal(x.activation.type,'bonus');assert.equal(x.consumption.spellSlot,true);assert.deepEqual(x.consumption.targets,[{type:'itemUses',target:c._id,value:'1'}]);assert.ok([8,9].includes(x.damage.parts[0].number));assert.equal(x.damage.parts[0].scaling.number,1);assert.ok(['psychic','necrotic'].includes(x.damage.parts[0].types[0]));}
 const free=acts(s).filter(x=>!x.consumption.spellSlot);assert.equal(free.length,2);for(const x of free){assert.equal(x.activation.type,'bonus');assert.deepEqual(x.consumption.targets,[{type:'itemUses',target:'',value:'1'}]);assert.equal(x.damage.parts[0].scaling.number,0);}}
});
test('healing pools and replenishment do not invent free additional actions',()=>{
 for(const a of pair){const h=item(a,'midnight-lay-on-hands');assert.equal(h.system.uses.max,'100');assert.equal(acts(h)[0].activation.type,'bonus');assert.equal(acts(h)[0].healing.custom.formula,'@scaling');assert.equal(acts(h)[0].consumption.targets[0].scaling.mode,'amount');assert.equal(acts(h)[1].consumption.targets[0].value,'5');const race=item(a,'midnight-healing-hands');assert.equal(race.system.uses.max,'1');assert.equal(acts(race)[0].healing.number,6);assert.equal(acts(race)[0].activation.type,'action');const nightmare=acts(item(a,'midnight-nightmare'));assert.ok(nightmare.every(x=>x.activation.type==='bonus'));assert.deepEqual(nightmare[1].consumption.targets,[{type:'attribute',target:'spells.spell5.value',value:'1'}]);}
});
test('reaction choices and anti-prison spell have explicit costs; counterspell uses 2024 save',()=>{
 assert.ok(item(pair[0],'midnight-interpose'));assert.ok(!item(pair[1],'midnight-interpose'));assert.ok(!item(pair[0],'counterspell'));const counter=acts(item(pair[1],'counterspell'))[0];assert.deepEqual(counter.save.ability,['con']);
 for(const a of pair){const step=item(a,'midnight-shadow-jump');assert.equal(acts(step)[0].activation.type,'reaction');assert.equal(step.system.uses.max,'1');const s=item(a,'midnight-open-threshold');assert.equal(s.system.level,5);assert.equal(s.system.uses.max,'1');assert.equal(acts(s)[0].consumption.spellSlot,true);assert.equal(acts(s)[0].consumption.targets[0].value,'1');assert.equal(acts(item(a,'black-tentacles'))[0].damage.onSave,'none');assert.equal(acts(item(a,'black-tentacles'))[1].consumption.spellSlot,false);}
});
test('all resource references, effects and primary save abilities resolve inside portable actor',()=>{
 for(const a of pair){assert.doesNotMatch(JSON.stringify(a),/@classes\.|@scale\.|@flags\./);for(const i of a.items){for(const x of acts(i)){if(x.save)assert.ok(Array.isArray(x.save.ability));for(const t of x.consumption.targets)if(t.type==='itemUses'&&t.target)assert.ok(a.items.some(i=>i._id===t.target),t.target);for(const e of x.effects??[])assert.ok(i.effects.some(f=>f._id===e._id));}}assert.equal(a.effects.length,1);assert.equal(a.effects[0].system.changes[0].value,'@abilities.cha.mod');}
});
test('private order lore and both Morkant presets explain the escort and preserve his actual goal',()=>{
 const journals=read('packs-src/key-npc-lore.json'),j=journals.find(j=>j.flags[MOD].midnight);assert.equal(j.ownership.default,0);assert.equal(j.pages.length,8);assert.ok(j.pages.every(p=>p.ownership.default===0));for(const a of all.filter(a=>a.flags[MOD].archmage)){assert.match(a.system.details.biography.value,/Нимраэль и Эзракиль/);assert.match(a.system.details.biography.value,/воскрешения живым человеком/);assert.equal(a.system.attributes.hp.max,255);}
});

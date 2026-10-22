import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const MOD='bagrovoe-bleeding',read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url))),actors=read('packs-src/key-npcs.json').filter(a=>a.flags[MOD].archmage),[human,dragon]=actors;
const item=(a,k)=>a.items.find(i=>i.system.identifier===k),acts=i=>Object.values(i.system.activities);
test('archmage has two portable NPC presets with the same embedded resources and one identity',()=>{
 assert.equal(actors.length,2);assert.notEqual(human._id,dragon._id);assert.deepEqual(human.items,dragon.items);
 for(const a of actors){assert.equal(a.name,'Безымянный архимаг');assert.equal(a.type,'npc');assert.equal(a.system.details.type.value,'undead');assert.equal(a.system.attributes.hp.max,255);assert.equal(a.system.attributes.ac.flat,19);assert.equal(a.system.details.cr,20);assert.equal(a.system.attributes.spell.level,20);assert.equal(a.system.abilities.int.value,24);assert.equal(a.prototypeToken.actorLink,true);assert.equal(a.ownership.default,0);assert.deepEqual(Object.values(a.system.spells).map(x=>x.value),[4,3,3,3,3,2,2,1,1]);assert.equal(a.system.resources.legres.max,3);assert.equal(a.system.resources.legact.max,3);}
 assert.equal(human.system.traits.size,'med');assert.equal(dragon.system.traits.size,'huge');assert.equal(dragon.system.abilities.str.value,27);assert.equal(dragon.system.attributes.movement.speeds.fly,'80');
});
test('legendary actions and resistance consume the correct single native resource',()=>{
 for(const key of ['archmage-legend-bolt','archmage-legend-step','archmage-legend-rend']){const x=acts(item(human,key))[0];assert.equal(x.activation.type,'legendary');assert.deepEqual(x.consumption.targets,[{type:'attribute',target:'resources.legact.value',value:key==='archmage-legend-step'?'2':'1'}]);assert.equal(x.consumption.spellSlot,false);}
 assert.deepEqual(acts(item(human,'archmage-resistance'))[0].consumption.targets,[{type:'attribute',target:'resources.legres.value',value:'1'}]);
});
test('dragon breath has one rechargeable use and fixed DC21; physical attacks never double-add damage',()=>{
 const b=item(dragon,'archmage-breath'),x=acts(b)[0];assert.equal(b.system.uses.max,'1');assert.deepEqual(b.system.uses.recovery,[{period:'recharge',formula:'5',type:'recoverAll'}]);assert.equal(x.save.dc.formula,'21');assert.equal(x.damage.parts[0].number,17);assert.equal(x.target.template.size,'60');
 for(const k of ['archmage-rend','archmage-legend-rend']){const x=acts(item(dragon,k))[0];assert.equal(x.attack.bonus,'14');assert.equal(x.attack.flat,true);assert.equal(x.damage.includeBase,false);assert.equal(x.damage.parts[0].bonus,'8');}
});
test('2024 spellbook charges once for casts, not for continuing spell actions',()=>{
 const spells=human.items.filter(i=>i.type==='spell');assert.equal(spells.length,24);
 for(const s of spells){assert.equal(s.system.method,'spell');assert.equal(s.system.source.rules,'2024');assert.ok(acts(s).some(x=>x.consumption.spellSlot===Boolean(s.system.level)));for(const x of acts(s))if(x.save)assert.ok(Array.isArray(x.save.ability));}
 const counter=acts(item(human,'counterspell'))[0];assert.deepEqual(counter.save.ability,['con']);
 assert.equal(acts(item(human,'dimension-door')).find(x=>x.type==='damage').consumption.spellSlot,false);
 for(const key of ['magic-missile','telekinesis'])assert.ok(acts(item(human,key)).some(x=>!x.consumption.spellSlot));
 assert.equal(acts(item(human,'maze')).find(x=>x.type==='check').consumption.spellSlot,false);
 assert.equal(acts(item(human,'maze')).find(x=>x.type==='utility').consumption.spellSlot,true);
 assert.equal(acts(item(human,'wall-of-fire')).find(x=>x.type==='damage').consumption.spellSlot,false);
 assert.equal(acts(item(human,'fire-bolt'))[0].damage.parts[0].number,4);
});
test('form change updates physical stats and token size but retains every spent resource and effects',async()=>{
 const hooks={},a=structuredClone(human),warnings=[];a.id=a._id;a.isOwner=true;a.getFlag=(m,k)=>a.flags[m]?.[k];a.name='Новое имя';a.system.attributes.hp.value=71;a.system.attributes.hp.temp=13;a.system.spells.spell9.value=0;a.system.resources.legres.spent=2;a.system.resources.legact.spent=3;item(a,'archmage-breath').system.uses.spent=1;a.effects=[{_id:'concentration'}];
 const before=structuredClone({hp:a.system.attributes.hp,spells:a.system.spells,resources:a.system.resources,items:a.items,effects:a.effects});
 const put=(k,v)=>{const p=k.split('.'),end=p.pop();let o=a;for(const k of p)o=o[k]??={};o[end]=v;};a.update=async patch=>{for(const[k,v]of Object.entries(patch))put(k,v);};
 const ctx=vm.createContext({console,game:{user:{isGM:true},scenes:[]},Hooks:{on:(k,f)=>hooks[k]=f,once:()=>{}},ui:{notifications:{warn:s=>warnings.push(s)}},structuredClone});vm.runInContext(fs.readFileSync(new URL('../scripts/key-npcs.mjs',import.meta.url),'utf8').replaceAll('export ',''),ctx);
 const breath=item(a,'archmage-breath');breath.actor=a;assert.equal(ctx.validateKeyUse({item:breath},{},{}),false);delete breath.actor;
 await ctx.setForm(a,'dragon');assert.equal(a.system.abilities.str.value,27);assert.equal(a.system.abilities.con.value,25);assert.equal(a.prototypeToken.width,3);
 await ctx.setForm(a,'human');assert.equal(a.system.abilities.str.value,12);assert.equal(a.system.abilities.con.value,18);assert.equal(a.prototypeToken.width,1);assert.equal(a.name,'Новое имя');
 assert.deepEqual({hp:a.system.attributes.hp,spells:a.system.spells,resources:a.system.resources,items:a.items,effects:a.effects},before);
});
test('secrets and draft dagger are private and do not implement unapproved resurrection',()=>{
 const j=read('packs-src/key-npc-lore.json')[0];assert.equal(j.ownership.default,0);assert.equal(j.pages.length,10);assert.ok(j.pages.every(p=>p.ownership.default===0));const d=read('packs-src/world-items.json').find(i=>i.flags[MOD].archmage);assert.equal(d.flags[MOD].draft,true);assert.equal(d.ownership.default,0);assert.equal(acts(d).length,1);assert.equal(acts(d)[0].type,'attack');assert.equal(d.system.uses.max,'');assert.ok(!human.items.some(i=>i.system.identifier===d.system.identifier));
 const m=read('module.json');assert.equal(m.packs.find(p=>p.name==='key-npc-lore').ownership.PLAYER,'NONE');
});
test('approved image copies match recorded original SHA256',()=>{
 const provenance=read('assets/archmage/provenance.json');for(const [file,expected]of Object.entries(provenance.sha256)){const bytes=fs.readFileSync(new URL('../assets/archmage/'+file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),expected);}
});

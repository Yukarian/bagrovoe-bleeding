import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {organizePack} from '../scripts/pack-folders.mjs';
const MOD='bagrovoe-bleeding',all=JSON.parse(fs.readFileSync(new URL('../packs-src/key-npcs.json',import.meta.url))),actors=all.filter(a=>a.flags[MOD].towerCouncil);
const get=(a,k)=>a.items.find(i=>i.system.identifier===k),acts=i=>Object.values(i.system.activities||{});
const put=(o,k,v)=>{const p=k.split('.'),last=p.pop();for(const s of p)o=o[s]??={};o[last]=v;};
function doc(o){o.id=o._id||'id';o.uuid=o.uuid||'Item.'+o.id;o.getFlag=(m,k)=>o.flags?.[m]?.[k];o.setFlag=async(m,k,v)=>{o.flags??={};(o.flags[m]??={})[k]=v;};o.update=async patch=>{for(const [k,v]of Object.entries(patch))put(o,k,v);};return o;}
function harness(){const notices=[],hooks={},gm={id:'gm',isGM:true};const game={user:gm,users:Object.assign([gm],{activeGM:gm}),modules:new Map([[MOD,{}]])};const c=vm.createContext({console,game,Hooks:{on:(k,f)=>hooks[k]=f,once:(k,f)=>hooks[k]=f},ui:{notifications:{warn:s=>notices.push(s),error:s=>notices.push(s)}},foundry:{applications:{api:{DialogV2:{wait:async()=>null}}}},Roll:class{async evaluate(){return {total:4,toMessage:async()=>{}};}}});vm.runInContext(fs.readFileSync(new URL('../scripts/tower.mjs',import.meta.url),'utf8').replaceAll('export ',''),c);const actor=doc(structuredClone(actors[0]));actor.isOwner=true;actor.items=actor.items.map(doc);actor.items.get=id=>actor.items.find(i=>i.id===id);return {c,game,actor,notices,hooks};}

test('six representatives are in one native Tower folder with genuine class levels and independent inventories',()=>{
 assert.equal(actors.length,6);assert.deepEqual(actors.map(a=>a.items.find(i=>i.type==='class').system.levels),[20,18,18,17,18,16]);
 const pack=organizePack({name:'key-npcs',type:'Actor'},all),folder=pack.folders.find(f=>f.name==='Башня магов');assert.ok(folder);assert.equal(pack.docs.filter(a=>a.folder===folder._id).length,6);
 for(const a of actors){const cls=a.items.find(i=>i.type==='class');assert.equal(a.system.details.level,0);assert.equal(a.system.attributes.hp.formula.split('d')[0],'0','Class dice must not be counted twice');assert.equal(cls.system.hd.spent,0);assert.equal(a.ownership.default,0);assert.equal(a.prototypeToken.ring.enabled,false);assert.ok(a.items.filter(i=>i.type==='spell').length>=19);assert.equal(new Set(a.items.map(i=>i._id)).size,a.items.length);}
});
test('spell DC, proficiencies and slot budgets follow class levels, not an unrelated cloned NPC',()=>{
 const dcs=[21,20,20,20,20,19],slots=[[4,3,3,3,3,2,2,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,2,0,0,0,0,0]];
 for(const [n,a]of actors.entries()){const level=a.items.find(i=>i.type==='class').system.levels,ability=a.system.attributes.spellcasting,pb=Math.ceil(Math.max(a.system.details.cr,level)/4)+1;assert.equal(8+pb+Math.floor((a.system.abilities[ability].value-10)/2),dcs[n]);assert.deepEqual(Array.from({length:9},(_,i)=>a.system.spells['spell'+(i+1)].override),slots[n]);for(const s of a.items.filter(i=>i.type==='spell')){assert.equal(s.system.ability,ability);assert.equal(s.system.prepared,1);for(const x of acts(s))if(!s.system.level||s.system.method==='innate')assert.equal(x.consumption.spellSlot,false);}}
});
test('shared class resources, secondary spell actions, cantrip tiers and holy damage are correct',()=>{
 const [v,w,b,d,c,r]=actors;assert.equal(get(v,'font-of-magic').system.uses.max,'20');assert.equal(get(v,'font-of-magic').system.uses.recovery.find(r=>r.period==='sr').formula,'4');
 for(const i of v.items.filter(i=>i.system.identifier.startsWith('metamagic-')))assert.equal(acts(i)[0].consumption.targets[0].target,get(v,'font-of-magic')._id);
 assert.equal(acts(get(b,'cutting-words'))[0].consumption.targets[0].target,get(b,'bardic-inspiration')._id);
 for(const k of ['turn-undead','solar-radiance'])assert.equal(acts(get(c,k))[0].consumption.targets[0].target,get(c,'channel-divinity')._id);
 assert.equal(get(d,'wild-shape').system.uses.max,'2');assert.ok(!acts(get(d,'wild-shape'))[0].settings.keep.includes('spells'));
 assert.equal(acts(get(v,'fire-bolt'))[0].damage.parts[0].number,4);assert.equal(acts(get(r,'fire-bolt'))[0].damage.parts[0].number,3);assert.equal(acts(get(c,'sacred-flame'))[0].damage.parts[0].bonus,'6');
 assert.ok(acts(get(d,'moonbeam')).some(x=>x.consumption.spellSlot===false));assert.ok(acts(get(r,'heat-metal')).some(x=>x.consumption.spellSlot===false));
 assert.equal(get(w,'mastery-shield').system.method,'innate');
 const weapon=acts(get(c,'spiritual-weapon')).find(x=>x.type==='summon');assert.equal(weapon.profiles[0].uuid,'Compendium.dnd5e.actors24.Actor.phbsplSpiritualW');assert.equal(weapon.bonuses.attackDamage,'floor((@item.level - 2) / 2)d8');
 for(const a of actors)assert.deepEqual(a.system.attributes.ac.calcs,['natural']);
});
test('recharge eligibility excludes consumables, artifacts, creature features, full and invalid pools',()=>{
 const {c}=harness(),item={type:'equipment',system:{properties:['mgc'],rarities:['rare'],uses:{max:7,spent:3}}};assert.equal(c.rechargeable(item),true);
 for(const bad of [{...item,type:'feat'},{...item,type:'consumable'},{...item,system:{...item.system,rarities:['artifact']}},{...item,system:{...item.system,uses:{max:7,spent:0}}},{...item,system:{...item.system,uses:{max:'bad',spent:3}}}])assert.equal(c.rechargeable(bad),false);
});
test('divine spark restores only missing charges, spends once and never replays completed or interrupted transfers',async()=>{
 const {c,actor}=harness(),feature=get(actor,'creator-spark'),item=doc({type:'equipment',system:{properties:['mgc'],uses:{max:7,spent:2}}}),chat=doc({});
 assert.equal(await c.restoreCharges(actor,feature,item,4,chat),2);assert.equal(item.system.uses.spent,0);assert.equal(feature.system.uses.spent,1);
 item.system.uses.spent=3;await c.restoreCharges(actor,feature,item,4,chat);assert.equal(item.system.uses.spent,3);
 feature.system.uses.spent=0;const interrupted=doc({flags:{[MOD]:{towerReceipt:{status:'applying'}}}});await c.restoreCharges(actor,feature,item,4,interrupted);assert.equal(item.system.uses.spent,3);assert.equal(feature.system.uses.spent,0);
});
test('spark refuses exhausted pools and unauthorized users before mutation',async()=>{
 const {c,game,actor}=harness(),feature=get(actor,'creator-spark'),item=doc({type:'weapon',system:{properties:['mgc'],uses:{max:4,spent:3}}});feature.system.uses.spent=1;await assert.rejects(c.restoreCharges(actor,feature,item,2,doc({})));assert.equal(item.system.uses.spent,3);
 feature.system.uses.spent=0;game.user={id:'p',isGM:false};await assert.rejects(c.restoreCharges(actor,feature,item,2,doc({})));assert.equal(feature.system.uses.spent,0);
});
test('recovery validates weighted budget and missing slots including negative and fractional inputs',()=>{
 const {c}=harness(),actor={system:{spells:{spell1:{max:4,value:2},spell2:{max:3,value:0},spell3:{max:3,value:0},spell4:{max:3,value:0},spell5:{max:3,value:0}}}};
 const patch=c.slotRecovery(actor,{slot4:1,slot5:1},9);assert.equal(patch['system.spells.spell4.value'],1);assert.equal(patch['system.spells.spell5.value'],1);
 for(const input of [{slot5:2},{slot1:3},{slot1:-1},{slot1:0.5},{}])assert.throws(()=>c.slotRecovery(actor,input,9));
});
test('cancelling native usage follow-up spends no recovery resource; duplicate chat events are ignored',async()=>{
 const {c,game,actor}=harness(),feature=doc(structuredClone(get(actors[1],'arcane-recovery')));actor.items.push(feature);const activity=acts(feature)[0];activity.item=feature;activity.actor=actor;
 const chat=doc({type:'usage',author:game.user,getAssociatedActivity:()=>activity});await Promise.all([c.processTowerUse(chat),c.processTowerUse(chat)]);assert.equal(feature.system.uses.spent,0);assert.equal(chat.flags[MOD].towerReceipt.status,'cancelled');
});
test('wing toggling preserves prior fly speed, HP, slots and all other movement',async()=>{
 const {c,game,actor}=harness(),feature=get(actor,'amethyst-wings'),activity=acts(feature)[0];activity.item=feature;activity.actor=actor;actor.system.attributes.movement.speeds.fly='15';const before=structuredClone(actor.system);
 await c.processTowerUse(doc({type:'usage',author:game.user,getAssociatedActivity:()=>activity}));assert.equal(actor.system.attributes.movement.speeds.fly,'30');
 await c.processTowerUse(doc({type:'usage',author:game.user,getAssociatedActivity:()=>activity}));assert.equal(actor.system.attributes.movement.speeds.fly,'15');assert.deepEqual(actor.system,before);
});
test('only real GM usage events can invoke Tower mutation',async()=>{
 const {c,game,actor}=harness(),feature=get(actor,'amethyst-wings'),activity=acts(feature)[0];activity.item=feature;activity.actor=actor;
 for(const chat of [{type:'damage',author:game.user},{type:'usage',author:{isGM:false}}])await c.processTowerUse(doc({...chat,getAssociatedActivity:()=>activity}));assert.equal(actor.flags[MOD].towerFlight,undefined);
});

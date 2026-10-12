import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {category} from '../scripts/pack-folders.mjs';
const MOD='bagrovoe-bleeding',actors=JSON.parse(fs.readFileSync(new URL('../packs-src/actors.json',import.meta.url))),abilities=JSON.parse(fs.readFileSync(new URL('../packs-src/abilities.json',import.meta.url)));
const slugs=['severin-velt','agata-morn','bagrovyj-ispovednik'];
for(const slug of slugs)test(`${slug}: complete native activities, costs, assets, compendium copies`,()=>{
 const a=actors.find(a=>a.system.identifier===slug);assert.ok(a);assert.equal(a.system.details.cr,slug==='bagrovyj-ispovednik'?3:6);
 assert.equal(category('actors',a),slug==='bagrovyj-ispovednik'?'Гуманоиды':'Именные персонажи');
 const con=Math.floor((a.system.abilities.con.value-10)/2);assert.equal(a.system.attributes.hp.max,Math.floor(a.system.attributes.hd.max*(4.5+con)));
 assert.equal(new Set(a.items.map(i=>i._id)).size,a.items.length);
 for(const i of a.items){
  if(!i.flags[MOD]?.sourceSpellId)assert.deepEqual(abilities.find(x=>x._id===i._id),i);
  assert.doesNotMatch(i.system.description.value,/Foundry|ведущий|вручную/i);
  for(const [key,x] of Object.entries(i.system.activities)){
   assert.equal(key,x._id);assert.equal(x.img,i.img);assert.equal(x.consumption.spellSlot,i.flags[MOD]?.resourceMode==='slots'&&i.system.level>0);
   if(i.system.uses.max)assert.ok(x.consumption.targets.some(t=>t.type==='itemUses'&&t.value==='1'));
   if(x.type==='save')assert.ok(x.save.ability.length && (x.save.dc.formula||x.save.dc.calculation==='spellcasting'));
   if(x.type==='heal')assert.ok(x.healing.types.includes('healing')||x.healing.types.includes('temphp'));
  }
  if(slug!=='severin-velt'){assert.ok(!i.flags[MOD]?.bloodMagic);assert.ok(!i.flags[MOD]?.itemBloodCost);if(i.flags[MOD]?.spellKey)assert.equal(i.flags[MOD].resourceMode,'slots');}
 }
 for(const img of [a.img,a.prototypeToken.texture.src,...a.items.map(i=>i.img)])assert.ok(fs.existsSync(new URL('../'+img.replace(`modules/${MOD}/`,''),import.meta.url)));
});
test('Severin keeps the unmasked portrait and blood costs, support mage has different artwork',()=>{
 const named=actors.find(a=>a.system.identifier==='severin-velt'),ordinary=actors.find(a=>a.name==='Маг крови [Бафф-Дебафф]');
 assert.notEqual(named.img,ordinary.img);const ward=named.items.find(i=>i.system.identifier.endsWith('architect-ward'));assert.equal(ward.flags[MOD].itemBloodCost.hitDice,1);
 const barrier=named.items.find(i=>i.flags[MOD]?.spellKey==='blood-barrier');assert.equal(Object.values(barrier.system.activities)[0].uses.max,'3');
 assert.equal(named.items.find(i=>i.flags[MOD]?.spellKey==='blood-bonds').system.level,2);
});
const flagged=x=>Object.assign(x,{flags:{},getFlag(m,k){return this.flags[m]?.[k];},async setFlag(m,k,v){(this.flags[m]??={})[k]=v;}});
function harness(){
 const docs=new Map(),warnings=[],gm={id:'gm',isGM:true};
 const actor=flagged({uuid:'Actor.target',effects:[],statuses:new Set(),system:{details:{type:{value:'humanoid'}},traits:{ci:{value:[]}}},
  async createEmbeddedDocuments(t,data){this.effects.push(...data.map((d,i)=>{const e=flagged({...d,id:`effect${i}`});e.flags=d.flags;return e;}));},
  async deleteEmbeddedDocuments(t,ids){this.effects=this.effects.filter(e=>!ids.includes(e.id));}});
 const caster={uuid:'Actor.caster',token:{uuid:'Token.caster'}};
 const item=flagged({uuid:'Item.prayer',actor:caster,img:'icon',system:{uses:{max:'3',spent:0}}});item.flags={[MOD]:{communionKneel:true}};
 const activity={item,save:{dc:{value:15}}};
 const chat=flagged({id:'save',type:'save',system:{origin:'usage'},rolls:[{total:8}],getAssociatedActor:()=>actor,getAssociatedActivity:()=>activity});
 docs.set('Token.target',{uuid:'Token.target',actor});docs.set('ChatMessage.usage',{getAssociatedActivity:()=>activity});
 const ctx=vm.createContext({console,Hooks:{on(){}},game:{user:gm,users:{activeGM:gm},scenes:new Map()},fromUuid:async id=>docs.get(id),fromUuidSync:id=>docs.get(id),ChatMessage:{getSpeaker:()=>({})},ui:{notifications:{warn:t=>warnings.push(t),error:t=>warnings.push(t)}},BagrovoeSpellRuntime:{validateUse(){}},BagrovoeNewSpells:{distance:()=>30}});
 vm.runInContext(fs.readFileSync(new URL('../scripts/communion.js',import.meta.url),'utf8'),ctx);
 return {ctx,actor,item,activity,chat,warnings,validate:(targets)=>ctx.BagrovoeSpellRuntime.validateUse(activity,{}, {data:{system:{targets:targets.map(token=>({token}))}}})};
}
test('failed command applies prone once, legendary resistance removes only that effect',async()=>{
 const h=harness();await Promise.all([h.ctx.BagrovoeCommunion.applyKneel(h.chat),h.ctx.BagrovoeCommunion.applyKneel(h.chat)]);
 assert.equal(h.actor.effects.length,1);assert.equal(h.actor.effects[0].statuses[0],'prone');
 h.actor.effects.push(flagged({id:'other'}));h.chat.system.resisted=true;await h.ctx.BagrovoeCommunion.applyKneel(h.chat);assert.deepEqual(h.actor.effects.map(e=>e.id),['other']);
});
for(const kind of ['success','undead','construct','dead','immune','already-prone','other-gm'])test(`command does not apply: ${kind}`,async()=>{
 const h=harness();if(kind==='success')h.chat.rolls[0].total=15;
 if(['undead','construct'].includes(kind))h.actor.system.details.type.value=kind;
 if(kind==='dead')h.actor.statuses.add('dead');if(kind==='immune')h.actor.system.traits.ci.value=['prone'];if(kind==='already-prone')h.actor.statuses.add('prone');
 if(kind==='other-gm')h.ctx.game.users.activeGM={id:'other'};
 await h.ctx.BagrovoeCommunion.applyKneel(h.chat);assert.equal(h.actor.effects.length,0);
});
test('support validates count, living targets, range and remaining uses before casting',()=>{
 const h=harness();h.item.flags={[MOD]:{communionSupport:{maxTargets:3,range:30,living:true}}};
 assert.equal(h.validate([]),false);assert.equal(h.validate(['Token.target']),undefined);
 assert.equal(h.validate(['Token.target','Token.target']),false);
 h.ctx.BagrovoeNewSpells.distance=()=>31;assert.equal(h.validate(['Token.target']),false);h.ctx.BagrovoeNewSpells.distance=()=>30;
 h.actor.system.details.type.value='undead';assert.equal(h.validate(['Token.target']),false);h.actor.system.details.type.value='humanoid';
 h.item.system.uses.spent=3;assert.equal(h.validate(['Token.target']),false);
});

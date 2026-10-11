import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const spells=JSON.parse(fs.readFileSync(path.join(root,'packs-src/blood-spells.json')));
const MOD='bagrovoe-bleeding';
const get=(o,k)=>k.split('.').reduce((o,k)=>o?.[k],o);
const put=(o,k,v)=>{const p=k.split('.'),last=p.pop();for(const k of p)o=o[k]??={};o[last]=v;};
function flagged(obj={}) {return Object.assign(obj,{flags:{},getFlag(m,k){return get(this.flags[m],k);},async setFlag(m,k,v){put(this.flags,`${m}.${k}`,v);},async unsetFlag(m,k){const p=k.split('.'),last=p.pop();delete p.reduce((o,k)=>o[k],this.flags[m])[last];}});}
function harness(){
 const hooks=new Map(),docs=new Map(),notifications=[],gm={id:'gm',isGM:true};
 const ctx=vm.createContext({console,structuredClone,setTimeout,clearTimeout,
  Hooks:{on:(n,f)=>{const a=hooks.get(n)??[];a.push(f);hooks.set(n,a);},once:(n,f)=>{const a=hooks.get(n)??[];a.push(f);hooks.set(n,a);}},
  game:{user:gm,users:{activeGM:gm},modules:new Map([[MOD,{api:{}}]]),actors:[],scenes:[],combats:new Map(),messages:{contents:[]},time:{worldTime:100}},
  foundry:{utils:{deepClone:structuredClone,escapeHTML:String},applications:{api:{DialogV2:{wait:async()=>null}}}},
  ui:{notifications:{error:x=>notifications.push(x),warn:x=>notifications.push(x),info:x=>notifications.push(x)}},
  fromUuid:async u=>docs.get(u),ChatMessage:{getSpeaker:({token})=>({token:token?.id}),create:async()=>({})},
  Roll:class{async evaluate(){return {total:4};}}
 });
 const actor=flagged({id:'a',uuid:'Actor.a',type:'npc',name:'Mage',isOwner:true,items:[],effects:[],statuses:new Set(),
  system:{details:{type:{subtype:'заражённый'},cr:6},abilities:{con:{mod:3}},attributes:{prof:3,hp:{value:40,max:40,temp:5,formula:'8d8'},hd:{max:8,denomination:'d8',spent:0}}},
  async update(data){for(const [k,v] of Object.entries(data))put(this,k,v);},async toggleStatusEffect(k){this.statuses.add(k);},
  async createEmbeddedDocuments(type,data){const created=data.map((d,i)=>{const e=flagged({...d,id:'e'+i});e.flags=d.flags;return e;});this.effects.push(...created);return created;},
  async deleteEmbeddedDocuments(type,ids){this.effects=this.effects.filter(e=>!ids.includes(e.id));}});
 ctx.game.actors.push(actor);
 const load=n=>vm.runInContext(fs.readFileSync(path.join(root,'scripts',n),'utf8'),ctx);
 return {ctx,hooks,docs,actor,load,notifications};
}
test('eighteen unique bundled icons, bleed flags, native healing, templates and save damage',()=>{
 assert.equal(new Set(spells.map(s=>s.img)).size,18);
 for(const s of spells)assert.ok(fs.existsSync(path.join(root,s.img.replace('modules/bagrovoe-bleeding/',''))));
 for(const n of [1,6])assert.equal(spells[n].flags[MOD].abilities.bleed.levels,n===1?1:2);
 for(const [n,value] of [[7,7],[11,10]]){const a=Object.values(spells[n].system.activities)[0];assert.equal(a.type,'heal');assert.deepEqual(a.healing.types,['temphp']);assert.equal(Number(a.healing.bonus),value);}
 assert.equal(Object.values(spells[2].system.activities)[0].target.template.width,'5');
 for(const n of [2,3])assert.equal(Object.values(spells[n].system.activities)[0].damage.onSave,'half');
});
for(const [level,available,hp,expectedSpent,expectedHP,casts] of [[2,8,40,2,40,1],[0,8,40,0,40,1],[3,1,40,8,36,1],[3,0,2,8,0,0]]) {
 test(`blood spell payment level ${level}, available ${available}, HP ${hp}`,async()=>{
  const h=harness();h.load('blood-magic.js');h.actor.system.attributes.hp.value=hp;await h.actor.setFlag(MOD,'hitDiceSpent',8-available);
  const item=flagged({type:'spell',actor:h.actor,system:{level}});await item.setFlag(MOD,'bloodMagic',true);await item.setFlag(MOD,'spellKey','test');
  let used=0;const a={uuid:'Actor.a.Item.s.Activity.x',item,type:'attack',async use(config){const r=h.hooks.get('dnd5e.preUseActivity')[0](a,config,{},{});if(r===false)return;used++;return {message:{}};}};
  const hook=h.hooks.get('dnd5e.preUseActivity')[0];hook(a,{}, {},{});hook(a,{}, {},{});
  await new Promise(r=>setTimeout(r,15));
  assert.equal(h.actor.getFlag(MOD,'hitDiceSpent'),expectedSpent);assert.equal(h.actor.system.attributes.hp.value,expectedHP);assert.equal(used,casts);assert.equal(h.actor.system.attributes.hp.temp,5);
 });
}
test('failed save applies one slow; success/legendary resistance removes only its effect',async()=>{
 const h=harness();h.load('spell-runtime.js');const item=flagged({uuid:'Actor.c.Item.s',actor:h.actor,name:'Slow',img:spells[8].img});await item.setFlag(MOD,'spellKey','muscle-constriction');
 const a={item,save:{dc:{value:17}}};const source={getAssociatedActivity:()=>a};h.docs.set('ChatMessage.origin',source);
 const chat=flagged({id:'save',type:'save',system:{origin:'origin'},rolls:[{total:12}],getAssociatedActivity:()=>a,getAssociatedActor:()=>h.actor});
 await Promise.all([h.ctx.BagrovoeSpellRuntime.applyControl(chat),h.ctx.BagrovoeSpellRuntime.applyControl(chat)]);
 assert.equal(h.actor.effects.length,1);assert.equal(h.actor.effects[0].changes[0].key,'system.attributes.movement.multiplier');
 assert.equal(h.actor.effects[0].changes[0].value,'0.5');
 chat.system.resisted=true;await h.ctx.BagrovoeSpellRuntime.applyControl(chat);assert.equal(h.actor.effects.length,0);
});
test('control lasts through caster next turn and survives reload, expires afterwards',async()=>{
 const h=harness();h.load('spell-runtime.js');const c={id:'c',started:true,round:2,turn:0,turns:[{id:'caster',actor:h.actor},{id:'other'}]};
 h.ctx.game.combat=c;h.ctx.game.combats.set('c',c);
 const x=h.ctx.BagrovoeSpellRuntime.expiry(h.actor);assert.equal(x.round,3);
 const e=flagged({id:'e'});await e.setFlag(MOD,'expires',x);h.actor.effects=[e];
 c.round=3;await h.ctx.BagrovoeSpellRuntime.expireControls();assert.equal(h.actor.effects.length,1);
 c.turn=1;await h.ctx.BagrovoeSpellRuntime.expireControls();assert.equal(h.actor.effects.length,0);
});
test('seal expires at start of caster next turn, while ordinary controls remain',async()=>{
 const h=harness();h.load('spell-runtime.js');const c={id:'c',started:true,round:2,turn:0,turns:[{id:'caster',actor:h.actor},{id:'other'}]};h.ctx.game.combat=c;h.ctx.game.combats.set('c',c);
 const e=flagged({id:'seal'});await e.setFlag(MOD,'expires',{...h.ctx.BagrovoeSpellRuntime.expiry(h.actor),start:true});h.actor.effects=[e];
 await h.ctx.BagrovoeSpellRuntime.expireControls();assert.equal(h.actor.effects.length,1);c.round=3;await h.ctx.BagrovoeSpellRuntime.expireControls();assert.equal(h.actor.effects.length,0);
});
test('auto saves use persisted target and Set ability once, with native origin',async()=>{
 const h=harness();h.load('spell-runtime.js');const item=flagged({actor:h.actor});await item.setFlag(MOD,'spellKey','blood-bonds');
 const a={type:'save',item,save:{ability:new Set(['str']),dc:{value:17}},messageSources:{activity:{uuid:'activity'}}};
 const token={actor:h.actor,id:'t'};h.docs.set('Scene.s.Token.t',token);let calls=0;
 h.actor.rollSavingThrow=async(r,d,m)=>{calls++;assert.equal(r.ability,'str');assert.equal(m.data.system.origin,'usage');return [{total:12}];};
 const chat=flagged({id:'usage',type:'usage',system:{targets:[{token:'Scene.s.Token.t'}]},getAssociatedActivity:()=>a});
 await Promise.all([h.ctx.BagrovoeSpellRuntime.autoSaves(chat),h.ctx.BagrovoeSpellRuntime.autoSaves(chat)]);await h.ctx.BagrovoeSpellRuntime.autoSaves(chat);assert.equal(calls,1);
});
test('shield changes only incoming target AC once, spends once, does not change actor AC',async()=>{
 const h=harness();h.load('spell-runtime.js');const item=flagged({actor:h.actor,name:'Shield'});await item.setFlag(MOD,'spellKey','blood-barrier');let paid=0,used=0;
 const a={item,uses:{max:2,spent:0},async use(u){assert.equal(u._bagrovoePaid,true);used++;return {message:{}};}};item.system={activities:[a]};h.actor.items=[item];
 h.ctx.game.modules.get(MOD).api.bloodMagic={pay:async()=>{paid++;return {killed:false};}};h.ctx.foundry.applications.api.DialogV2.wait=async()=>0;
 h.docs.set('Scene.s.Token.t',{actor:h.actor});
 const chat=flagged({id:'attack',type:'attack',rolls:[{total:16}],system:{targets:[{token:'Scene.s.Token.t',ac:15}]},async update(d){this.system.targets=d['system.targets'];}});
 Object.defineProperty(chat.system,'evaluatedTargets',{get(){return this.targets.map(t=>({...t,isMiss:16<t.ac}));}});
 await Promise.all([h.ctx.BagrovoeSpellRuntime.resolveAttack(chat),h.ctx.BagrovoeSpellRuntime.resolveAttack(chat)]);
 assert.equal(chat.system.targets[0].ac,18);assert.equal(chat.system.evaluatedTargets[0].isMiss,true);assert.equal(paid,1);assert.equal(used,1);
});
test('empty/excess buff targets and exhausted shields cannot charge resources',()=>{
 const h=harness();h.load('spell-runtime.js');const item=flagged({system:{target:{affects:{count:'1'}}}});item.flags={[MOD]:{spellKey:'vascular-pulse'}};
 const a={item};assert.equal(h.ctx.BagrovoeSpellRuntime.validateUse(a,{}, {data:{system:{targets:[]}}}),false);
 assert.equal(h.ctx.BagrovoeSpellRuntime.validateUse(a,{}, {data:{system:{targets:[{},{}]}}}),false);
});
test('two simultaneous spell payments cannot spend the same Hit Die twice',async()=>{
 const h=harness();h.load('blood-magic.js');for(const ready of h.hooks.get('ready'))ready();
 await h.actor.setFlag(MOD,'hitDiceSpent',7);
 await Promise.all([h.ctx.BagrovoeBloodMagic.pay(h.actor,1),h.ctx.BagrovoeBloodMagic.pay(h.actor,1)]);
 assert.equal(h.actor.getFlag(MOD,'hitDiceSpent'),8);assert.equal(h.actor.system.attributes.hp.value,36);
});
test('surviving health substitution does not mark the caster dead',async()=>{
 const h=harness();h.load('blood-magic.js');for(const ready of h.hooks.get('ready'))ready();
 h.actor.system.attributes.hp.value=6;await h.actor.setFlag(MOD,'hitDiceSpent',8);
 await h.ctx.BagrovoeBloodMagic.pay(h.actor,1);assert.equal(h.actor.system.attributes.hp.value,2);assert.equal(h.actor.statuses.size,0);
});
test('other GMs do not duplicate save automation',async()=>{
 const h=harness();h.load('spell-runtime.js');h.ctx.game.users.activeGM={id:'another'};
 const chat={type:'usage',getAssociatedActivity(){throw Error('Should not run');}};
 await h.ctx.BagrovoeSpellRuntime.autoSaves(chat);
});
test('declining a defensive reaction never spends a resource or changes the attack',async()=>{
 const h=harness();h.load('spell-runtime.js');const item=flagged({actor:h.actor,name:'Shield'});await item.setFlag(MOD,'spellKey','blood-barrier');
 item.system={activities:[{item,uses:{max:2,spent:0}}]};h.actor.items=[item];h.docs.set('token',{actor:h.actor});
 h.ctx.game.modules.get(MOD).api.bloodMagic={pay:()=>{throw Error('No payment');}};
 const chat=flagged({id:'attack',type:'attack',rolls:[{total:16}],system:{evaluatedTargets:[{token:'token',ac:15,isMiss:false}],targets:[{token:'token',ac:15}]}});
 await h.ctx.BagrovoeSpellRuntime.resolveAttack(chat);assert.equal(chat.system.targets[0].ac,15);
});

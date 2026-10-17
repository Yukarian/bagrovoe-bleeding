import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const MOD='bagrovoe-bleeding',spells=JSON.parse(fs.readFileSync(new URL('../packs-src/blood-spells.json',import.meta.url))),npcs=JSON.parse(fs.readFileSync(new URL('../packs-src/actors.json',import.meta.url)));
const put=(o,k,v)=>{const bits=k.split('.'),last=bits.pop();for(const b of bits)o=o[b]??={};o[last]=v;};
const flagged=o=>Object.assign(o,{getFlag(m,k){return this.flags?.[m]?.[k];},async setFlag(m,k,v){this.flags??={};(this.flags[m]??={})[k]=v;},async unsetFlag(m,k){if(this.flags?.[m])delete this.flags[m][k];}});
const collection=a=>Object.assign(a,{get(id){return this.find(x=>x.id===id);}});
function harness(key='pulse-disruption'){
 const hooks=new Map(),docs=new Map(),messages=[],notices=[],saves=[],damageCalls=[],gm={id:'gm',isGM:true},scene={id:'s',grid:{size:100,distance:5},templates:collection([])};
 const game={user:gm,users:{activeGM:gm},actors:[],scenes:collection([scene]),modules:new Map([[MOD,{api:{}}]]),time:{worldTime:100},combats:new Map(),settings:{get:()=>false}};
 const ctx=vm.createContext({console,structuredClone,setTimeout,clearTimeout,game,
  Hooks:{on(n,f){const a=hooks.get(n)??[];a.push(f);hooks.set(n,a);},once(n,f){this.on(n,f);}},
  fromUuid:async id=>docs.get(id),fromUuidSync:id=>docs.get(id),
  foundry:{utils:{deepClone:structuredClone,escapeHTML:String},applications:{api:{DialogV2:{wait:async config=>config.buttons[0].action==='fail'?false:{}}}}},
  ui:{notifications:{warn:t=>notices.push(t),error:t=>notices.push(t),info:t=>notices.push(t)}},
  ChatMessage:{getSpeaker:()=>({scene:'s',token:'caster'}),getWhisperRecipients:()=>[gm],async create(d){messages.push(d);}},
  Roll:class{constructor(f){this.formula=f;}async evaluate(){this.total=8;return this;}async toMessage(){}},
  BagrovoeSpellRuntime:{validateUse(){},expiry:()=>({worldTime:106})},
  BagrovoeNewSpells:{distance:(a,b)=>a&&b&&a.parent===b.parent?Math.hypot(a.x-b.x,a.y-b.y)/20:Infinity}
 });
 let effectId=0;
 function actor(id){
  const a=flagged({id,uuid:`Actor.${id}`,name:id,type:'npc',isOwner:true,items:collection([]),effects:collection([]),statuses:new Set(),flags:{[MOD]:{bloodMagic:true}},
   system:{attributes:{prof:3,hp:{value:30,max:40,temp:0,formula:'8d8'},hd:{max:8,denomination:'d8'},spellcasting:'wis'},abilities:{con:{mod:3},wis:{mod:4}},details:{type:{value:'humanoid',subtype:'заражённый'}}},
   async update(d){for(const [k,v]of Object.entries(d))put(this,k,v);},
   async createEmbeddedDocuments(_t,rows){const out=rows.map(row=>{const e=flagged({...row,id:`e${++effectId}`,parent:this,async delete(){this.parent.effects=collection(this.parent.effects.filter(x=>x!==this));docs.delete(this.uuid);}});e.uuid=`${this.uuid}.ActiveEffect.${e.id}`;docs.set(e.uuid,e);return e;});this.effects.push(...out);return out;},
   async deleteEmbeddedDocuments(_t,ids){for(const e of [...this.effects])if(ids.includes(e.id))await e.delete();},
   async rollSavingThrow(config){saves.push(config);return [{total:this.saveTotal??2}];},
   async applyDamage(d,options={}){damageCalls.push({actor:this,d,options});const val=typeof d==='number'?d:d[0].value*(d[0].type==='healing'?-1:1),hp=this.system.attributes.hp,delta=Math.min(hp.temp,Math.max(0,val));const update={'system.attributes.hp.value':Math.min(hp.max,Math.max(0,hp.value-val+delta)),'system.attributes.hp.temp':hp.temp-delta};for(const fn of hooks.get('dnd5e.preApplyDamage')??[])fn(this,val,update,options);await this.update(update);},
   async endConcentration(){},async toggleStatusEffect(k){this.statuses.add(k);}
  });game.actors.push(a);docs.set(a.uuid,a);return a;
 }
 const caster=actor('caster'),target=actor('target'),other=actor('other');
 const token=(a,x)=>{const t={id:a.id,uuid:`Scene.s.Token.${a.id}`,parent:scene,actor:a,x,y:0,width:1,height:1,name:a.name};a.token=t;docs.set(t.uuid,t);return t;};
 const self=token(caster,0),t=token(target,100),u=token(other,200);scene.tokens=collection([self,t,u]);gm.targets=new Set([t]);
 const item=flagged(structuredClone(spells.find(s=>s.flags[MOD]?.spellKey===key)));item.actor=caster;item.uuid='Actor.caster.Item.spell';caster.items.push(item);
 const activity={item,uuid:item.uuid+'.Activity.a',activation:item.system.activation,async use(){}};
 const chat=flagged({id:'chat',type:'usage',author:gm,speaker:{scene:'s',token:'caster'},system:{targets:[{token:t.uuid}]},flags:{[MOD]:{expandedInput:{confirmed:true}}},getAssociatedActivity:()=>activity,getAssociatedToken:()=>self});
 const load=n=>vm.runInContext(fs.readFileSync(new URL('../scripts/'+n,import.meta.url),'utf8'),ctx);
 load('blood-magic.js');for(const ready of hooks.get('ready'))ready();
 game.modules.get(MOD).api.get=t=>t.bleeding?flagged({flags:{[MOD]:{level:t.bleeding,count:1,dc:12}}}):null;
 game.modules.get(MOD).api.set=async(t,s)=>{t.bleeding=s.level;};
 load('expanded-spells.js');
 return {ctx,game,hooks,docs,scene,caster,target,other,self,t,u,item,activity,chat,saves,damageCalls,messages,notices,api:ctx.BagrovoeExpandedSpells,
  async cast(){await ctx.BagrovoeExpandedSpells.process(chat);},
  async concentrate(){const [e]=await caster.createEmbeddedDocuments('ActiveEffect',[{flags:{}}]);chat.system.concentration=e.id;return e;}
 };
}

test('seven NPCs have native spellbooks; priests have standard prepared slots and correct DC',()=>{
 const books=npcs.filter(a=>a.flags?.[MOD]?.spellbookVersion==='4.3.0');assert.equal(books.length,7);
 for(const a of books){
  const items=a.items.filter(i=>i.flags?.[MOD]?.sourceSpellId);assert.ok(items.length>=3);
  assert.equal(new Set(items.map(i=>i.flags[MOD].spellKey)).size,items.length);
  for(const i of items){const source=spells.find(s=>s._id===i.flags[MOD].sourceSpellId);assert.ok(source);assert.equal(i.type,'spell');assert.equal(i.system.level,source.system.level);assert.equal(i.system.prepared,1);assert.equal(i.img,source.img);assert.equal(i.system.description.value,source.system.description.value);}
 }
 for(const [slug,dc,levels]of [['agata-morn',15,[4,3,3,1]],['bagrovyj-ispovednik',13,[4,3,2,0]]]){
  const a=books.find(a=>a.system.identifier===slug),prof=2+Math.floor((a.system.details.cr-1)/4);
  assert.equal(8+prof+Math.floor((a.system.abilities.wis.value-10)/2),dc);
  assert.deepEqual(levels,levels.map((_,n)=>a.system.spells['spell'+(n+1)].override));
  for(const i of a.items.filter(i=>i.type==='spell')){
   assert.equal(i.flags[MOD].resourceMode,'slots');assert.equal(i.system.method,'spell');assert.ok(i.system.activation.type);assert.ok(i.system.range.units);
   for(const activity of Object.values(i.system.activities)){assert.equal(activity.consumption.spellSlot,i.system.level>0);assert.ok(!activity.consumption.targets.some(t=>t.type==='itemUses'));}
  }
 }
});
test('divine slot spells bypass blood payment even for infected NPCs',()=>{
 const h=harness('donors-gift');h.chat.system.targets.push({token:h.u.uuid});h.chat.flags[MOD].expandedInput.donor=0;
 const hook=h.hooks.get('dnd5e.preUseActivity')[0],message={data:{speaker:h.chat.speaker,system:h.chat.system,flags:h.chat.flags}};
 assert.equal(hook(h.activity,{}, {},message),undefined);assert.equal(h.caster.getFlag(MOD,'hitDiceSpent'),undefined);
});
test('donor gift spends target HD, heals the other target, and never heals donor or charges caster HD',async()=>{
 const h=harness('donors-gift');h.chat.system.targets.push({token:h.u.uuid});h.chat.flags[MOD].expandedInput.donor=0;
 await h.cast();await h.cast();assert.equal(h.target.getFlag(MOD,'hitDiceSpent'),1);assert.equal(h.target.system.attributes.hp.value,30);assert.equal(h.other.system.attributes.hp.value,40);assert.equal(h.damageCalls.length,1);assert.equal(h.caster.getFlag(MOD,'hitDiceSpent'),undefined);
});
for(const pass of [false,true])test(`pulse disruption: save ${pass}, damage once, reaction lock only on failure`,async()=>{
 const h=harness();h.target.saveTotal=pass?99:1;await h.cast();await h.cast();assert.equal(h.damageCalls.length,1);assert.equal(h.damageCalls[0].d[0].value,pass?4:8);assert.equal(h.target.effects.length,pass?0:1);assert.equal(h.saves[0].target,17);
});
test('vital theft drains one die from a bleeding character without a CR threshold or passive extra healing',async()=>{
 const h=harness('vital-theft');h.t.bleeding=1;h.target.type='character';const cls={type:'class',system:{levels:3,hd:{denomination:'d10',spent:0}},async update(d){for(const[k,v]of Object.entries(d))put(this,k,v);}};h.target.items.push(cls);await h.caster.setFlag(MOD,'hitDiceSpent',3);
 await h.cast();assert.equal(cls.system.hd.spent,1);assert.equal(h.caster.getFlag(MOD,'hitDiceSpent'),2);assert.equal(h.caster.system.attributes.hp.value,30);
});
test('deferred death validates massive damage and cooldown; applies final damage once and rests reset cooldown',async()=>{
 const h=harness('deferred-death');h.target.system.attributes.hp.temp=5;
 assert.equal(h.api.deathAllowed(h.caster,h.target,34),false);assert.equal(h.api.deathAllowed(h.caster,h.target,75),false);
 h.chat.flags[MOD].expandedInput.damage=40;await h.cast();await h.cast();assert.equal(h.target.system.attributes.hp.value,1);assert.equal(h.target.system.attributes.hp.temp,0);assert.equal(h.damageCalls.length,1);assert.equal(h.target.getFlag(MOD,'hitDiceSpent'),1);assert.equal(h.api.deathAllowed(h.caster,h.target,10),false);
 for(const hook of h.hooks.get('dnd5e.restCompleted'))hook(h.target,{longRest:true},{});assert.equal(h.target.getFlag(MOD,'deferredDeathUsed'),undefined);
});
test('deferred death uses caster HD when recipient has none; cannot substitute health',async()=>{
 const h=harness('deferred-death');await h.target.setFlag(MOD,'hitDiceSpent',8);h.chat.flags[MOD].expandedInput.damage=30;
 await h.cast();assert.equal(h.caster.getFlag(MOD,'hitDiceSpent'),1);
 const h2=harness('deferred-death');await h2.target.setFlag(MOD,'hitDiceSpent',8);await h2.caster.setFlag(MOD,'hitDiceSpent',8);assert.equal(h2.api.deathAllowed(h2.caster,h2.target,30),false);
});
test('litany halves bleeding only for selected targets in range while concentrating; never stacks',async()=>{
 const h=harness('litany-of-endurance'),c=await h.concentrate();await h.cast();assert.equal(h.api.reduceBleedingDamage(h.t,9),4);assert.equal(h.api.reduceBleedingDamage(h.u,9),9);
 h.t.x=400;assert.equal(h.api.reduceBleedingDamage(h.t,9),9);h.t.x=100;await c.delete();assert.equal(h.api.reduceBleedingDamage(h.t,9),9);await h.api.cleanup();assert.equal(h.caster.effects.length,0);
});
test('duration expires at the original turn after ten rounds, and concentration loss expires immediately',async()=>{
 const h=harness('penance');h.game.combat={id:'combat',started:true,round:1,turn:3};h.game.combats.set('combat',h.game.combat);await h.concentrate();await h.cast();const e=h.caster.effects.find(e=>e.getFlag(MOD,'expandedCast'));
 h.game.combat.round=11;h.game.combat.turn=2;assert.equal(h.api.aliveCast(e),true);h.game.combat.turn=3;assert.equal(h.api.aliveCast(e),false);
});
test('shared pain applies final damage once to each participant, locks its reaction, and breaks beyond 60 feet',async()=>{
 const h=harness('shared-pain');h.chat.system.targets.push({token:h.u.uuid});await h.concentrate();await h.cast();h.ctx.foundry.applications.api.DialogV2.wait=async()=>({victim:0,damage:15});
 await h.api.trigger(h.chat,'trigger');assert.equal(h.target.system.attributes.hp.value,22);assert.equal(h.other.system.attributes.hp.value,23);assert.ok(h.damageCalls.every(c=>c.options.ignore===true));await assert.rejects(()=>h.api.trigger(h.chat,'trigger'),/Реакция/);
 h.u.x=1500;await assert.rejects(()=>h.api.trigger(h.chat,'trigger'),/закончилось/);
});
test('penance retaliates once each own turn and repeat save ends the effect',async()=>{
 const h=harness('penance');await h.concentrate();await h.cast();await h.api.trigger(h.chat,'trigger');await assert.rejects(()=>h.api.trigger(h.chat,'trigger'),/уже обработан/);assert.equal(h.damageCalls.length,1);
 h.target.saveTotal=99;await h.api.trigger(h.chat,'save');await assert.rejects(()=>h.api.trigger(h.chat,'trigger'),/закончилось/);
});
for(const key of ['crimson-thorns','cathedral-of-wounds'])test(`${key}: template geometry, saves, bleed and per-turn duplicate protection`,async()=>{
 const h=harness(key);h.chat.system.targets=[];h.t.bleeding=2;await h.concentrate();await h.cast();const template=flagged({uuid:'Scene.s.MeasuredTemplate.area',parent:h.scene,x:150,y:50,distance:20,flags:{dnd5e:{origin:h.activity.uuid}}});h.scene.templates.push(template);h.docs.set(template.uuid,template);
 await h.api.trigger(h.chat,'trigger');assert.equal(h.damageCalls.length,1);assert.equal(h.t.bleeding,key==='crimson-thorns'?3:2);await assert.rejects(()=>h.api.trigger(h.chat,'trigger'),/уже обработан/);
 h.t.x=3000;await assert.rejects(()=>h.api.trigger(h.chat,'trigger'),/внутри области/);
});
test('mark cap replaces oldest mark; sensing is GM-only and echo does not reveal positions to players',async()=>{
 const h=harness('communion-mark');h.caster.system.attributes.prof=1;await h.cast();await h.api.trigger(h.chat,'sense');assert.deepEqual([...h.messages.at(-1).whisper],['gm']);
 h.chat.id='chat2';await h.chat.unsetFlag(MOD,'expandedState');h.chat.system.targets=[{token:h.u.uuid}];await h.cast();assert.equal(h.caster.effects.length,1);assert.equal(h.caster.effects[0].getFlag(MOD,'expandedCast').targets[0],h.u.uuid);
 h.game.user={id:'player',isGM:false};const n=h.messages.length;await h.api.trigger(h.chat,'sense');assert.equal(h.messages.length,n);
});
test('echo senses only nearby bleeding living creatures and whispers the GM',async()=>{
 const h=harness('pulse-echo');h.chat.system.targets=[];h.t.bleeding=1;h.u.bleeding=2;h.other.system.details.type.value='undead';await h.concentrate();await h.cast();await h.api.trigger(h.chat,'sense');assert.match(h.messages.at(-1).content,/кандидатов 1/);assert.deepEqual([...h.messages.at(-1).whisper],['gm']);
});
test('available-die consumption shares the blood payment queue and never substitutes health',async()=>{
 const h=harness(),b=h.game.modules.get(MOD).api.bloodMagic;await h.caster.setFlag(MOD,'hitDiceSpent',6);
 await Promise.all([b.pay(h.caster,1),b.spendAvailableDie(h.caster)]);assert.equal(h.caster.getFlag(MOD,'hitDiceSpent'),8);await assert.rejects(()=>b.spendAvailableDie(h.caster),/Нет доступной/);assert.equal(h.caster.system.attributes.hp.value,30);
});
test('spellbook upgrade plan preserves edited native spells and unused slots, replacing old feature only',()=>{
 const ctx=vm.createContext({Hooks:{once(){}},console});vm.runInContext(fs.readFileSync(new URL('../scripts/spellbooks.js',import.meta.url),'utf8'),ctx);
 const make=i=>flagged({...structuredClone(i),id:i._id,toObject(){const {getFlag,setFlag,unsetFlag,toObject,...data}=this;return structuredClone(data);}});
 const raw=npcs.find(a=>a.system.identifier==='agata-morn'),source=flagged({...raw,items:raw.items.map(make)});
 const original=make(raw.items.find(i=>i.type==='spell'&&!i.flags[MOD].spellKey));original.type='feat';
 const edited=make(raw.items.find(i=>i.flags[MOD]?.sourceSpellId));edited.system.description.value='my edit';
 const actor=flagged({items:[original,edited],system:{attributes:{spellcasting:'int',spell:{level:10}},spells:{spell1:{value:1,override:5,max:5}}}});
 const p=ctx.BagrovoeSpellbooks.plan(actor,source);assert.ok(p.remove.includes(original.id));assert.ok(!p.create.some(i=>i.flags?.[MOD]?.spellKey===edited.flags[MOD].spellKey));assert.equal(p.update['system.spells.spell1.value'],undefined);assert.equal(p.update['system.attributes.spellcasting'],undefined);
});
for(const interrupted of [false,true])test(`world spellbook upgrade backs up before mutations and does not replay (${interrupted?'interrupted':'complete'})`,async()=>{
 const raw=npcs.find(a=>a.system.identifier==='bagrovyj-ispovednik');let writes=0;
 const doc=data=>flagged({...structuredClone(data),id:data._id,toObject(){return structuredClone(data);}});
 const source=flagged({...structuredClone(raw),items:raw.items.map(doc)}),old=structuredClone(raw);delete old.flags[MOD].spellbookVersion;
 old.items=old.items.filter(i=>!i.flags?.[MOD]?.sourceSpellId);for(const i of old.items)if(i.type==='spell')i.type='feat';
 const actor=flagged({...old,uuid:'Actor.existing',items:old.items.map(doc),async update(d){writes++;for(const[k,v]of Object.entries(d))put(this,k,v);},
  async deleteEmbeddedDocuments(_t,ids){assert.ok(this.getFlag(MOD,'spellbookBackup430'));writes++;this.items=this.items.filter(i=>!ids.includes(i.id));},
  async createEmbeddedDocuments(_t,data){writes++;if(interrupted)throw Error('connection interrupted');this.items.push(...data.map(doc));},async updateEmbeddedDocuments(){writes++;}});
 const gm={id:'gm',isGM:true},game={user:gm,users:{activeGM:gm},packs:new Map([[`${MOD}.actors`,{getDocuments:async()=>[source]}]]),actors:[actor],scenes:[]};
 const ctx=vm.createContext({game,console,Hooks:{once(){}},foundry:{utils:{deepClone:structuredClone}},ui:{notifications:{info(){}}}});
 vm.runInContext(fs.readFileSync(new URL('../scripts/spellbooks.js',import.meta.url),'utf8'),ctx);
 const run=()=>ctx.BagrovoeSpellbooks.updateSpellbooks();
 if(interrupted)await assert.rejects(run,/connection interrupted/);else{assert.equal(await run(),1);assert.equal(actor.items.filter(i=>i.type==='spell').length,source.items.filter(i=>i.type==='spell').length);}
 const before=writes;assert.equal(await run(),0);assert.equal(writes,before);assert.equal(actor.getFlag(MOD,'spellbookBackup430').items.length,old.items.length);
});

test('V14 reads legacy source metadata without requesting an inactive flag scope',async()=>{
 const strict=data=>({...data,getFlag(scope,key){if(scope!==MOD)throw Error('Flag scope '+scope+' is not valid or not currently active');return this.flags?.[scope]?.[key];}});
 const source=strict({flags:{[MOD]:{spellbookVersion:'4.3.0'},'bagrovoe-content':{sourceSlug:'mag-krovi-uron'}},items:[]});let backups=0,writes=0;
 const actor=strict({name:'Маг',uuid:'Actor.old',type:'npc',flags:{'bagrovoe-content':{sourceSlug:'mag-krovi-uron'}},items:[],system:{spells:{},attributes:{spell:{}}},async setFlag(scope,k,v){this.flags[scope]??={};this.flags[scope][k]=v;backups++;},async update(data){writes++;for(const[k,v]of Object.entries(data))put(this,k,v);}});
 const gm={id:'gm',isGM:true},game={user:gm,users:{activeGM:gm},packs:new Map([[MOD+'.actors',{getDocuments:async()=>[source]}]]),actors:[actor],scenes:[]};
 const ctx=vm.createContext({game,Hooks:{once(){}},console,foundry:{utils:{deepClone:structuredClone}},ui:{notifications:{info(){}}}});vm.runInContext(fs.readFileSync(new URL('../scripts/spellbooks.js',import.meta.url),'utf8'),ctx);
 assert.equal(await ctx.BagrovoeSpellbooks.updateSpellbooks(),1);assert.equal(backups,1);assert.equal(writes,1);assert.equal(actor.getFlag(MOD,'spellbookVersion'),'4.3.0');
});
test('no eligible NPC means no pack load or orphaned synthetic actor initialization',async()=>{
 const gm={id:'gm',isGM:true},game={user:gm,users:{activeGM:gm},actors:[],scenes:[{tokens:[{actorId:'deleted',get actor(){throw Error('unrelated token should not initialize');}}]}],packs:new Map([[MOD+'.actors',{getDocuments:async()=>{throw Error('unnecessary pack read');}}]])};
 const ctx=vm.createContext({game,Hooks:{once(){}},console});vm.runInContext(fs.readFileSync(new URL('../scripts/spellbooks.js',import.meta.url),'utf8'),ctx);assert.equal(await ctx.BagrovoeSpellbooks.updateSpellbooks(),0);
});
test('pack read failure identifies the phase without claiming a saved backup',async()=>{
 const actor=flagged({name:'Маг',uuid:'Actor.old',type:'npc',flags:{'bagrovoe-content':{sourceSlug:'mag-krovi-uron'}}}),gm={id:'gm',isGM:true};const game={user:gm,users:{activeGM:gm},actors:[actor],scenes:[],packs:new Map([[MOD+'.actors',{getDocuments:async()=>{throw Error('broken pack');}}]])};
 const ctx=vm.createContext({game,Hooks:{once(){}},console});vm.runInContext(fs.readFileSync(new URL('../scripts/spellbooks.js',import.meta.url),'utf8'),ctx);await assert.rejects(ctx.BagrovoeSpellbooks.updateSpellbooks(),e=>/чтение бестиария.*broken pack/.test(e.message)&&!/Резервная запись сохранена/.test(e.message));assert.equal(actor.getFlag(MOD,'spellbookBackup430'),undefined);
});
test('simultaneous book updates share a single upgrade and snapshot',async()=>{
 let loads=0,backups=0,writes=0;const source=flagged({flags:{[MOD]:{spellbookVersion:'4.3.0',sourceSlug:'mag-krovi-uron'}},items:[]}),actor=flagged({name:'Маг',uuid:'Actor.old',type:'npc',flags:{[MOD]:{sourceSlug:'mag-krovi-uron'}},items:[],system:{spells:{},attributes:{}},async update(data){writes++;for(const[k,v]of Object.entries(data))put(this,k,v);}});const original=actor.setFlag.bind(actor);actor.setFlag=async(...args)=>{backups++;return original(...args);};
 const gm={id:'gm',isGM:true},game={user:gm,users:{activeGM:gm},actors:[actor],scenes:[],packs:new Map([[MOD+'.actors',{getDocuments:async()=>{loads++;await new Promise(r=>setTimeout(r,5));return[source];}}]])};
 const ctx=vm.createContext({game,Hooks:{once(){}},console,foundry:{utils:{deepClone:structuredClone}},ui:{notifications:{info(){}}}});vm.runInContext(fs.readFileSync(new URL('../scripts/spellbooks.js',import.meta.url),'utf8'),ctx);assert.deepEqual(await Promise.all([ctx.BagrovoeSpellbooks.updateSpellbooks(),ctx.BagrovoeSpellbooks.updateSpellbooks()]),[1,1]);assert.equal(loads,1);assert.equal(backups,1);assert.equal(writes,1);
});

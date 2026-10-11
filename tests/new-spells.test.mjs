import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const MOD='bagrovoe-bleeding';
function harness(key,options={}){
 const flags=o=>Object.assign(o,{flags:{},getFlag(m,k){return this.flags[k];},async setFlag(m,k,v){this.flags[k]=v;}});
 const actor=id=>flags({uuid:id,type:'npc',name:id,system:{details:{type:{subtype:'заражённый'}},attributes:{hp:{value:30,temp:0},prof:3},abilities:{con:{mod:3}}},effects:[],statuses:new Set(),damage:[],async update(d){for(const [k,v]of Object.entries(d))this.system.attributes.hp[k.split('.').pop()]=v;},async applyDamage(d){this.damage.push(d);},async rollSavingThrow(){return [{total:options.save??5}];},async createEmbeddedDocuments(_t,data){this.effects.push(...data);},async deleteEmbeddedDocuments(){}});
 const caster=actor('caster'),victim=actor('victim'),scene={id:'scene',grid:{size:100,distance:5},tokens:[]};
 const token=(id,a,x)=>({id,uuid:id,name:id,actor:a,x,y:0,width:1,height:1,parent:scene,async update(d){Object.assign(this,d);}});
 const self=token('self',caster,0),target=token('target',victim,200);scene.tokens=[self,target];target.level=options.level??2;
 const item={actor:caster,name:key,uuid:'item',img:'icon',getFlag:()=>key};
 const activity={item,type:key==='scarlet-thread'?'attack':'utility'};
 const chat=flags({id:'chat',type:key==='scarlet-thread'?'attack':'usage',author:{isGM:true},system:{targets:[{token:'target'}],evaluatedTargets:[{token:'target',isMiss:false}]},getAssociatedActivity:()=>activity,getAssociatedToken:()=>self});
 const errors=[],formulas=[],gm={id:'gm',isGM:true};
 const api={get:t=>t.level?{getFlag:()=>t.level}:null,stop:async t=>{t.level=0;}};
 const ctx=vm.createContext({console:{error(){}},Set,Map,Number,Math,Hooks:{on(){}},game:{user:gm,users:{activeGM:gm},modules:new Map([[MOD,{api}]])},
  BagrovoeSpellRuntime:{validateUse(){},resolveAttack:async()=>{},expiry:()=>({worldTime:6})},fromUuid:async()=>target,
  foundry:{utils:{escapeHTML:String},applications:{api:{DialogV2:{wait:async d=>d.window.title==='Результат спасброска'?false:(options.choice===undefined?{hp:5,dx:0,dy:2}:options.choice)}}}},
  ui:{notifications:{error:x=>errors.push(x),warn:x=>errors.push(x)}},ChatMessage:{getSpeaker:()=>({}),create:async()=>{}},
  Roll:class{constructor(f){formulas.push(f);this.total=20;}async evaluate(){return this;}async toMessage(){}}
 });
 vm.runInContext(fs.readFileSync(new URL('../scripts/new-spells.js',import.meta.url),'utf8'),ctx);
 return {ctx,caster,victim,self,target,chat,errors,formulas,run:()=>ctx.BagrovoeNewSpells.process(chat)};
}
test('transfusion loses real HP once and heals the other target',async()=>{
 const h=harness('transfusion');h.caster.system.attributes.hp.temp=8;
 await Promise.all([h.run(),h.run()]);await h.run();assert.equal(h.caster.system.attributes.hp.value,25);assert.equal(h.caster.system.attributes.hp.temp,8);assert.equal(h.victim.damage.length,1);assert.equal(h.victim.damage[0][0].type,'healing');
});
test('transfusion cannot spend last HP or fractional HP',async()=>{
 for(const hp of [30,1.5,0,16]){const h=harness('transfusion',{choice:{hp}});await h.run();assert.equal(h.caster.system.attributes.hp.value,30);assert.equal(h.victim.damage.length,0);assert.equal(h.errors.length,1);}
});
test('execution pulse uses bleeding snapshot, halves successful save and then stops bleeding',async()=>{
 const h=harness('executioners-pulse',{level:5,save:30});await h.run();await h.run();assert.deepEqual(h.formulas,['9d8']);assert.equal(h.victim.damage[0][0].value,10);assert.equal(h.target.level,0);assert.equal(h.victim.damage.length,1);
});
test('execution pulse requires a bleeding target',async()=>{const h=harness('executioners-pulse',{level:0});await h.run();assert.equal(h.formulas.length,0);assert.equal(h.errors.length,1);});
test('harvest rewards failed bleeding saves and never reduces existing temp HP',async()=>{
 const h=harness('crimson-harvest');h.caster.system.attributes.hp.temp=8;await h.run();assert.equal(h.victim.damage[0][0].value,20);assert.equal(h.caster.system.attributes.hp.temp,8);
 const b=harness('crimson-harvest');await b.run();assert.equal(b.caster.system.attributes.hp.temp,3);
 const s=harness('crimson-harvest',{save:30});await s.run();assert.equal(s.caster.system.attributes.hp.temp,0);
});
test('seal removes bleeding without healing and records start-of-turn expiry',async()=>{const h=harness('clotting-seal');h.target.x=100;await h.run();assert.equal(h.target.level,0);assert.equal(h.victim.damage.length,0);assert.equal(h.victim.effects[0].flags[MOD].expires.start,true);});
test('teleport updates token and gives temp HP only near bleeding target',async()=>{const h=harness('crimson-step',{choice:{dx:1,dy:0}});await h.run();assert.equal(h.self.x,100);assert.equal(h.caster.system.attributes.hp.temp,5);});
test('teleport rejects occupied or too distant destination',async()=>{for(const dx of [2,7]){const h=harness('crimson-step',{choice:{dx,dy:0}});await h.run();assert.equal(h.self.x,0);assert.equal(h.errors.length,1);}});
test('thread pulls hit target without overlapping caster or applying native damage twice',async()=>{const h=harness('scarlet-thread');h.target.x=400;await h.run();assert.equal(h.target.x,200);assert.equal(h.victim.damage.length,0);});
test('cancelled effect and non-leading GM never apply damage',async()=>{const h=harness('crimson-harvest',{choice:null});await h.run();await h.run();assert.equal(h.victim.damage.length,0);assert.equal(h.chat.flags.newSpellResolution,'cancelled');const b=harness('crimson-harvest');b.ctx.game.users.activeGM={id:'other'};await b.run();assert.equal(b.victim.damage.length,0);});
test('partial failure cannot replay already applied damage',async()=>{const h=harness('executioners-pulse');h.victim.applyDamage=async()=>{throw Error('storage error');};await h.run();await h.run();assert.equal(h.formulas.length,1);assert.equal(h.chat.flags.newSpellResolution,'processing');});

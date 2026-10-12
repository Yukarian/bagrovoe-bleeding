import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {freshVillage,writeNote,addLog,previewWeek} from '../scripts/village-model.mjs';
import {villageHTML} from '../scripts/village-view.mjs';
const MOD='bagrovoe-bleeding',sourcePath=process.env.DND5E_SOURCE??'../dnd5e';
const nativeSource=fs.readFileSync(path.join(sourcePath,'module/documents/actor/bastion.mjs'),'utf8');
let serial=0;
const collection=xs=>Object.assign(xs,{get(id){return this.find(x=>x.id===id);}});
function apply(o,data){for(const[k,v]of Object.entries(data)){if(k.includes('.')){const bits=k.split('.'),last=bits.pop();let dest=o;for(const b of bits)dest=dest[b]??={};apply(dest,{[last]:v});}else if(v&&typeof v==='object'&&!Array.isArray(v)){o[k]??={};apply(o[k],v);}else o[k]=v;}}
async function harness(){
 const hooks=new Map(),messages=[],updates=[],documents=new Map(),gm={id:'gm',isGM:true};
 globalThis.game={user:gm,users:{activeGM:gm},actors:collection([]),journal:collection([]),time:{worldTime:1000,async advance(seconds){this.worldTime+=seconds;}},settings:{values:{bastionTurns:[]},get(_m,k){return this.values[k];},async set(_m,k,v){this.values[k]=v;}},i18n:{localize:s=>s}};
 globalThis.Hooks={on(n,f){const h=hooks.get(n)??[];h.push(f);hooks.set(n,h);},once(){}};
 globalThis.foundry={utils:{randomID:()=>`id${++serial}`,isEmpty:o=>!Object.keys(o).length},applications:{api:{ApplicationV2:class{},DialogV2:{}}}};
 globalThis.CONFIG={DND5E:{facilities:{sizes:{cramped:{label:'Тесная'}},orders:{build:{label:'Строительство'}}}}};
 globalThis.fromUuidSync=u=>documents.get(u);globalThis.ui={notifications:{error(){},info(){}}};
 globalThis.dnd5e={settings:{calendarConfig:{enabled:false},bastionConfiguration:{duration:7}}};
 const ctx=vm.createContext({game,foundry,dnd5e,CONFIG,ChatMessage:{implementation:{getSpeaker:({actor})=>({actor:actor.id}),async create(d){messages.push(d);return d;}}}});
 vm.runInContext(nativeSource.replace(/^import .*;\r?$/gm,'').replace('export default class Bastion','class Bastion')+'\nglobalThis.NativeBastion=Bastion;',ctx);
 dnd5e.bastion=new ctx.NativeBastion();
 const b=await import(`../scripts/bastion-bridge.mjs?test=${++serial}`),{commitVillage}=await import('../scripts/villages.js');
 b.installBridge({commit:commitVillage});
 function actor(id){
  const a={id,uuid:`Actor.${id}`,type:'character',name:id,system:{isCharacter:true,bastion:{name:`Оплот ${id}`,description:'<p>Старый дом</p>'}},items:collection([]),get itemTypes(){return {facility:this.items.filter(i=>i.type==='facility')};},async update(d){apply(this,d);},async updateEmbeddedDocuments(_t,rows){updates.push({actor:id,rows});for(const row of rows){const item=this.items.get(row._id);if(item)await item.update(row);}}};
  const item={id:'f',uuid:`${a.uuid}.Item.f`,actor:a,type:'facility',name:'Кухня',img:'',system:{type:{value:'basic'},disabled:false,building:{built:false,size:'cramped'},size:'cramped',description:{value:'<p>Очаг</p>'},progress:{value:0,max:14,order:'build',paid:true},hirelings:{value:[],max:1},defenders:{value:[],max:2}},async update(d){apply(this,d);}};
  a.items.push(item);game.actors.push(a);documents.set(a.uuid,a);documents.set(item.uuid,item);return a;
 }
 function village(id,owners=[]){const s=freshVillage(id);s.bastions=owners.map(a=>a.uuid);s.bastionClock=1000;s.population=10;s.resources.supplies=20;s.upkeep.supplies=2;
  const doc={id,uuid:`JournalEntry.${id}`,name:id,state:s,getFlag(){return this.state;},async update(data){this.state=data[`flags.${MOD}.village`];this.name=data.name;}};game.journal.push(doc);return doc;
 }
 return {b,actor,village,messages,updates,hooks,documents,commitVillage};
}
test('journal notes are editable, escaped, persistent and not discarded by automatic history limit',()=>{
 let s=writeNote(freshVillage(),'note','Первая строка\n<script>bad()</script>');s=writeNote(s,'note','Исправлено\nВторая строка');assert.equal(s.log.length,1);assert.equal(s.log[0].manual,true);
 for(let n=0;n<130;n++)addLog(s,`Ход ${n}`);assert.equal(s.log.filter(l=>l.manual).length,1);assert.equal(s.log.length,101);assert.match(villageHTML(s,[],null),/data-cmd="note"/);assert.match(villageHTML(s,[],null),/Исправлено/);assert.throws(()=>writeNote(s,'x',' '),/символов/);
 s=writeNote(s,'x','<img onerror="bad()">');assert.ok(!villageHTML(s,[],null).includes('<img onerror'));
});
test('native facility edits are immediately projected both ways, counted once, and deletions leave no mirror',async()=>{
 const h=await harness(),a=h.actor('one'),d=h.village('v',[a]),item=a.items[0];assert.equal(h.b.linkedBastions(d.state)[0].facilities[0].name,'Кухня');
 await item.update({name:'Таверна','system.disabled':true});let view=h.b.linkedBastions(d.state);assert.equal(view[0].facilities[0].name,'Таверна');assert.equal(view[0].facilities[0].disabled,true);
 await h.b.requireFacility(d,item.uuid).update({name:'Новый трактир','system.disabled':false});assert.equal(a.items[0].name,'Новый трактир');assert.ok(villageHTML(d.state,[],d.id,h.b.linkedBastions(d.state)).includes('Новый трактир'));
 a.items.splice(0);assert.equal(h.b.linkedBastions(d.state)[0].facilities.length,0);assert.equal(d.state.buildings.length,0);
});
test('one bastion links to only one village and unlink never deletes native facilities',async()=>{
 const h=await harness(),a=h.actor('one'),d=h.village('v'),other=h.village('other');await h.b.linkBastion(d,a.uuid);await h.b.linkBastion(d,a.uuid);assert.equal(d.state.bastions.length,1);await assert.rejects(()=>h.b.linkBastion(other,a.uuid),/другим/);await h.b.unlinkBastion(d,a.uuid);assert.equal(a.items.length,1);await h.b.linkBastion(other,a.uuid);assert.equal(other.state.bastions.length,1);
});
test('relink starts a new calendar anchor instead of charging for unlinked time',async()=>{
 const h=await harness(),a=h.actor('one'),d=h.village('v',[a]);await h.b.unlinkBastion(d,a.uuid);game.time.worldTime+=20*86400;dnd5e.settings.calendarConfig.enabled=true;await h.b.linkBastion(d,a.uuid);await h.b.syncCalendar();assert.equal(d.state.week,1);assert.equal(d.state.resources.supplies,20);assert.equal(d.state.bastionClock,game.time.worldTime);
});
test('calendar uses native midnight boundaries rather than waiting 24 hours after linking',async()=>{
 const h=await harness(),a=h.actor('one'),d=h.village('v',[a]);game.time.calendar={constructor:{dayDifference:(a,b)=>b.day-a.day},timeToComponents:time=>({day:Math.floor(time/86400)}),days:{hoursPerDay:24,minutesPerHour:60,secondsPerMinute:60}};d.state.bastionClock=86000;game.time.worldTime=86500;dnd5e.settings.calendarConfig.enabled=true;await h.b.syncCalendar();assert.equal(d.state.bastionDays,1);assert.equal(d.state.bastionClock,86500);await h.b.syncCalendar();assert.equal(d.state.bastionDays,1);
});
test('village week advances two linked native bastions once, charges upkeep once and completes actual native build',async()=>{
 const h=await harness(),a=h.actor('one'),b=h.actor('two'),d=h.village('v',[a,b]);await h.b.advanceVillage(d,0);assert.equal(d.state.week,2);assert.equal(d.state.resources.supplies,18);assert.equal(a.items[0].system.progress.value,7);assert.equal(b.items[0].system.progress.value,7);assert.equal(d.state.undo,null);assert.equal(h.messages.length,2);
 await h.b.advanceVillage(d,d.state.revision);assert.equal(a.items[0].system.building.built,true);assert.equal(a.items[0].system.progress.max,null);assert.equal(d.state.week,3);assert.equal(h.messages.length,4);
});
test('native global turn advances linked village only once for two owners, keeping unrelated bastions native',async()=>{
 const h=await harness(),a=h.actor('one'),b=h.actor('two'),c=h.actor('other'),d=h.village('v',[a,b]);await dnd5e.bastion.advanceAllBastions();assert.equal(d.state.week,2);assert.equal(d.state.resources.supplies,18);for(const actor of [a,b,c])assert.equal(actor.items[0].system.progress.value,7);assert.equal(game.settings.get('dnd5e','bastionTurns').length,1);
});
test('native individual turn coordinates the other bastion in the same village, with correct return value',async()=>{
 const h=await harness(),a=h.actor('one'),b=h.actor('two'),d=h.village('v',[a,b]);const result=await dnd5e.bastion.advanceAllFacilities(a);assert.ok(result.updates);assert.equal(d.state.week,2);assert.equal(b.items[0].system.progress.value,7);
});
test('native damage repair remains native and does not progress the disabled facility in the same turn',async()=>{
 const h=await harness(),a=h.actor('one'),d=h.village('v',[a]);a.items[0].system.disabled=true;await h.b.advanceVillage(d,0);assert.equal(a.items[0].system.disabled,false);assert.equal(a.items[0].system.progress.value,0);assert.equal(d.state.week,2);
});
test('insufficient village upkeep stops native mutations before any receipt or reward',async()=>{
 const h=await harness(),a=h.actor('one'),d=h.village('v',[a]);d.state.resources.supplies=0;await assert.rejects(()=>dnd5e.bastion.advanceAllBastions(),/не хватает/);assert.equal(h.updates.length,0);assert.equal(h.messages.length,0);assert.equal(d.state.syncPending,undefined);assert.equal(d.state.week,1);
});
test('stale repeated village click cannot double-charge resources or advance native progress twice',async()=>{
 const h=await harness(),a=h.actor('one'),d=h.village('v',[a]);const results=await Promise.allSettled([h.b.advanceVillage(d,0),h.b.advanceVillage(d,0)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(d.state.week,2);assert.equal(h.messages.length,1);
});
test('interrupted shared turn persists receipt, blocks replay and village edits, and can be reconciled without native rerun',async()=>{
 const h=await harness(),a=h.actor('one'),d=h.village('v',[a]);a.updateEmbeddedDocuments=async()=>{throw Error('offline');};await assert.rejects(()=>h.b.advanceVillage(d,0),/offline/);assert.ok(d.state.syncPending);assert.equal(d.state.week,1);assert.equal(d.state.resources.supplies,20);
 await assert.rejects(()=>h.b.advanceVillage(d,d.state.revision),/прерванный/);await assert.rejects(()=>h.commitVillage(d,d.state.revision,x=>x),/Общий ход/);await h.b.finalizeTurn(d,false);assert.equal(d.state.syncPending,undefined);assert.equal(d.state.week,1);assert.equal(h.messages.length,0);
});
test('a village employee assigned from the native sheet pauses local work rather than producing twice',async()=>{
 const h=await harness(),a=h.actor('one'),d=h.village('v',[a]);d.state.npcs=[{id:'n',name:'Кузнец',actorUuid:'Actor.smith',homeId:''}];d.state.buildings=[{id:'b',name:'Кузница',type:'smithy',condition:'intact',occupied:true,capacity:0,residents:0,posts:[{id:'p',title:'Кузнец',npcId:'n'}],job:{name:'Слитки',remaining:1,cost:{},gain:{materials:5}}}];a.items[0].system.hirelings.value=['Actor.smith'];
 let s=h.b.withBastionStaff(d.state);assert.equal(s.buildings[0].staffBlocked,true);assert.equal(previewWeek(s).state.resources.materials,0);
 a.items[0].system.hirelings.value=[];s=h.b.withBastionStaff(s);assert.equal(previewWeek(s).state.resources.materials,5);
});
test('calendar preview is untouched; calendar elapsed days advance village once without repeating native progress',async()=>{
 const h=await harness(),a=h.actor('one'),d=h.village('v',[a]);dnd5e.settings.calendarConfig.enabled=true;
 const result=await dnd5e.bastion.advanceAllFacilities(a,{duration:7,performUpdates:false,summary:'auto',turn:false});assert.equal(d.state.week,1);assert.equal(a.items[0].system.progress.value,0);assert.equal(result.updates[0]['system.progress'].value,7);
 game.time.worldTime+=7*86400;await h.b.syncCalendar();await h.b.syncCalendar();assert.equal(d.state.week,2);assert.equal(d.state.resources.supplies,18);assert.equal(a.items[0].system.progress.value,0);assert.equal(h.updates.length,0);
});
test('calendar village button advances world time by seven days and only counts village week once',async()=>{
 const h=await harness(),a=h.actor('one'),d=h.village('v',[a]);dnd5e.settings.calendarConfig.enabled=true;await h.b.advanceVillage(d,0);await h.b.syncCalendar();assert.equal(game.time.worldTime,1000+7*86400);assert.equal(d.state.week,2);assert.equal(h.updates.length,0);
});
test('nonstandard native turn durations accumulate into seven-day village weeks',async()=>{
 const h=await harness(),a=h.actor('one'),d=h.village('v',[a]);dnd5e.settings.bastionConfiguration.duration=3;await dnd5e.bastion.advanceAllFacilities(a);await dnd5e.bastion.advanceAllFacilities(a);assert.equal(d.state.week,1);assert.equal(d.state.bastionDays,6);await dnd5e.bastion.advanceAllFacilities(a);assert.equal(d.state.week,2);assert.equal(d.state.bastionDays,2);
});
test('players and secondary GMs cannot advance shared village state',async()=>{
 const h=await harness(),a=h.actor('one'),d=h.village('v',[a]);game.user.isGM=false;await assert.rejects(()=>h.b.advanceVillage(d,0),/ведущий/);game.user.isGM=true;game.users.activeGM={id:'different'};await assert.rejects(()=>h.b.advanceVillage(d,0),/ведущий/);assert.equal(d.state.week,1);
});

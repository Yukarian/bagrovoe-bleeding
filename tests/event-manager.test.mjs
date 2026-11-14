import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
import {freshVillage} from '../scripts/village-model.mjs';
import {migrateDevelopment,editEventDefinition,editEventSettings,requestEvent,rollEvent,advanceDevelopment,decideDevelopmentEvent,setEventLimit,publicDevelopment,eligible,CATEGORY,TRACKS} from '../scripts/village-development.mjs';
import {EVENTS,eventDefinitions,eventRange,eventSettings,eventAtRoll,eventRepeatText,eventCount,eventLimit,eventEffectText} from '../scripts/village-event-catalog.mjs';
import {esc,button} from '../scripts/village-view.mjs';
const fresh=()=>migrateDevelopment(freshVillage('Вестерхольм'));
const edit=(s,key,patch={})=>{const e=eventDefinitions(s).find(e=>e.id===key),[from,to]=eventRange(s,key);return editEventDefinition(s,key,{...e,from,to,limit:eventLimit(s,e)??-1,...patch});};
test('ranges are inclusive, validated and disjoint, with explicit gaps and manual-only entries',()=>{
 let s=fresh();assert.equal(eventAtRoll(s,53),undefined);const key=EVENTS[0].id;s=edit(s,key,{from:60,to:65});assert.equal(eventAtRoll(s,60).id,key);assert.equal(eventAtRoll(s,65).id,key);assert.equal(eventAtRoll(s,66),undefined);assert.equal(eventAtRoll(s,1),undefined);
 for(const patch of [{from:2,to:5},{from:0,to:1},{from:99,to:98},{from:101,to:101},{from:1.5,to:2}])assert.throws(()=>edit(s,key,patch));s=edit(s,key,{from:0,to:0});assert.equal(eventAtRoll(s,60),undefined);
});
test('edits are village-local snapshots, retained on reload without mutating the shipped catalog',()=>{
 let s=requestEvent(fresh(),'traveler',0);const old=s.developmentEvents[0].text;s=edit(s,'traveler',{title:'Изменённое',text:'Новый текст',effects:{stock:3,materials:2,treasury:10}});assert.equal(s.developmentEvents[0].text,old);assert.notEqual(EVENTS.find(e=>e.id==='traveler').title,'Изменённое');s=migrateDevelopment(JSON.parse(JSON.stringify(s)));assert.equal(eventDefinitions(s).find(e=>e.id==='traveler').title,'Изменённое');s=decideDevelopmentEvent(s,s.developmentEvents[0].id,'skip',0);s=requestEvent(s,'traveler',0);assert.equal(s.developmentEvents[0].text,'Новый текст');const before=s.economy.stock;s=decideDevelopmentEvent(s,s.developmentEvents[0].id,'apply',0);assert.equal(s.economy.stock,before+3);assert.equal(s.eventHistory[0].text,old);
});
test('manual requests enforce limits and duplicates; skip releases a slot, cooldown is bypassed only manually',()=>{
 let s=requestEvent(fresh(),'morkant-arrival',0);assert.throws(()=>requestEvent(s,'morkant-arrival',0));s=decideDevelopmentEvent(s,s.developmentEvents[0].id,'defer',0);assert.throws(()=>requestEvent(s,'morkant-arrival',0));s=decideDevelopmentEvent(s,s.developmentEvents[0].id,'skip',0);s=requestEvent(s,'morkant-arrival',0);s=decideDevelopmentEvent(s,s.developmentEvents[0].id,'apply',0);assert.throws(()=>requestEvent(s,'morkant-arrival',0));s=setEventLimit(s,'morkant-arrival',2);assert.equal(requestEvent(s,'morkant-arrival',0).developmentEvents.length,1);assert.throws(()=>requestEvent(fresh(),'harvest',0));
});
test('custom events validate consequences and use the same counter and resolution pipeline',()=>{
 let s=editEventDefinition(fresh(),'custom-Test1',{title:'Гость',text:'Встреча',category:'story',from:90,to:95,limit:1,effects:{treasury:5}});assert.equal(eventAtRoll(s,95).id,'custom-Test1');s=rollEvent(s,90,0);const before=s.economy.treasury;s=decideDevelopmentEvent(s,s.developmentEvents[0].id,'apply',0);assert.equal(s.economy.treasury,before+5);assert.throws(()=>requestEvent(s,'custom-Test1',0));assert.equal(eventCount(s,'custom-Test1'),1);
 for(const patch of [{effects:{days:2},track:null},{effects:{days:2,treasury:1},track:'housing'},{min:6},{title:''},{limit:-2},{effects:{treasury:NaN}}])assert.throws(()=>edit(s,'custom-Test1',patch));
});
test('table rolls do not reroll exhausted, unavailable or cooling-down slots',()=>{
 let s=fresh(),roll=eventRange(s,'traveler')[0];s=rollEvent(s,roll,0);s=decideDevelopmentEvent(s,s.developmentEvents[0].id,'skip',0);s=rollEvent(s,roll,0);assert.equal(s.developmentEvents.length,0);assert.match(s.lastEventRoll.reason,/срок/);s=rollEvent(s,100,0);assert.match(s.lastEventRoll.reason,/Пустой/);s=editEventSettings(s,{mode:'table',interval:1,cooldown:0});s=advanceDevelopment(s,1,0,die=>{assert.equal(die,100);return roll;});assert.equal(s.developmentEvents[0].roll,roll);assert.equal(s.nextEventElapsed,2);
});
test('default calendar is unchanged; custom table timing and private state survive public projection',()=>{
 const s=fresh();assert.deepEqual(eventSettings(s),{mode:'legacy',interval:14,cooldown:60});let changed=edit(s,'traveler',{text:'Секретное описание'});changed=editEventSettings(changed,{mode:'table',interval:7,cooldown:20});assert.equal(changed.nextEventElapsed,7);const pub=JSON.stringify(publicDevelopment(changed,'id'));for(const word of ['Секретное описание','eventRanges','eventOverrides','eventSettings','customEvents','lastEventRoll'])assert.ok(!pub.includes(word));for(const patch of [{mode:'invalid',interval:1,cooldown:0},{mode:'table',interval:0,cooldown:0},{mode:'table',interval:1,cooldown:-1}])assert.throws(()=>editEventSettings(s,patch));
});
test('manual-only custom entries do not leak into automatic category selection',()=>{
 let s=editEventDefinition(fresh(),'custom-Manual',{title:'Вручную',text:'',category:'story',from:0,to:0,limit:-1,effects:{}});for(const e of EVENTS)s=setEventLimit(s,e.id,0);s=advanceDevelopment(s,14,0,die=>die===20?18:1);assert.equal(s.developmentEvents.length,0);assert.equal(requestEvent(s,'custom-Manual',14).developmentEvents.length,1);
});
test('standalone events window hides economy and development controls, escapes content and rejects players',async()=>{
 const source=fs.readFileSync(new URL('../scripts/village-events-ui.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');let s=edit(fresh(),'traveler',{title:'<script>x</script>',text:'<img onerror=x>'});const doc={id:'v',name:'Вестерхольм',getFlag:()=>s};const ctx=vm.createContext({DevelopmentApp:class{},foundry:{applications:{api:{DialogV2:{}}}},game:{user:{isGM:true}},Hooks:{on(){}},settlementEntries:()=>[doc],developmentDoc:()=>doc,esc,button,eventDefinitions,eventRange,eventSettings,eventRepeatText,eventCount,eventLimit,eventEffectText,eligible,CATEGORY,TRACKS});vm.runInContext(source+'\nglobalThis.App=VillageEventsApp;',ctx);const app=new ctx.App();app.section='catalog';let html=await app._renderHTML();assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));for(const command of ['fund','economy','deleteVillage','editProject'])assert.ok(!html.includes('data-cmd="'+command+'"'));assert.ok(html.includes('data-cmd="editEvent"'));ctx.game.user.isGM=false;html=await app._renderHTML();assert.equal(html,'<p>Только ведущий.</p>');
});

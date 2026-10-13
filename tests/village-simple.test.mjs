import test from 'node:test';
import assert from 'node:assert/strict';
import {freshVillage,writeNote,addLog} from '../scripts/village-model.mjs';
import {migrateVillage,advanceSimple,beginConstruction,resolveEvent,BUILDINGS,consumption,income} from '../scripts/village-simple.mjs';
import {MONTHS,toDay,fromDay,monthCells,occurs,canSee,canEdit,nearby} from '../scripts/ortes-date.mjs';
import {EVENTS,eventAt} from '../scripts/village-events.mjs';
import {villageHTML} from '../scripts/village-view.mjs';
const fresh=()=>migrateVillage({...freshVillage('Вестерхольм'),population:50,resources:{supplies:30,materials:30,gold:5000}});
test('migration preserves buildings, people, links, resources, history and archives legacy jobs exactly once',()=>{
 const old=freshVillage('Деревня');old.population=1;old.bastions=['Actor.a'];old.bastionDays=4;
 old.buildings=[{id:'b',name:'Дом',condition:'damaged',capacity:1,residents:1,posts:[],job:{name:'Ремонт',remaining:2}}];old.npcs=[{id:'n',name:'Бран',homeId:'b',actorUuid:'Actor.n'}];
 old.log=[{text:'История'}];const copy=structuredClone(old),s=migrateVillage(old,14);
 assert.deepEqual(old,copy);assert.deepEqual(s.legacyV1,old);assert.deepEqual(s.npcs,old.npcs);assert.deepEqual(s.bastions,old.bastions);assert.equal(s.buildings[0].job,null);assert.equal(s.buildings[0].condition,'damaged');assert.equal(s.elapsedDays,4);assert.equal(s.calendarDay,14);assert.deepEqual(migrateVillage(s,100),s);
 assert.throws(()=>migrateVillage({...old,syncPending:{}}),/ход/);
});
test('supply economy rounds up, defaults to self-sufficiency and never creates gold or materials',()=>{
 const s=fresh();assert.equal(consumption({...s,population:51}),11);assert.equal(income(s),10);
 const a=advanceSimple(s,70,0,()=>1);assert.deepEqual(a.resources,s.resources);assert.equal(a.week,11);assert.equal(a.pendingEvents.length,12);
 const b=advanceSimple({...s,supplyIncome:0},28,0,()=>1);assert.equal(b.resources.supplies,0);assert.equal(b.shortage.amount,10);assert.equal(s.resources.supplies,30);
});
test('period counters survive calendar months, correction and persisted reloads',()=>{
 let s=fresh();s=advanceSimple(s,29,0,()=>1);assert.equal(s.pendingEvents.length,4);s=JSON.parse(JSON.stringify(s));s=advanceSimple(s,1,29,()=>1);assert.equal(s.pendingEvents.length,5);s=advanceSimple(s,5,900,()=>1);assert.equal(s.pendingEvents.length,6);assert.equal(s.elapsedDays,35);
 const year=advanceSimple(fresh(),360,0,()=>2);assert.equal(year.pendingEvents.filter(e=>e.table==='minor').length,51);assert.equal(year.pendingEvents.filter(e=>e.table==='major').length,12);assert.equal(new Set(year.pendingEvents.map(e=>e.id)).size,63);
});
test('construction pays once, has no workforce dependency and finishes exactly on due date',()=>{
 const original=fresh(),s=beginConstruction(original,'small','house1',0,'Дом');assert.equal(s.resources.materials,25);assert.equal(s.resources.gold,4500);assert.equal(s.buildings[0].capacity,3);
 assert.throws(()=>beginConstruction(s,'small','house1',0),/существует/);assert.throws(()=>beginConstruction({...original,resources:{materials:0,gold:0}},'small','h',0),/Недостаточно/);
 const day20=advanceSimple(s,20,0,()=>1);assert.ok(!day20.buildings[0].construction.complete);const day21=advanceSimple(day20,1,20,()=>1);assert.ok(day21.buildings[0].construction.complete);assert.equal(day21.calendarEvents.filter(e=>e.category==='construction').length,1);
 const later=advanceSimple(day21,90,21,()=>1);assert.equal(later.calendarEvents.filter(e=>e.category==='construction').length,1);assert.equal(later.resources.gold,4500);assert.equal(original.resources.gold,5000);
 assert.deepEqual(Object.values(BUILDINGS).map(b=>b.days),[21,42,56,28,42,49,84,56,49]);
});
test('both d100 tables have 100 unique results, mixed rolls and exact category distribution',()=>{
 const all=[];for(const rows of Object.values(EVENTS)){assert.equal(rows.length,100);assert.deepEqual(rows.map(r=>r.roll),Array.from({length:100},(_,i)=>i+1));for(const [k,n]of Object.entries({negative:30,neutral:40,positive:30}))assert.equal(rows.filter(r=>r.category===k).length,n);assert.ok(new Set(rows.slice(0,10).map(r=>r.category)).size>1);all.push(...rows.map(r=>r.title));for(const r of rows){assert.ok(r.text.length>20);assert.ok(!/пример события|TODO/i.test(r.text));}}
 assert.equal(new Set(all).size,200);assert.throws(()=>eventAt('minor',0));assert.throws(()=>eventAt('major',101));
});
test('event draws have no effects until accepted, duplicate decision rejects and reroll or skip costs nothing',()=>{
 const s=advanceSimple(fresh(),7,0,()=>1),id=s.pendingEvents[0].id;assert.deepEqual(s.resources,fresh().resources);
 const reroll=resolveEvent(s,id,'reroll',eventAt('minor',1),50);assert.equal(reroll.pendingEvents[0].roll,50);assert.deepEqual(reroll.resources,s.resources);
 const skip=resolveEvent(reroll,id,'skip',eventAt('minor',50));assert.equal(skip.calendarEvents.length,0);assert.deepEqual(skip.resources,s.resources);
 const accepted=resolveEvent(s,id,'accept',{title:'Убыток',text:'Нет запасов',category:'negative',effects:{supplies:-100,gold:10,population:-200}});assert.equal(accepted.resources.supplies,0);assert.equal(accepted.resources.gold,5010);assert.equal(accepted.population,0);assert.equal(accepted.calendarEvents[0].day,7);assert.throws(()=>resolveEvent(accepted,id,'accept',{}),/обработано/);
});
test('calendar has 12 fixed 30-day months, no leap years and continuous weekday positions',()=>{
 assert.equal(MONTHS.length,12);assert.deepEqual(fromDay(359),{year:1,month:12,day:30});assert.deepEqual(fromDay(360),{year:2,month:1,day:1});assert.equal(toDay({year:100,month:1,day:1}),99*360);
 for(let m=1;m<=12;m++){const cells=monthCells(2,m);assert.equal(cells.filter(x=>x!==null).length,30);assert.equal(cells.findIndex(x=>x!==null),toDay({year:2,month:m,day:1})%7);}assert.throws(()=>toDay({year:1,month:2,day:31}));
});
test('visibility and edit rights separate public, own pending, GM-only and locked notes',()=>{
 const player={id:'p'},other={id:'q'},gm={id:'g',isGM:true};const n={day:5,annual:true,author:'p',visibility:'pending'};
 assert.ok(canSee(n,player));assert.ok(!canSee(n,other));assert.ok(canSee(n,gm));assert.ok(!canSee({...n,visibility:'gm'},player));assert.ok(canEdit(n,player));assert.ok(!canEdit({...n,locked:true},player));assert.ok(!canEdit(n,other));assert.ok(canEdit({...n,locked:true},gm));assert.ok(occurs(n,365));assert.equal(nearby([n],6,player)[0].next,365);assert.equal(nearby([n],6,other).length,0);
});
test('new journal keeps complete history and compact UI hides legacy controls',()=>{
 let s=fresh();for(let i=0;i<150;i++)addLog(s,'Запись '+i);assert.ok(s.log.length>150);s=writeNote(s,'n','Новая');assert.equal(s.log.at(-1).day,0);
 const html=villageHTML(s,[{id:'v',name:s.name}],'v');assert.equal((html.match(/<div><strong>/g)||[]).length,4);assert.doesNotMatch(html,/data-cmd="(?:job|cancel|week|undo)"/);assert.match(html,/data-cmd="calendar"/);
});


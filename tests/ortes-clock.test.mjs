import test from 'node:test';
import assert from 'node:assert/strict';
import {freshVillage} from '../scripts/village-model.mjs';
import {beginConstruction} from '../scripts/village-simple.mjs';
import {MONTHS} from '../scripts/ortes-date.mjs';
const MOD='bagrovoe-bleeding',listeners={};
globalThis.Hooks={once(){},on(k,fn){(listeners[k]??=[]).push(fn);}};
let id=0,nativeCalls=[],failNative=false,failVillage=false;
globalThis.foundry={utils:{randomID:()=>`random${++id}`}};
globalThis.Roll=class{async evaluate(){return {total:1};}};
globalThis.ui={notifications:{error(){},warn(){},info(){}}};
const collection=()=>Object.assign([],{get(id){return this.find(d=>d.id===id);}});
class Doc{
 constructor(data){Object.assign(this,structuredClone(data));this.id=data._id??`doc${++id}`;this.pages={contents:[]};}
 getFlag(_,key){return this.flags?.[MOD]?.[key];}
 async setFlag(_,key,value){this.flags??={};this.flags[MOD]??={};this.flags[MOD][key]=structuredClone(value);}
 async update(data){if(data[`flags.${MOD}.village`]){if(failVillage){failVillage=false;throw Error('document disconnected');}await this.setFlag(MOD,'village',data[`flags.${MOD}.village`]);}else Object.assign(this,structuredClone(data));}
 testUserPermission(user){return user.isGM||(this.ownership?.[user.id]??this.ownership?.default??0)>=2;}
}
globalThis.JournalEntry={async create(data){const d=new Doc(data);game.journal.push(d);return d;}};
const clock=await import('../scripts/ortes-clock.mjs');
async function setup({enabled=false}={}){
 id=0;nativeCalls=[];failNative=false;failVillage=false;const gm={id:'gm',isGM:true},player={id:'p',name:'Игрок'},other={id:'q'};
 const settings=new Map();globalThis.game={user:gm,users:Object.assign([gm,player,other],{activeGM:gm,get:id=>game.users.find(u=>u.id===id)}),journal:collection(),actors:[{id:'a',type:'character',items:[{type:'facility'}]}],settings:{get:(_,k)=>settings.get(k),set:async(_,k,v)=>settings.set(k,structuredClone(v))},time:{worldTime:0,async advance(n){this.worldTime+=n;for(const fn of listeners.updateWorldTime??[])fn();}},messages:[]};
 globalThis.dnd5e={settings:{calendarConfig:{enabled},bastionConfiguration:{duration:7}}};
 const raw=freshVillage('Вестерхольм');raw.population=50;raw.resources={supplies:30,materials:30,gold:5000};const d=await JournalEntry.create({name:raw.name,flags:{[MOD]:{village:raw}},ownership:{default:0}});
 clock.installOrtesClock({commit:async(doc,expected,fn)=>{const s=doc.getFlag(MOD,'village');assert.equal(s.revision,expected);await doc.update({[`flags.${MOD}.village`]:fn(structuredClone(s))});},nativeAdvance:async(a,o)=>{nativeCalls.push({...o});if(failNative)throw Error('native disconnected');},refresh(){}});
 await clock.ensureClock();return d;
}
test('calendar advances all villages once, calls native duration exactly once and rejects stale confirmations',async()=>{
 const d=await setup(),initial=clock.publicClock().revision;await clock.advanceCalendar(30,{expected:initial});assert.equal(clock.publicClock().day,30);assert.equal(game.time.worldTime,30*86400);assert.equal(nativeCalls.reduce((n,o)=>n+o.duration,0),30);assert.equal(nativeCalls.filter(o=>o.turn).length,4);assert.equal(d.getFlag(MOD,'village').pendingEvents.length,5);
 await assert.rejects(clock.advanceCalendar(7,{expected:initial}),/изменилась/);assert.equal(clock.publicClock().day,30);await clock.bootClock();assert.equal(d.getFlag(MOD,'village').pendingEvents.length,5);
 assert.deepEqual(Object.keys(clock.publicClock()).sort(),['day','months','revision']);
});
test('partial native failure blocks retry, persists plan and recovery never replays native actions',async()=>{
 const d=await setup();failNative=true;await assert.rejects(clock.advanceCalendar(7),/native disconnected/);assert.equal(clock.calendarStatus().pending.phase,'native-started');assert.equal(d.getFlag(MOD,'village').elapsedDays,0);
 await assert.rejects(clock.advanceCalendar(7),/незавершённый/);assert.equal(nativeCalls.length,1);failNative=false;await clock.recoverCalendar();assert.equal(clock.publicClock().day,7);assert.equal(d.getFlag(MOD,'village').elapsedDays,7);assert.equal(nativeCalls.length,1);await clock.recoverCalendar();assert.equal(nativeCalls.length,1);
});
test('village update interruption recovers stored plan once without rerolling',async()=>{
 const d=await setup();failVillage=true;await assert.rejects(clock.advanceCalendar(7),/document disconnected/);assert.equal(clock.calendarStatus().pending.phase,'native-done');await clock.recoverCalendar();assert.equal(d.getFlag(MOD,'village').pendingEvents.length,1);assert.equal(nativeCalls.length,1);await clock.bootClock();assert.equal(d.getFlag(MOD,'village').pendingEvents.length,1);
});
test('date correction preserves remaining construction, period counters and all supplies without native time',async()=>{
 const d=await setup();await d.setFlag(MOD,'village',beginConstruction(d.getFlag(MOD,'village'),'small','house',0));await clock.advanceCalendar(6);nativeCalls=[];const before=structuredClone(d.getFlag(MOD,'village')),world=game.time.worldTime;
 await clock.correctCalendar(359,MONTHS);const after=d.getFlag(MOD,'village');assert.equal(after.elapsedDays,6);assert.equal(after.buildings[0].construction.end-359,15);assert.deepEqual(after.resources,before.resources);assert.equal(game.time.worldTime,world);assert.equal(nativeCalls.length,0);
 await clock.advanceCalendar(1);assert.equal(nativeCalls[0].duration,1);assert.equal(nativeCalls[0].turn,true);assert.equal(d.getFlag(MOD,'village').pendingEvents.length,1);assert.equal(clock.publicClock().day,360);
});
test('enabled D&D calendar owns native facility progress, so module never repeats it',async()=>{
 await setup({enabled:true});await clock.advanceCalendar(7);assert.equal(nativeCalls.length,0);assert.equal(game.time.worldTime,7*86400);assert.equal(clock.publicClock().day,7);
});
test('player and inactive GM cannot advance, correct or resolve village events',async()=>{
 const d=await setup();game.user=game.users.get('p');await assert.rejects(clock.advanceCalendar(7),/активному/);await assert.rejects(clock.correctCalendar(0,MONTHS),/активному/);await assert.rejects(clock.decideEvent(d.id,'x','accept',0),/активному/);game.user={id:'second',isGM:true};await assert.rejects(clock.advanceCalendar(7),/активному/);assert.equal(clock.publicClock().day,0);
});
test('player requests cannot forge author or publish notes; receipts prevent duplicate creation',async()=>{
 await setup();const author=game.users.get('p'),request={title:'Праздник',text:'Текст',day:1,visibility:'public',author:'gm',locked:true};await clock.saveCalendarNote(request,{requestAuthor:author,requestId:'r1'});await clock.saveCalendarNote(request,{requestAuthor:author,requestId:'r1'});let notes=clock.calendarNotes();assert.equal(notes.length,1);const n=notes[0];assert.equal(n.author,'p');assert.equal(n.visibility,'pending');assert.equal(n.locked,false);assert.equal(game.journal.get(n.id).ownership.default,0);
 game.user=game.users.get('q');assert.equal(clock.calendarNotes().length,0);game.user=author;assert.equal(clock.calendarNotes().length,1);game.user=game.users.activeGM;
 await assert.rejects(clock.saveCalendarNote({...request,id:n.id,expected:1},{requestAuthor:game.users.get('q')}),/нельзя/);
 await clock.saveCalendarNote({...n,expected:1,visibility:'public'});assert.equal(game.journal.get(n.id).ownership.default,2);await assert.rejects(clock.saveCalendarNote({...n,expected:1},{requestAuthor:author}),/изменена/);
 await clock.saveCalendarNote({...n,expected:2,visibility:'gm',locked:true});assert.equal(game.journal.get(n.id).ownership.default,0);await assert.rejects(clock.saveCalendarNote({...n,expected:3},{requestAuthor:author}),/нельзя/);
});
test('authenticated chat author, not payload author, determines note ownership and delete requests are idempotent',async()=>{
 await setup();const message={id:'m1',author:game.users.get('p'),flags:{calendarRequest:{title:'Моя',text:'',day:10,visibility:'gm',author:'gm'}},getFlag(_,k){return this.flags[k];},async setFlag(_,k,v){this.flags[k]=v;}};
 game.messages=[message];await clock.bootClock();const n=clock.calendarNotes()[0];assert.equal(n.author,'p');assert.equal(n.visibility,'pending');assert.equal(message.flags.calendarRequestHandled,true);await clock.bootClock();assert.equal(clock.calendarNotes().length,1);
 await clock.saveCalendarNote({id:n.id,expected:1,remove:true},{requestAuthor:message.author,requestId:'delete1'});await clock.saveCalendarNote({id:n.id,expected:1,remove:true},{requestAuthor:message.author,requestId:'delete1'});assert.ok(game.journal.get(n.id).getFlag(MOD,'calendarNote').deleted);
});

test('enabled native calendar asynchronous work settles before village commit; native rejection preserves recovery plan',async()=>{
 let done=false,fail=false;
 await setup({enabled:true});dnd5e.dataModels={calendar:{CalendarData5e:class{static async handleTimePassage(){await new Promise(r=>setTimeout(r,8));if(fail)throw Error('native calendar failure');done=true;}}}};
 clock.installOrtesClock({commit:async(doc,expected,fn)=>{assert.equal(doc.getFlag(MOD,'village').revision,expected);if(clock.calendarStatus()?.pending)assert.ok(done);await doc.update({[`flags.${MOD}.village`]:fn(structuredClone(doc.getFlag(MOD,'village')))});},nativeAdvance:async()=>{throw Error('must not duplicate system');}});
 game.time.advance=async function(n){this.worldTime+=n;dnd5e.dataModels.calendar.CalendarData5e.handleTimePassage();};
 await clock.advanceCalendar(1);assert.ok(done);assert.equal(clock.publicClock().day,1);
 fail=true;await assert.rejects(clock.advanceCalendar(1),/native calendar failure/);assert.equal(clock.publicClock().day,1);assert.equal(clock.calendarStatus().pending.phase,'native-started');fail=false;await clock.recoverCalendar();assert.equal(clock.publicClock().day,2);
});
test('external fractional days accumulate, backwards time and repeated hooks cannot double charge',async()=>{
 const d=await setup();const tick=async()=>{for(const fn of listeners.updateWorldTime)fn();await new Promise(r=>setTimeout(r,12));};
 game.time.worldTime=3.5*86400;await tick();assert.equal(clock.publicClock().day,3);game.time.worldTime=7*86400;await tick();assert.equal(clock.publicClock().day,7);assert.equal(d.getFlag(MOD,'village').pendingEvents.length,1);
 await tick();game.time.worldTime=2*86400;await tick();game.time.worldTime=7*86400;await tick();assert.equal(clock.publicClock().day,7);assert.equal(d.getFlag(MOD,'village').pendingEvents.length,1);assert.equal(nativeCalls.reduce((sum,x)=>sum+x.duration,0),7);
});

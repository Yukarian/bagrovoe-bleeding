import test from 'node:test';
import assert from 'node:assert/strict';
import {freshVillage} from '../scripts/village-model.mjs';
import {EVENTS,eventCount,eventLimit,eventRepeatText} from '../scripts/village-event-catalog.mjs';
import {migrateDevelopment,eligible,advanceDevelopment,decideDevelopmentEvent,setEventLimit,publicDevelopment} from '../scripts/village-development.mjs';
const fresh=()=>migrateDevelopment(freshVillage('Вестерхольм'));
const definition=k=>EVENTS.find(e=>e.id===k);
function pending(s,key,n=1){const id=key+':'+n;s.developmentEvents.push({...structuredClone(definition(key)),id,eventKey:key,day:n,elapsed:n,status:'pending',projectIndex:null});return id;}
test('catalog has one-off, finite and recurring events without retired mechanics',()=>{
 assert.equal(eventLimit(fresh(),definition('morkant-arrival')),1);assert.equal(eventLimit(fresh(),definition('valkrein-visit')),3);assert.equal(eventLimit(fresh(),definition('fish-gift')),null);
 assert.ok(EVENTS.length>=40);for(const e of EVENTS)for(const k of Object.keys(e.effects))assert.ok(['stock','materials','treasury','days','discount'].includes(k));
});
test('Morkant confirms once; reload and journal deletion do not restore his visit',()=>{
 let s=fresh();const id=pending(s,'morkant-arrival');s=decideDevelopmentEvent(s,id,'apply',1);assert.equal(eventCount(s,'morkant-arrival'),1);assert.equal(eligible(s,definition('morkant-arrival')),false);
 s=migrateDevelopment(JSON.parse(JSON.stringify(s)));s.eventHistory=[];s.log=[];assert.equal(eligible(s,definition('morkant-arrival')),false);assert.equal(eventCount(s,'morkant-arrival'),1);
 pending(s,'morkant-arrival',2);assert.throws(()=>decideDevelopmentEvent(s,'morkant-arrival:2','apply',2),/Лимит/);
});
test('merchant limit can be increased, disabled and made unlimited without clearing counts',()=>{
 let s=fresh();for(let n=1;n<=3;n++){assert.equal(eligible(s,definition('valkrein-visit')),true);s=decideDevelopmentEvent(s,pending(s,'valkrein-visit',n),'apply',n);}
 assert.equal(eligible(s,definition('valkrein-visit')),false);s=setEventLimit(s,'valkrein-visit',4);assert.equal(eligible(s,definition('valkrein-visit')),true);
 s=setEventLimit(s,'valkrein-visit',0);assert.equal(eligible(s,definition('valkrein-visit')),false);s=setEventLimit(s,'valkrein-visit',-1);assert.equal(eventLimit(s,definition('valkrein-visit')),null);assert.equal(eventCount(s,'valkrein-visit'),3);
 for(const n of [-2,1000,1.5,NaN])assert.throws(()=>setEventLimit(s,'valkrein-visit',n));assert.throws(()=>setEventLimit(s,'missing',3));
});
test('pending and deferred events cannot duplicate; skipping does not spend a visit',()=>{
 let s=fresh();const id=pending(s,'valkrein-visit');assert.equal(eligible(s,definition('valkrein-visit')),false);s=decideDevelopmentEvent(s,id,'defer',1);assert.equal(eligible(s,definition('valkrein-visit')),false);assert.equal(eventCount(s,'valkrein-visit'),0);
 s=decideDevelopmentEvent(s,id,'skip',2);assert.equal(eligible(s,definition('valkrein-visit')),true);assert.equal(eventCount(s,'valkrein-visit'),0);
});
test('migration derives counters from applied history, preserves overrides and is idempotent',()=>{
 const s=fresh();delete s.eventCounts;s.eventCatalogVersion=2;s.eventLimits={'valkrein-visit':5};s.eventHistory=[{id:'old',eventKey:'cache',status:'applied'},{id:'skip',eventKey:'cache',status:'skipped'},{id:'v1',eventKey:'valkrein-visit',status:'applied'}];
 const out=migrateDevelopment(s);assert.equal(eventCount(out,'cache'),1);assert.equal(eligible(out,definition('cache')),false);assert.equal(eventCount(out,'valkrein-visit'),1);assert.equal(eventLimit(out,definition('valkrein-visit')),5);assert.deepEqual(out.eventHistory,s.eventHistory);assert.deepEqual(migrateDevelopment(out),out);
});
test('calendar selection respects disabled/exhausted visits and 60-day cooldown',()=>{
 let s=fresh();for(const e of EVENTS)s=setEventLimit(s,e.id,0);s=setEventLimit(s,'morkant-arrival',1);
 s=advanceDevelopment(s,14,0,die=>die===20?20:1);assert.equal(s.developmentEvents.length,1);assert.equal(s.developmentEvents[0].eventKey,'morkant-arrival');s=decideDevelopmentEvent(s,s.developmentEvents[0].id,'apply',14);
 s=advanceDevelopment(s,140,14,die=>die===20?20:1);assert.equal(s.developmentEvents.length,0);
 s=setEventLimit(s,'valkrein-visit',-1);s=advanceDevelopment(s,14,s.calendarDay,die=>die===20?18:1);s=decideDevelopmentEvent(s,s.developmentEvents[0].id,'apply',s.calendarDay);
 s=advanceDevelopment(s,56,s.calendarDay,die=>die===20?18:1);assert.equal(s.developmentEvents.length,0);s=advanceDevelopment(s,14,s.calendarDay,die=>die===20?18:1);assert.equal(s.developmentEvents.length,1);
});
test('failed resource consequence does not consume occurrence; state never leaks publicly',()=>{
 let s=fresh();s=setEventLimit(s,'lost-coins',1);s.economy.treasury=0;const id=pending(s,'lost-coins');assert.throws(()=>decideDevelopmentEvent(s,id,'apply',1),/полной суммы/);assert.equal(eventCount(s,'lost-coins'),0);
 const pub=JSON.stringify(publicDevelopment(s,'v'));assert.doesNotMatch(pub,/eventCounts|eventLimits|eventHistory|Моркант/);assert.match(eventRepeatText(s,definition('morkant-arrival')),/Одноразовое/);
});

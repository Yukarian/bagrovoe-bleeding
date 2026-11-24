import test from 'node:test';
import assert from 'node:assert/strict';
import {freshVillage} from '../scripts/village-model.mjs';
import {EVENTS,eventEffectText,eventDefinitions,eventRange,eventAtRoll,eventSettings} from '../scripts/village-event-catalog.mjs';
import {migrateDevelopment,decideDevelopmentEvent,eligible,publicDevelopment,requestEvent,advanceDevelopment,editEventDefinition} from '../scripts/village-development.mjs';
import {economySummary} from '../scripts/village-economy.mjs';
import {developmentEventsHTML} from '../scripts/development-view.mjs';
const fresh=()=>{const s=freshVillage('Вестерхольм');s.population=50;return migrateDevelopment(s);};
const pending=(s,key)=>{const e=structuredClone(EVENTS.find(e=>e.id===key));s.developmentEvents.push({...e,id:key+':14',eventKey:key,status:'pending',day:14,elapsed:14,projectIndex:null});return key+':14';};
test('one hundred current events have unique identities and only supported effects',()=>{
 assert.equal(EVENTS.length,100);assert.equal(new Set(EVENTS.map(e=>e.id)).size,100);assert.equal(new Set(EVENTS.map(e=>e.title)).size,100);
 for(const e of EVENTS){assert.ok(['good','bad','story','special'].includes(e.category));assert.ok(Object.keys(e.effects).length<=1);for(const k of Object.keys(e.effects))assert.ok(['treasury'].includes(k));if(e.effects.days||e.effects.discount)assert.ok(e.track);}
});
test('resource event changes current economy exactly once, not archived stocks or weekly rates',()=>{
 let s=fresh();const id=pending(s,'fish-gift'),before=economySummary(s),archived=structuredClone(s.resources),population=s.population;
 const out=decideDevelopmentEvent(s,id,'apply',14),after=economySummary(out);
 assert.equal(after.treasury,before.treasury+15);for(const key of ['net','supplyProduction','consumption','capacity','stock','materials'])assert.equal(after[key],before[key]);
 assert.equal(out.population,population);assert.deepEqual(out.resources,archived);assert.equal(out.eventHistory[0].moneyPending,undefined);
 assert.throws(()=>decideDevelopmentEvent(out,id,'apply',14),/уже обработано/);assert.equal(s.developmentEvents.length,1);
 assert.doesNotMatch(JSON.stringify(publicDevelopment(out,'v')),/Рыба для амбара|eventHistory|previousDefinition/);
});
test('resource losses report actual remainder and cannot create negative stock',()=>{
 const s=fresh();s.economy.treasury=10;const id=pending(s,'damp-grain'),out=decideDevelopmentEvent(s,id,'apply',14);
 assert.equal(out.economy.treasury,0);assert.match(out.eventHistory[0].result,/10 → 0/);
 assert.equal(eligible(out,EVENTS.find(e=>e.id==='damp-grain')),false);
});
test('treasury expenses revalidate funds at confirmation without creating debt',()=>{
 const s=fresh();s.economy.treasury=10;const id=pending(s,'lost-coins');s.economy.treasury=5;
 assert.throws(()=>decideDevelopmentEvent(s,id,'apply',14),/полной суммы/);assert.equal(s.economy.treasury,5);assert.equal(s.developmentEvents[0].status,'pending');
 s.economy.treasury=10;const out=decideDevelopmentEvent(s,id,'apply',14);assert.equal(out.economy.treasury,0);assert.equal(out.eventHistory[0].moneyPending,undefined);
});
test('cash reward goes to village treasury while skip and defer never change balances',()=>{
 const s=fresh();s.economy.treasury=-10;const id=pending(s,'cache');
 for(const decision of ['skip','defer'])assert.deepEqual(decideDevelopmentEvent(s,id,decision,14).economy,s.economy);
 const out=decideDevelopmentEvent(s,id,'apply',14);assert.equal(out.economy.treasury,40);assert.equal(out.development.pendingPayment,null);assert.equal(out.eventHistory[0].moneyPending,undefined);
});
test('old pending definitions refresh without overwriting history or paid receipts',()=>{
 const s=fresh();delete s.eventCatalogVersion;pending(s,'cache');s.developmentEvents[0].effects={gold:150};s.developmentEvents[0].text='Старый текст';s.eventHistory=[{id:'finished',moneyPending:150,result:'Подтверждено раньше'}];
 const out=migrateDevelopment(s);assert.deepEqual(out.developmentEvents[0].effects,{treasury:50});assert.deepEqual(out.developmentEvents[0].previousDefinition.effects,{gold:150});assert.deepEqual(out.eventHistory,s.eventHistory);
 assert.deepEqual(migrateDevelopment(out),out);assert.equal(s.developmentEvents[0].effects.gold,150);
});
test('event UI previews village destinations instead of misleading character payment',()=>{
 const s=fresh();pending(s,'cache');pending(s,'fish-gift');
 const html=developmentEventsHTML(s,{months:Array(12).fill('Месяц')});assert.match(html,/Казна: \+50 зм/);assert.match(html,/Казна: \+15/);assert.match(html,/100 событий/);assert.doesNotMatch(html,/Выбрать персонажа для расчёта/);
 assert.match(eventEffectText(EVENTS.find(e=>e.id==='lost-coins')),/полная сумма/);
});

test('all 100 default d100 positions are populated and use only treasury or story consequences',()=>{
 const s=fresh();for(let n=1;n<=100;n++){const e=eventAtRoll(s,n);assert.ok(e);assert.equal(eventRange(s,e.id)[0],n);assert.equal(e.track,null);assert.deepEqual(Object.keys(e.effects).filter(k=>k!=='treasury'),[]);}
 assert.deepEqual(eventSettings(s),{mode:'table',interval:7,cooldown:60});
});
test('completed one-off becomes a recurring follow-up in the same slot without repeating reward',()=>{
 let s=fresh();const range=eventRange(s,'cache');s=requestEvent(s,'cache',0);s=decideDevelopmentEvent(s,s.developmentEvents[0].id,'apply',0);const coins=s.economy.treasury;
 assert.equal(eventAtRoll(s,range[0]).continuation,true);s=requestEvent(s,'cache',7);assert.match(s.developmentEvents[0].title,/Истории/);s=decideDevelopmentEvent(s,s.developmentEvents[0].id,'apply',7);assert.equal(s.economy.treasury,coins);
 s.eventHistory=[];s=migrateDevelopment(s);assert.equal(eventDefinitions(s).find(e=>e.id==='cache').continuation,true);assert.equal(eventRange(s,'cache')[0],range[0]);
});
test('one check per week including long advances, no early or retroactive checks on migration',()=>{
 let s=fresh(),calls=0;const draw=die=>{assert.equal(die,100);calls++;return 53;};s=advanceDevelopment(s,6,0,draw);assert.equal(calls,0);s=advanceDevelopment(s,15,6,draw);assert.equal(calls,3);assert.equal(s.nextEventElapsed,28);
 s.eventCatalogVersion=3;s.eventSettings.interval=14;s=migrateDevelopment(s);assert.equal(s.nextEventElapsed,28);assert.equal(s.eventSettings.interval,7);assert.equal(calls,3);
});
test('Valkrein switches to messenger after three completed visits, skipped visit does not count',()=>{
 let s=fresh();s=requestEvent(s,'valkrein-visit',0);s=decideDevelopmentEvent(s,s.developmentEvents[0].id,'skip',0);assert.equal(eventDefinitions(s).find(e=>e.id==='valkrein-visit').continuation,undefined);
 for(let n=0;n<3;n++){s=requestEvent(s,'valkrein-visit',n);s=decideDevelopmentEvent(s,s.developmentEvents[0].id,'apply',n);}
 assert.match(eventDefinitions(s).find(e=>e.id==='valkrein-visit').title,/Посыльный/);
});

 test('follow-up remains editable without changing the completed original snapshot',()=>{
 let s=fresh();s=requestEvent(s,'cache',0);s=decideDevelopmentEvent(s,s.developmentEvents[0].id,'apply',0);
 const history=structuredClone(s.eventHistory),[from,to]=eventRange(s,'cache');
 s=editEventDefinition(s,'cache',{title:'Новое продолжение',text:'Слухи о находке',category:'story',from,to,limit:-1,effects:{treasury:5}});
 assert.equal(eventDefinitions(s).find(e=>e.id==='cache').title,'Новое продолжение');assert.deepEqual(s.eventHistory,history);
 assert.equal(eventDefinitions(migrateDevelopment(s)).find(e=>e.id==='cache').effects.treasury,5);
 });

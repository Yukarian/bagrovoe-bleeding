import test from 'node:test';
import assert from 'node:assert/strict';
import {freshVillage} from '../scripts/village-model.mjs';
import {EVENTS,eventEffectText} from '../scripts/village-event-catalog.mjs';
import {migrateDevelopment,decideDevelopmentEvent,eligible,publicDevelopment} from '../scripts/village-development.mjs';
import {economySummary} from '../scripts/village-economy.mjs';
import {developmentEventsHTML} from '../scripts/development-view.mjs';
const fresh=()=>{const s=freshVillage('Вестерхольм');s.population=50;return migrateDevelopment(s);};
const pending=(s,key)=>{const e=structuredClone(EVENTS.find(e=>e.id===key));s.developmentEvents.push({...e,id:key+':14',eventKey:key,status:'pending',day:14,elapsed:14,projectIndex:null});return key+':14';};
test('fifty current events have unique identities and only supported effects',()=>{
 assert.equal(EVENTS.length,50);assert.equal(new Set(EVENTS.map(e=>e.id)).size,50);assert.equal(new Set(EVENTS.map(e=>e.title)).size,50);
 for(const e of EVENTS){assert.ok(['good','bad','story','special'].includes(e.category));assert.ok(Object.keys(e.effects).length<=1);for(const k of Object.keys(e.effects))assert.ok(['stock','materials','treasury','days','discount'].includes(k));if(e.effects.days||e.effects.discount)assert.ok(e.track);}
});
test('resource event changes current economy exactly once, not archived stocks or weekly rates',()=>{
 let s=fresh();const id=pending(s,'fish-gift'),before=economySummary(s),archived=structuredClone(s.resources),population=s.population;
 const out=decideDevelopmentEvent(s,id,'apply',14),after=economySummary(out);
 assert.equal(after.stock,before.stock+3);for(const key of ['net','supplyProduction','consumption','capacity','treasury','materials'])assert.equal(after[key],before[key]);
 assert.equal(out.population,population);assert.deepEqual(out.resources,archived);assert.equal(out.eventHistory[0].moneyPending,undefined);
 assert.throws(()=>decideDevelopmentEvent(out,id,'apply',14),/уже обработано/);assert.equal(s.developmentEvents.length,1);
 assert.doesNotMatch(JSON.stringify(publicDevelopment(out,'v')),/Рыба для амбара|eventHistory|previousDefinition/);
});
test('resource losses report actual remainder and cannot create negative stock',()=>{
 const s=fresh();s.economy.stock=1;const id=pending(s,'damp-grain'),out=decideDevelopmentEvent(s,id,'apply',14);
 assert.equal(out.economy.stock,0);assert.match(out.eventHistory[0].result,/1 → 0/);
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
 const html=developmentEventsHTML(s,{months:Array(12).fill('Месяц')});assert.match(html,/Казна: \+50 зм/);assert.match(html,/Запас припасов: \+3/);assert.match(html,/50 вариантов/);assert.doesNotMatch(html,/Выбрать персонажа для расчёта/);
 assert.match(eventEffectText(EVENTS.find(e=>e.id==='lost-coins')),/полная сумма/);
});

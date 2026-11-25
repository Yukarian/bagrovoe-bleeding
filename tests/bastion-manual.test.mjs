import test from 'node:test';
import assert from 'node:assert/strict';
import {freshVillage} from '../scripts/village-model.mjs';
import {migrateDevelopment,advanceDevelopment,requestEvent,publicDevelopment} from '../scripts/village-development.mjs';
import {profileUpdate,applyResidentProfileSource,RESIDENT_PROFILES} from '../scripts/resident-profiles.mjs';
import {villageHTML} from '../scripts/village-view.mjs';
const MOD='bagrovoe-bleeding';
test('manual weeks create private reminders without rolling, queueing or altering occurrence history',()=>{
 let s=migrateDevelopment(freshVillage('Тест'));const counts=structuredClone(s.eventCounts);
 s=advanceDevelopment(s,20,0,()=>{throw Error('Automatic roll forbidden');});assert.equal(s.eventReminder.weeks,2);assert.equal(s.eventReminder.day,14);assert.equal(s.developmentEvents.length,0);assert.deepEqual(s.eventCounts,counts);
 s=advanceDevelopment(s,1,20,()=>{throw Error('Automatic roll forbidden');});assert.equal(s.eventReminder.weeks,3);assert.equal(s.nextEventElapsed,28);
 assert.equal(publicDevelopment(s,'v').eventReminder,undefined);assert.match(villageHTML(s,[],'v'),/Напоминание мастеру/);assert.doesNotMatch(villageHTML(s,[],'v'),/Места деревни|О деревне/);
 s=requestEvent(s,'harvest',21);assert.equal(s.developmentEvents.length,1);assert.equal(s.eventReminder,null);
});
test('catalog upgrade selects manual mode while preserving customized ranges and prior events',()=>{
 let s=migrateDevelopment(freshVillage('Тест'));s.eventCatalogVersion=4;s.eventSettings={mode:'table',interval:7,cooldown:13};s.eventRanges={harvest:[4,4]};s.eventHistory=[{eventKey:'cache',status:'applied',text:'old'}];
 s=migrateDevelopment(s);assert.equal(s.eventSettings.mode,'manual');assert.equal(s.eventSettings.cooldown,13);assert.deepEqual(s.eventRanges,{harvest:[4,4]});assert.equal(s.eventHistory[0].text,'old');assert.deepEqual(migrateDevelopment(s),s);
});
test('resident public notes preserve existing player text and never copy GM secrets',()=>{
 const a={name:'Мира',type:'npc',flags:{},system:{details:{biography:{public:'<p>Известное игрокам</p>',value:'СЕКРЕТ ДЛЯ МАСТЕРА'}}}};
 const patch=profileUpdate(a);assert.match(patch['system.details.biography.public'],/Известное игрокам/);assert.match(patch['system.details.biography.public'],/лекарь/);assert.doesNotMatch(JSON.stringify(patch),/СЕКРЕТ/);assert.equal(patch.ownership,undefined);
 applyResidentProfileSource(a);assert.equal(profileUpdate(a),null);assert.equal(a.system.details.biography.value,'СЕКРЕТ ДЛЯ МАСТЕРА');assert.equal(a.flags[MOD].residentPublicVersion,1);
 assert.equal(profileUpdate({...a,name:'Неизвестный',flags:{}}),null);assert.equal(RESIDENT_PROFILES.length,11);
});

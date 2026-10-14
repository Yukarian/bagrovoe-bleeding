import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateDevelopment as migrateVillage} from '../scripts/village-development.mjs';
import {freshVillage,editVillage,previewWeek} from '../scripts/village-model.mjs';
globalThis.foundry={applications:{api:{ApplicationV2:class{},DialogV2:{}}},utils:{}};
globalThis.Hooks={once(){},on(){}};
globalThis.game={user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}}};
const {commitVillage}=await import('../scripts/villages.js');
function doc(){return {name:'Деревня',state:freshVillage('Деревня'),getFlag(){return this.state;},async update(data){await new Promise(r=>setTimeout(r,2));this.state=data['flags.bagrovoe-bleeding.village'];this.name=data.name;}};}
test('simultaneous week confirmation commits once and rejects stale retry',async()=>{const d=doc(),results=await Promise.allSettled([commitVillage(d,0,s=>previewWeek(s).state),commitVillage(d,0,s=>previewWeek(s).state)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(d.state.week,2);assert.equal(d.state.revision,1);});
test('writes reject non-GMs and secondary GMs',async()=>{const d=doc();game.user.isGM=false;await assert.rejects(commitVillage(d,0,s=>s),/активный/);game.user.isGM=true;game.users.activeGM.id='another';await assert.rejects(commitVillage(d,0,s=>s),/активный/);game.users.activeGM.id='gm';assert.equal(d.state.revision,0);});
test('failed document update leaves state retryable without spending',async()=>{const d=doc(),update=d.update;d.update=async()=>{throw Error('offline');};await assert.rejects(commitVillage(d,0,s=>editVillage(s,x=>{x.resources.gold=10;})),/offline/);assert.equal(d.state.resources.gold,0);d.update=update;await commitVillage(d,0,s=>editVillage(s,x=>{x.resources.gold=10;}));assert.equal(d.state.resources.gold,10);});

test('settlement actions preserve buildings and notes without workforce controls',async()=>{
 const {VillageApp}=await import('../scripts/villages.js');const d=doc();d.id='v';d.testUserPermission=()=>true;const messages=[];
 globalThis.JournalEntry={create:async data=>{const doc={...data,id:'pub',getFlag:(_,k)=>data.flags?.['bagrovoe-bleeding']?.[k],update:async()=>{}};game.journal.push(doc);return doc;}};
 globalThis.ui={notifications:{error:m=>messages.push(m),warn:m=>messages.push(m)}};
 game.journal=Object.assign([d],{get:id=>id==='v'?d:null});game.actors=[];game.settings={get:()=>({day:0,revision:0})};d.state=migrateVillage(d.state);
 let counter=0;foundry.utils.randomID=()=>`id${++counter}`;
 const responses=[];foundry.applications.api.DialogV2.wait=async()=>responses.shift();foundry.applications.api.DialogV2.confirm=async()=>true;
 const app=new VillageApp();app.selected='v';app.render=async()=>{await app._renderHTML();return app;};await app.render();
 const fill=data=>responses.push(new Map(Object.entries(data)));
 fill({name:'Тестовая',population:'4',incomeMode:'auto',ressupplies:'20',resmaterials:'10',resgold:'50',upsupplies:'2',upmaterials:'0',upgold:'0',notes:''});await app.command('settings');assert.equal(d.state.population,4);
 fill({name:'Ферма',type:'farm',condition:'intact',occupied:'yes',capacity:'4',residents:'2',owner:'Игроки',img:'',notes:''});await app.command('building','');const b=d.state.buildings[0];assert.equal(b.posts[0].title,'Фермер');
 fill({name:'Фермер',actorUuid:'',homeId:b.id,notes:''});await app.command('npc','');const n=d.state.npcs[0];

 assert.equal(d.state.supplyIncome,null);assert.equal(d.state.buildings[0].posts[0].npcId,'');assert.deepEqual(messages,[]);
 fill({text:'Прибыл караван.\nНужен склад.'});await app.command('note','');const note=d.state.log.find(l=>l.manual);assert.ok(note);assert.match(note.text,/\n/);
 fill({text:'Караван разгружен.'});await app.command('note',note.id);assert.equal(d.state.log.find(l=>l.id===note.id).text,'Караван разгружен.');
 await app.command('removeNote',note.id);assert.ok(!d.state.log.some(l=>l.id===note.id));assert.deepEqual(messages,[]);
});

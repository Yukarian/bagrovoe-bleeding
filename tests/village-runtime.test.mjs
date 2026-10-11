import test from 'node:test';
import assert from 'node:assert/strict';
import {freshVillage,editVillage,previewWeek} from '../scripts/village-model.mjs';
globalThis.foundry={applications:{api:{ApplicationV2:class{},DialogV2:{}}},utils:{}};
globalThis.Hooks={once(){},on(){}};
globalThis.game={user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}}};
const {commitVillage}=await import('../scripts/villages.js');
function doc(){return {name:'Деревня',state:freshVillage('Деревня'),getFlag(){return this.state;},async update(data){await new Promise(r=>setTimeout(r,2));this.state=data['flags.bagrovoe-bleeding.village'];this.name=data.name;}};}
test('simultaneous week confirmation commits once and rejects stale retry',async()=>{const d=doc(),results=await Promise.allSettled([commitVillage(d,0,s=>previewWeek(s).state),commitVillage(d,0,s=>previewWeek(s).state)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(d.state.week,2);assert.equal(d.state.revision,1);});
test('writes reject non-GMs and secondary GMs',async()=>{const d=doc();game.user.isGM=false;await assert.rejects(commitVillage(d,0,s=>s),/активный/);game.user.isGM=true;game.users.activeGM.id='another';await assert.rejects(commitVillage(d,0,s=>s),/активный/);game.users.activeGM.id='gm';assert.equal(d.state.revision,0);});
test('failed document update leaves state retryable without spending',async()=>{const d=doc(),update=d.update;d.update=async()=>{throw Error('offline');};await assert.rejects(commitVillage(d,0,s=>editVillage(s,x=>{x.resources.gold=10;})),/offline/);assert.equal(d.state.resources.gold,0);d.update=update;await commitVillage(d,0,s=>editVillage(s,x=>{x.resources.gold=10;}));assert.equal(d.state.resources.gold,10);});

test('settlement window actions save settings, building, NPC, staff, order, week and undo',async()=>{
 const {VillageApp}=await import('../scripts/villages.js');const d=doc();d.id='v';const messages=[];
 globalThis.ui={notifications:{error:m=>messages.push(m),warn:m=>messages.push(m)}};
 game.journal=Object.assign([d],{get:id=>id==='v'?d:null});game.actors=[];
 let counter=0;foundry.utils.randomID=()=>`id${++counter}`;
 const responses=[];foundry.applications.api.DialogV2.wait=async()=>responses.shift();foundry.applications.api.DialogV2.confirm=async()=>true;
 const app=new VillageApp();app.selected='v';app.render=async()=>{await app._renderHTML();return app;};await app.render();
 const fill=data=>responses.push(new Map(Object.entries(data)));
 fill({name:'Тестовая',population:'4',order:'3',ressupplies:'20',resmaterials:'10',resgold:'50',upsupplies:'2',upmaterials:'0',upgold:'0',notes:''});await app.command('settings');assert.equal(d.state.population,4);
 fill({name:'Ферма',type:'farm',condition:'intact',occupied:'yes',capacity:'4',residents:'2',owner:'Игроки',img:'',notes:''});await app.command('building','');const b=d.state.buildings[0];assert.equal(b.posts[0].title,'Фермер');
 fill({name:'Фермер',actorUuid:'',homeId:b.id,notes:''});await app.command('npc','');const n=d.state.npcs[0];
 fill({title:'Фермер',npcId:n.id});await app.command('post',b.id+':'+b.posts[0].id);
 fill({name:'Урожай',weeks:'1',costsupplies:'0',costmaterials:'0',costgold:'5',gainsupplies:'8',gainmaterials:'0',gaingold:'0',orderGain:'0',targetId:'',note:''});await app.command('job',b.id);assert.equal(d.state.resources.gold,45);
 await app.command('week');assert.equal(d.state.week,2);assert.equal(d.state.resources.supplies,26);assert.equal(d.state.buildings[0].job,null);
 await app.command('undo');assert.equal(d.state.week,1);assert.equal(d.state.resources.supplies,20);assert.ok(d.state.buildings[0].job);assert.deepEqual(messages,[]);
});

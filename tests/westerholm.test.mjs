import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validate,stats,previewWeek} from '../scripts/village-model.mjs';
const doc=JSON.parse(fs.readFileSync(new URL('../packs-src/settlements.json',import.meta.url))).find(d=>d.name==='Вестерхольм');
test('Westerholm counts residents once and supports the first economic turn',()=>{
 const s=validate(doc.flags['bagrovoe-bleeding'].village);assert.equal(s.population,50);assert.equal(s.npcs.length,9);assert.equal(stats(s).housed,50);assert.equal(stats(s).total,24);assert.equal(stats(s).damaged,4);assert.equal(stats(s).empty,4);assert.equal(s.buildings.filter(b=>b.type==='house'&&b.occupied).length,12);assert.equal(previewWeek(s).state.resources.supplies,20);assert.ok(!s.npcs.some(n=>n.name==='Гаррет'));assert.ok(s.buildings.every(b=>!b.job));
});
globalThis.foundry={applications:{api:{ApplicationV2:class{},DialogV2:{}}}};globalThis.Hooks={once(){},on(){}};
test('Westerholm seed creates once and never overwrites an existing or renamed settlement',async()=>{
 const {ensureWesterholm}=await import('../scripts/villages.js');let writes=0;
 globalThis.game={user:{isGM:true,id:'gm'},users:{activeGM:{id:'gm'}},journal:[],folders:[{id:'root',type:'JournalEntry',name:'Мир Ортес'},{id:'child',type:'JournalEntry',name:'Поселения',folder:{id:'root'}}],packs:new Map([['bagrovoe-bleeding.settlements',{getDocument:async()=>({toObject:()=>structuredClone(doc)})}]])};
 globalThis.JournalEntry={create:async data=>{writes++;assert.equal(data.ownership.default,0);assert.equal(data.folder,'child');game.journal.push({name:data.name,getFlag:(m,k)=>data.flags[m]?.[k]});}};
 await ensureWesterholm();await ensureWesterholm();assert.equal(writes,1);game.journal[0].name='Переименовано';await ensureWesterholm();assert.equal(writes,1);game.journal=[{name:'Вестерхольм',getFlag:()=>undefined}];await ensureWesterholm();assert.equal(writes,1);game.journal=[];game.user.isGM=false;await ensureWesterholm();assert.equal(writes,1);
});

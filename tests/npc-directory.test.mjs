import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.Hooks={once(){}};
const MOD='bagrovoe-bleeding';
const {organizeNpcDirectory}=await import('../scripts/npc-directory.mjs');
test('old-world NPC libraries move once, accepting native Set metadata and leaving unrelated libraries alone',async()=>{
 const folders=[{id:'r',name:'Мир Ортес',type:'Compendium',folder:null}],moves=[],settings=new Map();
 globalThis.game={user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},folders,settings:{get:(_,k)=>settings.get(k),set:async(_,k,v)=>settings.set(k,v)},modules:new Map([[MOD,{packs:new Set([{name:'actors',type:'Actor'},{name:'westerholm-residents',type:'Actor'},{name:'settlements',type:'JournalEntry'}])}]]),packs:new Map(['actors','westerholm-residents'].map(name=>[MOD+'.'+name,{setFolder:async f=>moves.push([name,f.id])}]))};
 globalThis.Folder={create:async data=>{const f={...data,id:'npc'};folders.push(f);return f;}};
 await organizeNpcDirectory();assert.equal(folders.length,2);assert.equal(folders[1].name,'NPC');assert.equal(moves.length,2);await organizeNpcDirectory();assert.equal(moves.length,2);
 settings.clear();game.user={id:'p',isGM:false};await organizeNpcDirectory();assert.equal(moves.length,2);
});
test('every Actor library belongs to the NPC sidebar section and nine residents have portable assets and public biographies',()=>{
 const m=JSON.parse(fs.readFileSync(new URL('../module.json',import.meta.url))),npc=m.packFolders[0].folders.find(f=>f.name==='NPC');
 assert.deepEqual([...npc.packs].sort(),m.packs.filter(p=>p.type==='Actor').map(p=>p.name).sort());
 const a=JSON.parse(fs.readFileSync(new URL('../packs-src/westerholm-residents.json',import.meta.url)));assert.equal(a.length,9);assert.equal(new Set(a.map(d=>d._id)).size,9);
 for(const d of a){assert.ok(d.items.length>=3);assert.match(d.system.details.biography.public,/Что известно жителям/);assert.equal(d.prototypeToken.texture.src,d.img);assert.ok(fs.existsSync(new URL('../'+d.img.replace('modules/'+MOD+'/',''),import.meta.url)));assert.doesNotMatch(JSON.stringify(d),/uploaded-chat-media|modules\/ag-icons/);}
});

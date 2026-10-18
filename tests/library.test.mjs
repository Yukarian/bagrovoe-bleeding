import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const manifest=JSON.parse(fs.readFileSync(new URL('../module.json',import.meta.url)));
const source=fs.readFileSync(new URL('../scripts/library.mjs',import.meta.url),'utf8').replace('export async function','async function');
function harness(isGM=true,initialVersion=0) {
  const folders=[],packs=[],writes=[];let version=initialVersion;
  folders.get=id=>folders.find(f=>f.id===id);packs.get=id=>packs.find(p=>p.collection===id);
  function folder(name,parent=null){const f={id:`f${folders.length}`,name,type:'Compendium',folder:parent,async update(d){this.folder=d.folder;}};folders.push(f);return f;}
  const old=folder('Багровое Причастие'),leaf=folder('Бестиарий',old.id),other=folder('Other');
  for(const p of manifest.packs)packs.push({collection:`${manifest.id}.${p.name}`,folder:leaf,ownership:{PLAYER:'OBSERVER',TRUSTED:'OWNER'},async configure(c){writes.push(this.collection);this.ownership=c.ownership;},async setFolder(f){this.folder=f;}});
  packs.push({collection:'another.actors',folder:other,ownership:{PLAYER:'OBSERVER'}});
  const ctx=vm.createContext({console,Hooks:{once(){}},game:{user:{id:'gm',isGM},users:{activeGM:{id:'gm'}},modules:new Map([[manifest.id,manifest]]),packs,folders,settings:{get:()=>version,set:async(m,k,v)=>{version=v;}}},Folder:{create:async d=>Object.assign(folder(d.name,d.folder),d)}});
  vm.runInContext(source,ctx);return {ctx,packs,folders,old,writes,version:()=>version};
}
test('existing world permissions close both player roles; legacy folder moves beneath Ortes and unrelated packs survive',async()=>{
  const h=harness();await h.ctx.configureLibrary();
  assert.equal(h.writes.length,manifest.packs.length);for(const p of h.packs.slice(0,manifest.packs.length)){assert.equal(p.ownership.PLAYER,'NONE');assert.equal(p.ownership.TRUSTED,'NONE');}
  const root=h.folders.find(f=>f.name==='Мир Ортес');assert.equal(h.old.folder,root.id);
  assert.equal(h.packs.at(-1).ownership.PLAYER,'OBSERVER');assert.equal(h.packs.at(-1).folder.name,'Other');assert.equal(h.version(),3);
  const count=h.folders.length;await h.ctx.configureLibrary();assert.equal(h.folders.length,count);assert.equal(h.writes.length,manifest.packs.length);
});
test('player session cannot configure libraries',async()=>{const h=harness(false);await h.ctx.configureLibrary();assert.equal(h.writes.length,0);assert.equal(h.version(),0);});
test('worlds with layout version 2 receive the new house and artifact folders once',async()=>{
 const h=harness(true,2);await h.ctx.configureLibrary();assert.equal(h.version(),3);
 assert.equal(h.packs.find(p=>p.collection.endsWith('.valkrein')).folder.name,'Торговый дом Валькрейн');
 assert.equal(h.packs.find(p=>p.collection.endsWith('.world-items')).folder.name,'Артефакты мира');
 const n=h.folders.length;await h.ctx.configureLibrary();assert.equal(h.folders.length,n);
});
test('every shipped pack denies PLAYER and TRUSTED',()=>{for(const p of manifest.packs){assert.equal(p.ownership.PLAYER,'NONE');assert.equal(p.ownership.TRUSTED,'NONE');}});

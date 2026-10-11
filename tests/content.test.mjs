import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const actors=JSON.parse(fs.readFileSync(new URL('../packs-src/actors.json',import.meta.url)));
const abilities=JSON.parse(fs.readFileSync(new URL('../packs-src/abilities.json',import.meta.url)));
const slugs=['bagrovyj-olen','bagrovoe-otrodie','emili-yasati','bagrovyj-drevnij'];
for(const slug of slugs) test(`${slug}: artwork, resources, attack arithmetic and ability copies`,()=>{
 const a=actors.find(a=>a.system.identifier===slug);assert.ok(a);
 assert.equal(a.flags['bagrovoe-bleeding'].sourceSlug,slug);
 assert.ok(a.img.endsWith(`/portraits/${slug}.png`));assert.ok(a.prototypeToken.texture.src.endsWith(`/tokens/${slug}.png`));
 const hp=a.system.attributes.hp,hd=a.system.attributes.hd;
 const con=Math.floor((a.system.abilities.con.value-10)/2);
 assert.equal(hp.max,Math.floor(hd.max*((Number(hd.denomination.slice(1))+1)/2+con)));
 assert.equal(hp.value,hp.max);assert.equal(hd.spent,0);
 const prof=2+Math.floor((a.system.details.cr-1)/4);
 for(const i of a.items){
  assert.deepEqual(abilities.find(x=>x._id===i._id),i);
  for(const [key,act] of Object.entries(i.system.activities)){
   assert.equal(key,act._id);
   if(act.type==='attack'){
    const mod=Math.floor((a.system.abilities[act.attack.ability].value-10)/2);
    assert.ok(i.system.description.value.includes(`+${mod+prof} к попаданию`));
    assert.equal(Number(act.damage.parts[0].bonus),mod);
    const bleed=i.flags['bagrovoe-bleeding']?.abilities?.bleed;
    if(bleed)assert.ok(i.system.description.value.includes(`Сл ${bleed.dc}`));
   }
   if(i.system.uses.max)assert.ok(act.consumption.targets.some(t=>t.type==='itemUses'&&t.value==='1'));
   if(act.activation.type==='legendary'){assert.equal(act.activation.value,1);assert.equal(a.system.resources.legact.max,2);}
  }
 }
});

test('siblings share CR 6 with native attack, resource and support activities',()=>{
 const edrik=actors.find(a=>a._id==='fbe21544072d0152'),emili=actors.find(a=>a._id==='4b8ade9c13c11420');
 for(const actor of [edrik,emili]){
  assert.equal(actor.system.details.cr,6);
  for(const item of actor.items){
   const copy=abilities.find(x=>x.system.identifier===item.system.identifier);assert.ok(copy);assert.deepEqual({...copy,_id:item._id},item);
   assert.doesNotMatch(item.system.description.value,/вручную|Ведущий|Foundry|Обрабатывается модулем/);
  }
 }
 assert.equal(edrik.system.resources.legact.max,0);assert.equal(edrik.system.attributes.hp.max,112);
 const ward=emili.items.find(i=>i.flags['bagrovoe-bleeding']?.siblingWard),activity=Object.values(ward.system.activities)[0];
 assert.equal(activity.type,'heal');assert.deepEqual(activity.healing.types,['temphp']);assert.equal(ward.flags['bagrovoe-bleeding'].itemBloodCost.allowHealthSubstitution,false);
 assert.ok(activity.consumption.targets.some(t=>t.type==='itemUses'));
});

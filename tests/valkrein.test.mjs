import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p)),MOD='bagrovoe-bleeding';
const a=read('packs-src/key-npcs.json').find(a=>a.system.identifier==='edmund-valkrein');
const [house,secret,quest]=read('packs-src/valkrein.json'),[heart]=read('packs-src/world-items.json');
const text=j=>j.pages.map(p=>p.text.content).join('\n');
test('Edmund retains requested stats, native social modifiers and defensive saves',()=>{
 assert.equal(a.name,'Эдмунд Валькрейн');assert.equal(a.system.attributes.hp.max,45);assert.equal(a.system.attributes.hp.value,45);assert.equal(a.system.attributes.ac.flat,14);assert.equal(a.system.details.cr,3);
 assert.deepEqual(Object.values(a.system.abilities).map(a=>a.value),[9,12,12,17,15,18]);
 const pb=Math.ceil(a.system.details.cr/4)+1;
 for(const [key,total] of Object.entries({per:7,dec:7,ins:5,inv:6})){
  const s=a.system.skills[key];assert.equal(Math.floor((a.system.abilities[s.ability].value-10)/2)+pb*s.value+Number(s.roll.bonus),total);
 }
 assert.equal(a.system.abilities.int.proficient,1);assert.equal(a.system.abilities.wis.proficient,1);
 const weapon=a.items.find(i=>i.type==='weapon');
 for(const x of Object.values(weapon.system.activities)){assert.equal(x.attack.flat,true);assert.equal(x.attack.bonus,'3');assert.equal(x.damage.parts[0].bonus,'1');assert.equal(x.damage.parts[0].denomination,4);assert.equal(x.consumption.spellSlot,false);}
 assert.equal(a.items.filter(i=>i.type==='spell').length,0);
});
test('public house and biography expose no GM-only deal or quest links',()=>{
 assert.equal(house.ownership.default,2);assert.equal(secret.ownership.default,0);assert.equal(quest.ownership.default,0);
 for(const j of [house,secret,quest])for(const p of j.pages)assert.equal(p.ownership.default,-1);
 assert.doesNotMatch(text(house)+a.system.details.biography.public+a.system.details.biography.value,/Родерик|15 000|5 000|информатор|похищ|нанял|Сердц|Последний Предел/);
 assert.doesNotMatch(text(house),/Ройн|не утвержд|не определ|для мастера/);
 assert.match(text(secret),/15 000/);assert.match(text(secret),/5 000/);assert.match(text(secret),/окончательной смерти Родерика/);
 assert.match(text(quest),/не мстит/);assert.match(text(quest),/не запускаются автоматически/);assert.equal(quest.pages.length,7);
});
test('Heart remains portable with no invented charges, combat effects or price',()=>{
 assert.equal(heart.system.rarities[0],'artifact');assert.deepEqual(heart.system.activities,{});assert.deepEqual(heart.effects,[]);assert.equal(heart.system.uses.max,'');assert.deepEqual(heart.system.uses.recovery,[]);
 assert.equal(heart.system.price,undefined);assert.equal(heart.system.attunement,undefined);assert.match(heart.system.description.value,/перевезти/);assert.match(heart.system.description.value,/ограничены/);
});
test('journal compendium links resolve to delivered documents',()=>{
 const manifest=read('module.json');
 for(const j of [house,secret,quest])for(const m of text(j).matchAll(/@UUID\[Compendium\.bagrovoe-bleeding\.([^.]+)\.(Actor|Item|JournalEntry)\.([A-Za-z0-9]+)\]/g)){
  assert.equal(manifest.packs.find(p=>p.name===m[1])?.type,m[2]);assert.ok(read(`packs-src/${m[1]}.json`).some(d=>d._id===m[3]));
 }
});
test('missing approved portrait is explicit and never replaced with another character',()=>{
 if(a.flags[MOD].portraitPending){assert.equal(a.img,'icons/svg/mystery-man.svg');assert.equal(a.prototypeToken.texture.src,a.img);}
 else {assert.match(a.img,/edmund-valkrein/);assert.match(a.prototypeToken.texture.src,/edmund-valkrein/);}
});

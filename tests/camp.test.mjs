import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const docs=JSON.parse(fs.readFileSync('packs-src/settlements.json')),camp=docs.find(d=>d._id==='299e031637cc6d25'),data=camp.flags['bagrovoe-bleeding'].camp;
const actors=JSON.parse(fs.readFileSync('packs-src/iron-hounds.json')),text=camp.pages.map(p=>p.text.content).join('\n');
test('camp roster uses actual actors once across its four zones',()=>{
 assert.equal(data.roster.reduce((n,z)=>n+z.count,0),18);assert.equal(data.roster.reduce((n,z)=>n+z.xp,0),7150);assert.equal(data.roster.at(-1).xp,5450);
 for(const z of data.roster){assert.equal(z.count,z.units.reduce((n,[,count])=>n+count,0));assert.equal(z.xp,z.units.reduce((n,[name,count])=>n+actors.find(a=>a.name===name).system.details.xp.value*count,0));}
 for(const name of ['Родерик Варн','Марта Грейвс','Гаррет Хольм','Сайлас Вейн'])assert.equal(data.roster.flatMap(z=>z.units).filter(([n])=>n===name).reduce((n,[,v])=>n+v,0),1);
});
test('loot separates found cash, conditional contract and village property',()=>{
 assert.equal(900+1000/10+4*50,data.personal.foundGoldEquivalent);assert.equal(data.personal.foundGoldEquivalent+data.personal.contract,data.personal.totalGoldEquivalent);
 assert.equal(data.village.materials,5+8+7);assert.equal(data.village.supplies/data.village.deliveries,20);assert.equal(data.village.gold/data.village.deliveries,75);assert.equal(data.village.supplies/Math.ceil(50/10),8);
 assert.match(text,/Без договора/);assert.match(text,/Не меняйте за доставку недельное производство/);assert.doesNotMatch(text,/70 \/ 28 \/ 190|Резерв на четыре недели/);
});
test('camp replaces existing GM journal with stable first page and valid actor links',()=>{
 assert.equal(docs.filter(d=>d.name==='Лагерь Железных Гончих').length,1);assert.equal(camp.ownership.default,0);assert.equal(camp.pages.length,9);assert.equal(camp.pages[0]._id,'b62e7bd342aa255d');
 for(const p of camp.pages){assert.equal(p.ownership.default,-1);assert.match(p._id,/^[a-zA-Z0-9]{16}$/);}
 for(const m of text.matchAll(/Compendium\.bagrovoe-bleeding\.iron-hounds\.Actor\.([A-Za-z0-9]+)/g))assert.ok(actors.some(a=>a._id===m[1]));
 assert.equal(new Set(camp.pages.map(p=>p._id)).size,9);
});
test('capturing Roderik does not open the barrier or award the Heart',()=>{
 assert.match(text,/взяли живым/);assert.match(text,/его условие — окончательная смерть Родерика/);assert.match(text,/не выдаёт Сердце Архимага как трофей лагеря/);assert.match(text,/не раскрывает связь с Валькрейном/);
});

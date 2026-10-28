import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {organizePack} from '../scripts/pack-folders.mjs';
const M='bagrovoe-bleeding',read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const all=read('packs-src/key-npcs.json'),actors=all.filter(a=>a.flags[M].raessCompany),lore=read('packs-src/key-npc-lore.json').filter(j=>j.flags[M].raessCompany);
const get=(a,k)=>a.items.find(i=>i.system.identifier===k),acts=i=>Object.values(i.system.activities),first=i=>acts(i)[0];
test('company is seven distinct NPCs plus existing Raess in a single private folder',()=>{
 assert.equal(actors.length,7);assert.equal(new Set(all.map(a=>a._id)).size,all.length);
 const organized=organizePack({name:'key-npcs',type:'Actor'},all),folder=organized.folders.find(f=>f.name==='Отряд Раэсса Валира');
 assert.equal(organized.docs.filter(a=>a.folder===folder._id).length,8);
 assert.equal(all.filter(a=>a.flags[M].raess).length,1);assert.equal(lore.length,1);
 for(const a of [...actors,...lore,...lore[0].pages])assert.equal(a.ownership.default,0);
 const bandit=read('packs-src/iron-hounds.json').find(a=>a.name==='Сайлас Вейн');assert.ok(bandit);assert.notEqual(bandit._id,actors[5]._id);
});
test('specified stats and CR-based saves/skills have no inherited bonuses',()=>{
 const expected=[[4,18,95,30,[18,12,20,11,13,14]],[3,19,85,25,[18,10,18,10,14,11]],[3,16,78,35,[16,18,14,9,12,10]],[4,15,66,30,[9,14,12,18,14,11]],[4,15,60,30,[8,16,12,14,12,18]],[3,16,68,35,[11,18,14,12,16,10]],[3,16,72,30,[10,12,14,12,18,14]]];
 actors.forEach((a,n)=>{const [cr,ac,hp,speed,scores]=expected[n];assert.equal(a.system.details.cr,cr);assert.equal(a.system.attributes.ac.flat,ac);assert.equal(a.system.attributes.hp.max,hp);assert.equal(+a.system.attributes.movement.speeds.walk,speed);assert.deepEqual(['str','dex','con','int','wis','cha'].map(k=>a.system.abilities[k].value),scores);assert.equal(a.system.resources.legact.max,0);assert.equal(a.effects.length,0);assert.equal(a.items.some(i=>i.type==='class'),false);assert.deepEqual(a.system.traits.di.value,[]);});
 const skill=(a,k)=>Math.floor((a.system.abilities[a.system.skills[k].ability].value-10)/2)+2*a.system.skills[k].value;
 assert.equal(skill(actors[3],'arc'),8);assert.equal(skill(actors[5],'prc'),7);assert.equal(skill(actors[6],'med'),8);
 assert.equal(actors.reduce((sum,a)=>sum+a.system.attributes.hp.max,0),524);
});
test('weapons have explicit +6 and one damage modifier, conditional riders are separate',()=>{
 for(const[n,k,num,die,bonus]of [[0,'greatsword',2,6,4],[1,'warhammer',1,8,4],[1,'shield-bash',1,4,4],[2,'paired-blades',1,6,4],[5,'longbow',1,8,4],[3,'arcane-impulse',3,8,'']]){
  const x=first(get(actors[n],k));assert.equal(x.attack.flat,true);assert.equal(x.attack.bonus,'6');assert.equal(x.damage.includeBase,false);assert.equal(x.damage.parts.length,1);assert.equal(x.damage.parts[0].number,num);assert.equal(x.damage.parts[0].denomination,die);assert.equal(x.damage.parts[0].bonus,String(bonus));
 }
 assert.equal(first(get(actors[2],'bloody-charge')).activation.type,'special');assert.equal(first(get(actors[5],'aimed-shot')).activation.type,'special');
 assert.equal(first(get(actors[5],'longbow')).range.long,'600');
 const bash=get(actors[1],'shield-bash');assert.equal(acts(bash).length,2);assert.equal(acts(bash)[1].save.dc.formula,'14');assert.equal(acts(bash)[1].damage.parts.length,0);
});
test('limits consume one charge, recharge needs 5 and daily features use long rest',()=>{
 const limits=[[0,'battle-order',1,true],[0,'veteran-endurance',1],[1,'unbreakable-defense',1],[2,'relentless-endurance',1],[3,'arcane-impulse',1,true],[4,'distorted-perception',1,true],[4,'reposition',2],[5,'binding-arrow',2],[6,'healing-wave',1],[6,'protective-prayer',2]];
 for(const[n,k,max,recharge]of limits){const i=get(actors[n],k),x=first(i);assert.equal(i.system.uses.max,String(max));assert.equal(i.system.uses.spent,0);assert.equal(i.system.uses.recovery[0].period,recharge?'recharge':'lr');if(recharge)assert.equal(i.system.uses.recovery[0].formula,'5');assert.deepEqual(x.consumption.targets,[{type:'itemUses',target:'',value:'1'}]);assert.equal(x.consumption.spellSlot,false);}
 assert.equal(first(get(actors[0],'intercept')).roll.formula,'1d10 + 3');assert.equal(first(get(actors[6],'protective-prayer')).roll.formula,'1d8 + 4');assert.equal(first(get(actors[2],'relentless-endurance')).activation.type,'special');
});
test('effects do not grant extra damage or permanent defense',()=>{
 const defense=get(actors[1],'unbreakable-defense');assert.equal(first(defense).healing.custom.formula,'15');assert.deepEqual(first(defense).healing.types,['temphp']);assert.deepEqual(first(defense).effects,[]);assert.equal(defense.effects[0].system.changes[0].value,-10);
 const arrow=get(actors[5],'binding-arrow');assert.deepEqual(first(arrow).damage.parts,[]);assert.ok(arrow.effects[0].system.changes.every(c=>c.value===0&&c.type==='override'));
 const distortion=get(actors[4],'distorted-perception');assert.equal(distortion.effects[0].system.changes[0].key,'system.rolls.attack.mode');assert.equal(distortion.effects[0].system.changes[0].value,-1);
 const heal=first(get(actors[6],'healing-wave'));assert.equal(heal.target.affects.count,'3');assert.equal(heal.healing.number,2);assert.equal(heal.healing.bonus,'4');
});
test('spellbooks contain all 32 spells, standard slots, no pact casting or double cantrip scaling',()=>{
 for(const[n,count,slots]of [[3,11,[4,3,3]],[4,9,[4,3,3]],[6,12,[4,3,2]]]){
  const a=actors[n],spells=a.items.filter(i=>i.type==='spell');assert.equal(spells.length,count);assert.equal(a.system.spells.pact.value,0);
  assert.deepEqual([1,2,3].map(k=>a.system.spells['spell'+k].value),slots);
  for(const s of spells){assert.equal(s.system.source.rules,'2024');assert.equal(s.system.method,s.system.level?'spell':'atwill');assert.equal(s.system.ability,a.system.attributes.spellcasting);assert.ok(acts(s).every(x=>!['cast','summon','forward'].includes(x.type)));if(!s.system.level)assert.ok(acts(s).every(x=>!x.consumption.spellSlot));else assert.ok(acts(s).some(x=>x.consumption.spellSlot));}
  for(const k of ['fire-bolt','ray-of-frost','sacred-flame']){const s=get(a,k);if(s){const d=first(s).damage.parts[0];assert.equal(d.number,2);assert.equal(d.scaling.mode,'');}}
  const ability=a.system.abilities[a.system.attributes.spellcasting].value;assert.equal(8+2+Math.floor((ability-10)/2),14);
 }
});
test('2024 spell corrections separate repeat rays, burning web, guidance choices and concentration',()=>{
 const e=actors[3],v=actors[4],m=actors[6];
 for(const k of ['magic-missile','scorching-ray']){const xs=acts(get(e,k));assert.equal(xs.filter(x=>x.consumption.spellSlot).length,1);assert.equal(xs.length,2);assert.equal(xs[1].activation.type,'special');}
 const web=acts(get(v,'web'));assert.equal(web.find(x=>x.type==='save').damage.parts.length,0);assert.equal(web.find(x=>x.type==='save').consumption.spellSlot,false);assert.equal(web.find(x=>x.type==='damage').consumption.spellSlot,false);assert.equal(web.filter(x=>x.consumption.spellSlot).length,1);
 const guidance=get(m,'guidance');assert.equal(acts(guidance).length,18);assert.ok(acts(guidance).every(x=>x.effects.length===1));assert.equal(new Set(guidance.effects.map(e=>e.name)).size,18);
 assert.equal(get(e,'mage-armor').effects.length,0);
 for(const[k,n]of [['healing-word',2],['cure-wounds',2],['mass-healing-word',2]])assert.equal(first(get(m,k)).healing.number,n);
 assert.ok(get(m,'spiritual-weapon').system.properties.includes('concentration'));assert.ok(get(m,'bless').system.properties.includes('concentration'));
 assert.deepEqual(first(get(e,'counterspell')).save.ability,['con']);
 assert.equal(acts(get(v,'slow')).filter(x=>x.consumption.spellSlot).length,1);
 for(const a of [e,v,m])for(const s of a.items.filter(i=>i.type==='spell'&&i.system.level))for(const x of acts(s))if(!x.consumption.spellSlot){assert.equal(x.duration.override,true);assert.equal(x.duration.concentration,false);}
});
test('assets, exports, private lore and embedded references are self-contained',()=>{
 for(const a of actors){assert.deepEqual(read('exports/'+a.system.identifier+'.json'),a);assert.equal(a.prototypeToken.actorLink,true);for(const url of [a.img,a.prototypeToken.texture.src]){assert.ok(url.startsWith(`modules/${M}/assets/raess-company/`));assert.ok(fs.existsSync(new URL('../'+url.slice(`modules/${M}/`.length),import.meta.url)));}
  assert.doesNotMatch(a.system.details.biography.public,/личем|Леорин|награда|тайна договора/);
  const ids=a.items.map(i=>i._id);assert.equal(ids.length,new Set(ids).size);
  for(const i of a.items){for(const x of acts(i)){assert.equal(x._id,Object.keys(i.system.activities).find(k=>i.system.activities[k]===x));for(const e of x.effects??[])assert.ok(i.effects.some(f=>f._id===e._id));}assert.doesNotMatch(JSON.stringify(i),/Compendium\.(?:dnd5e|AG|homebrew)|@classes|@scale|flags\.midi/);}
 }
 assert.match(JSON.stringify(lore),/10 000/);assert.match(JSON.stringify(lore),/стать личем/);assert.equal(lore[0].pages.some(p=>p.name==='Сложность столкновения'),true);
});

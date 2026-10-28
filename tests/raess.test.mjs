import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const MOD='bagrovoe-bleeding',read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url))),actors=read('packs-src/key-npcs.json'),a=actors.find(a=>a.flags[MOD].raess);
const item=k=>a.items.find(i=>i.system.identifier===k),acts=i=>Object.values(i.system.activities);
function harness(){
 const actor=structuredClone(a);actor.id=actor._id;actor.uuid='Actor.'+actor.id;
 actor.items.forEach(i=>{i.id=i._id;i.actor=actor;});
 const hooks=new Map(),game={user:{isGM:true},combat:{id:'fight1',started:true,combatants:[{actor}]}};
 const context=vm.createContext({game,Hooks:{on:(k,f)=>hooks.set(k,f)}});
 vm.runInContext(fs.readFileSync(new URL('../scripts/raess.mjs',import.meta.url),'utf8').replaceAll('export ',''),context);
 return{actor,game,hooks,context};
}
test('Raess remains a living human NPC with CR-based PB, expertise and no eye penalty',()=>{
 assert.equal(a.name,'Раэсс Валир');assert.equal(a.type,'npc');assert.equal(a.flags[MOD].classLevel,11);assert.equal(a.system.details.cr,8);assert.equal(a.system.details.type.value,'humanoid');
 assert.equal(a.system.attributes.hp.max,20*4.5+20);assert.equal(a.system.attributes.ac.flat,15);
 const pb=3,mod=k=>Math.floor((a.system.abilities[k].value-10)/2);
 assert.equal(8+pb+mod('cha'),16);assert.equal(a.system.skills.itm.value*pb+mod('cha'),11);
 for(const[k,n]of Object.entries({con:4,wis:5,cha:8}))assert.equal(mod(k)+a.system.abilities[k].proficient*pb,n);
 assert.ok(a.items.every(i=>i.type!=='class'));assert.equal(a.effects.length,0);assert.deepEqual(a.system.traits.ci.value,[]);
 assert.equal(a.system.resources.legres.max,0);assert.equal(a.system.resources.legact.max,0);
});
test('2024 pact slots, arcanum and prepared spell counts exclude subclass and invocation grants',()=>{
 assert.deepEqual(a.system.spells.pact,{value:3,override:3});assert.equal(a.system.attributes.spell.level,11);
 for(let i=1;i<=9;i++)assert.equal(a.system.spells['spell'+i].override,0);
 const spells=a.items.filter(i=>i.type==='spell');assert.equal(spells.length,31);
 for(const[list,n]of Object.entries({cantrip:4,prepared:11,subclass:11,feature:5}))assert.equal(spells.filter(i=>i.flags[MOD].spellList===list).length,n);
 assert.equal(a.items.filter(i=>i.system.type?.subtype==='eldritchInvocation').length,7);
 assert.ok(!item('greater-invisibility'));assert.ok(!item('modify-memory'));assert.ok(!item('absolute-tyranny'));
 for(const k of ['mass-suggestion','contact-other-plane']){const s=item(k);assert.equal(s.system.uses.max,'1');assert.equal(s.system.uses.recovery[0].period,'lr');for(const x of acts(s)){assert.equal(x.consumption.spellSlot,false);assert.equal(x.consumption.targets[0].type,'itemUses');}}
 for(const s of spells.filter(i=>['prepared','subclass'].includes(i.flags[MOD].spellList)))assert.equal(s.system.method,'pact');
});
test('ray and dagger damage do not double-add ability or proficiency; smites use d6',()=>{
 const eb=item('eldritch-blast'),x=acts(eb)[0];assert.equal(x.attack.bonus,'8');assert.equal(x.attack.flat,true);assert.equal(x.damage.includeBase,false);assert.equal(x.damage.parts[0].number,1);assert.equal(x.damage.parts[0].denomination,10);assert.equal(x.damage.parts[0].bonus,'@abilities.cha.mod');assert.equal(x.damage.parts[0].scaling.mode,'');assert.equal(eb.flags[MOD].damageInvocation,item('agonizing-blast')._id);assert.match(eb.system.description.value,/три луча/);
 const dagger=acts(item('dagger'))[0];assert.equal(dagger.attack.bonus,'6');assert.equal(dagger.damage.parts[0].bonus,'3');
 for(const k of ['wrathful-smite','staggering-smite'])assert.equal(acts(item(k)).find(x=>x.type==='damage').damage.parts[0].denomination,6);
 assert.deepEqual(acts(item('counterspell'))[0].save.ability,['con']);
});
test('bonus command spends only herald charge, while pact command still spends a slot',()=>{
 const commands=acts(item('command')),free=commands.find(x=>x.activation.type==='bonus');assert.ok(free);assert.equal(free.consumption.spellSlot,false);assert.equal(free.target.affects.count,'1');assert.deepEqual(free.consumption.targets,[{type:'itemUses',target:item('tyrants-herald')._id,value:'1'}]);assert.equal(item('tyrants-herald').system.uses.max,'5');assert.ok(commands.some(x=>x.consumption.spellSlot));
 for(const s of a.items.filter(i=>i.flags[MOD].spellList==='subclass'))assert.ok(!s.system.properties.includes('vocal'));
});
test('teleport distances survive conversion and continuing damage never spends another slot',()=>{
 for(const[k,v]of [['misty-step','30'],['dimension-door','500']]){const t=acts(item(k)).find(x=>x.type==='teleport');assert.equal(t.teleport.value,v);assert.equal(t.teleport.override,true);}
 assert.equal(acts(item('dimension-door')).find(x=>x.type==='damage').consumption.spellSlot,false);
 assert.equal(acts(item('armor-of-agathys')).find(x=>x.type==='damage').consumption.spellSlot,false);
 assert.equal(acts(item('armor-of-agathys')).find(x=>x.type==='heal').healing.scaling.formula,'5');
});
test('cunning transaction caps slots, restores edict, and respects disabled consumption',()=>{
 for(const spent of [0,1]){const h=harness(),c=h.actor.items.find(i=>i.system.identifier==='magical-cunning'),e=h.actor.items.find(i=>i.system.identifier==='decisive-edict');e.system.uses.spent=spent;const updates={actor:{'system.spells.pact.value':5},item:[{_id:c.id,'system.uses.spent':1}]};h.context.raessConsumption({actor:h.actor,item:c},{},{},updates);assert.equal(updates.actor['system.spells.pact.value'],3);assert.equal(updates.item.find(i=>i._id===e.id)['system.uses.spent'],0);}
 const h=harness(),c=h.actor.items.find(i=>i.system.identifier==='magical-cunning'),u={actor:{},item:[]};h.context.raessConsumption({actor:h.actor,item:c},{consume:false},{},u);assert.deepEqual(u,{actor:{},item:[]});
});
test('bloodied bonus is atomic, once per combat, preserves higher temp HP, ignores healing and noncombat actors',()=>{
 const h=harness(),patch={'system.attributes.hp.value':55};h.actor.system.attributes.hp.temp=25;h.context.raessBloodied(h.actor,patch);assert.equal(patch['system.attributes.hp.temp'],25);assert.equal(patch[`flags.${MOD}.raessBloodiedCombat`],'fight1');
 h.actor.flags[MOD].raessBloodiedCombat='fight1';const again={'system.attributes.hp.value':30};h.context.raessBloodied(h.actor,again);assert.equal(again['system.attributes.hp.temp'],undefined);
 h.game.combat.id='fight2';h.actor.system.attributes.hp.temp=0;const nested={system:{attributes:{hp:{value:40}}}};h.context.raessBloodied(h.actor,nested);assert.equal(nested.system.attributes.hp.temp,10);
 h.actor.system.attributes.hp.value=40;const heal={'system.attributes.hp.value':50};h.context.raessBloodied(h.actor,heal);assert.equal(heal['system.attributes.hp.temp'],undefined);
 h.actor.system.attributes.hp.value=110;h.game.combat.combatants=[];const absent={'system.attributes.hp.value':20};h.context.raessBloodied(h.actor,absent);assert.equal(absent['system.attributes.hp.temp'],undefined);
 h.game.combat.combatants=[{actor:h.actor}];h.game.user.isGM=false;h.context.raessBloodied(h.actor,absent);assert.equal(absent['system.attributes.hp.temp'],undefined);
});
test('immunity to charm blocks the entire submit effect, including speed override',()=>{
 const h=harness(),e={flags:{[MOD]:{raessSubmit:true}},parent:{system:{traits:{ci:{value:new Set(['charmed'])}}}}};assert.equal(h.context.raessSubmitImmunity(e),false);e.parent.system.traits.ci.value=[];assert.notEqual(h.context.raessSubmitImmunity(e),false);
 const s=item('raess-submit');assert.equal(s.system.uses.recovery[0].formula,'5');assert.equal(s.effects[0].system.changes.length,5);assert.equal(s.effects[0].duration.expiry,'targetEnd');
});
test('all references are portable and secrets are isolated in private journals',()=>{
 assert.deepEqual(a,read('exports/raess-valir.json'));assert.doesNotMatch(JSON.stringify(a),/ag-icons|ag-fifthpendium|@classes\.|@scale\.|@items\.|midi-qol/);
 for(const i of a.items){for(const x of acts(i)){for(const t of x.consumption.targets)if(t.type==='itemUses'&&t.target)assert.ok(a.items.some(i=>i._id===t.target));if(x.save)assert.ok(Array.isArray(x.save.ability));for(const e of x.effects??[])assert.ok(i.effects.some(f=>f._id===e._id));}}
 assert.doesNotMatch(JSON.stringify(a.system.details.biography),/личем|бессмерт|наказала|перехват|награда|Леорина/);
 const journals=read('packs-src/key-npc-lore.json').filter(j=>j.flags[MOD].raess);assert.equal(journals.length,2);for(const j of journals){assert.equal(j.ownership.default,0);assert.ok(j.pages.every(p=>p.ownership.default===0));}assert.match(JSON.stringify(journals),/стать личем/);
 assert.equal(a.ownership.default,0);assert.equal(a.prototypeToken.actorLink,true);
 if(a.flags[MOD].artPending){assert.equal(a.img,'icons/svg/mystery-man.svg');assert.equal(a.prototypeToken.texture.src,a.img);}
});
test('runtime hook and NPC pact assumptions match pinned dnd5e source',()=>{
 const root=process.env.DND5E_SOURCE??path.resolve(new URL('../../dnd5e',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
 if(!fs.existsSync(root))return;
 const source=p=>fs.readFileSync(path.join(root,p),'utf8');
 assert.match(source('module/documents/activity/mixin.mjs'),/Hooks.call\("dnd5e.activityConsumption", this, usageConfig, messageConfig, updates\)/);
 assert.match(source('module/data/spellcasting/spellcasting-model.mjs'),/actor.system.attributes.spell\?\.level/);
 assert.match(source('module/data/actor/npc.mjs'),/Math.max\(this.details.cr, this.details.level, 1\)/);
});

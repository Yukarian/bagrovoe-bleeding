import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const M='bagrovoe-bleeding',ACT='7e762b185ff74f2a',template=JSON.parse(fs.readFileSync(new URL('../exports/stone-fury-belt.json',import.meta.url)));
function harness(){
 const hooks=new Map(),warnings=[],context=vm.createContext({structuredClone,console,game:{time:{worldTime:100},user:{isGM:true}},ui:{notifications:{warn:m=>warnings.push(m),error:m=>warnings.push(m)}},Hooks:{on:(k,f)=>hooks.set(k,f),once:(k,f)=>hooks.set(k,f)}});vm.runInContext(fs.readFileSync(new URL('../scripts/stone-belt.mjs',import.meta.url),'utf8').replaceAll('export ',''),context);
 const belt={...structuredClone(template),id:'belt',uuid:'Actor.a.Item.belt',areEffectsSuppressed:false};belt.system.equipped=true;belt.system.attuned=true;
 const actor={uuid:'Actor.a',isOwner:true,items:[belt,{type:'class',name:'Варвар',system:{identifier:'barbarian'}}],statuses:new Set(['raging']),effects:[],created:0,async createEmbeddedDocuments(type,rows){this.created++;this.effects.push(...structuredClone(rows));return rows;}};belt.actor=actor;
 const activity={id:ACT,type:'utility',item:belt,actor};
 const damage=(mode='melee')=>({subject:{type:'attack',actor,item:{type:'weapon',system:{type:{baseItem:'longsword'}}},attack:{type:{value:'melee',classification:'weapon'}},getActionType:()=>mode==='melee'?'mwak':'rwak'},attackMode:mode,rolls:[{parts:['1d8','4'],data:{},options:{type:'slashing'}}]});
 return{c:context,belt,actor,activity,damage,warnings,hooks};
}
test('belt has one long-rest charge, self activation, native Athletics and portable image',()=>{
 assert.equal(template.system.uses.max,'1');assert.deepEqual(template.system.uses.recovery,[{period:'lr',type:'recoverAll'}]);const x=template.system.activities[ACT];assert.equal(x.consumption.spellSlot,false);assert.equal(x.target.affects.type,'self');assert.equal(x.consumption.targets[0].value,'1');assert.deepEqual(x.effects,[]);assert.equal(template.effects[0].system.changes[0].key,'system.skills.ath.bonuses.check');assert.equal(template.effects[0].system.changes[0].value,1);assert.equal(template.effects[0].transfer,true);assert.equal(template.img,'icons/equipment/waist/belt-thick-gemmed-steel-grey.webp');
});
test('activation requires equipped/attuned barbarian and real rage, not the belt effect itself',()=>{
 const h=harness();assert.notEqual(h.c.validateStoneUse(h.activity),false);h.belt.system.attuned=false;assert.equal(h.c.validateStoneUse(h.activity),false);h.belt.system.attuned=true;h.belt.system.equipped=false;assert.equal(h.c.validateStoneUse(h.activity),false);h.belt.system.equipped=true;h.actor.items.pop();assert.equal(h.c.validateStoneUse(h.activity),false);h.actor.items.push({type:'class',system:{identifier:'barbarian'}});h.actor.statuses.clear();h.actor.effects=[{name:'Каменная ярость',flags:{[M]:{stoneRage:true}}}];assert.equal(h.c.validateStoneUse(h.activity),false);h.actor.effects=[{name:'Ярость [Rage]',duration:{},flags:{}}];assert.notEqual(h.c.validateStoneUse(h.activity),false);
});
test('successful activation creates one timed effect even for duplicate callbacks',async()=>{
 const h=harness(),result={message:{id:'message'}};await Promise.all([h.c.activateStone(h.activity,{},result),h.c.activateStone(h.activity,{},result)]);assert.equal(h.actor.created,1);assert.equal(h.actor.effects[0].flags[M].expires,160);assert.equal(h.c.validateStoneUse(h.activity),false);await h.c.activateStone(h.activity,{},result);assert.equal(h.actor.created,1);
});
test('cancelled use and unrelated custom activities cannot activate the bonus',async()=>{
 const h=harness();await h.c.activateStone(h.activity,{},{});await h.c.activateStone({...h.activity,id:'custom'},{},{message:{id:'m'}});assert.equal(h.actor.created,0);
});
test('damage adds one separate bludgeoning die, excludes ranged, spells and unarmed attacks',async()=>{
 const h=harness();await h.c.activateStone(h.activity,{},{message:{id:'m'}});const config=h.damage();h.c.stoneDamage(config);h.c.stoneDamage(config);assert.equal(config.rolls.length,2);assert.equal(config.rolls[1].parts[0],'1d4');assert.equal(config.rolls[1].options.type,'bludgeoning');assert.equal(config.rolls[0].parts.join('+'),'1d8+4');
 const ranged=h.damage('thrown');h.c.stoneDamage(ranged);assert.equal(ranged.rolls.length,1);const spell=h.damage();spell.subject.item.type='spell';h.c.stoneDamage(spell);assert.equal(spell.rolls.length,1);const fist=h.damage();fist.subject.item.system.type.baseItem='unarmedstrike';h.c.stoneDamage(fist);assert.equal(fist.rolls.length,1);
});
test('expired, disabled or removed belt never supplies damage',async()=>{
 for(const change of [h=>h.c.game.time.worldTime=160,h=>h.actor.effects[0].disabled=true,h=>h.belt.system.equipped=false,h=>h.belt.system.attuned=false,h=>h.actor.items=[]]){const h=harness();await h.c.activateStone(h.activity,{},{message:{id:'m'}});change(h);const d=h.damage();h.c.stoneDamage(d);assert.equal(d.rolls.length,1);}
});
test('legacy repair preserves spent charge, equipment, custom features and original backup',async()=>{
 const h=harness(),belt=h.belt;belt.flags={};belt.system.identifier='7090427b794a4330';belt.system.uses.spent=1;const old=structuredClone({...belt,actor:undefined});let updates=0;
 belt.effects=[{toObject:()=>({_id:'custom',name:'Custom'})},{toObject:()=>({_id:'57281ba3a01d43e2',name:'Пояс каменной ярости: Атлетика +1'})}];belt.toObject=()=>old;belt.update=async patch=>{updates++;assert.equal(patch['system.uses.spent'],undefined);assert.equal(patch['system.equipped'],undefined);assert.equal(patch.effects.length,2);assert.equal(patch.effects[0]._id,'custom');belt.flags[M]={stoneBelt:true,stoneBeltBackup:patch[`flags.${M}.stoneBeltBackup`]};};belt.setFlag=async(m,k,v)=>belt.flags[m][k]=v;
 assert.equal(await h.c.repairStoneBelt(belt,template),true);assert.equal(belt.system.uses.spent,1);assert.equal(belt.flags[M].stoneBeltBackup.system.identifier,'7090427b794a4330');assert.equal(await h.c.repairStoneBelt(belt,template),false);assert.equal(updates,1);
});

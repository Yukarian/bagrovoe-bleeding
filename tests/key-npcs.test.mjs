import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const MOD='bagrovoe-bleeding',actors=JSON.parse(fs.readFileSync(new URL('../packs-src/key-npcs.json',import.meta.url))),[la,na]=actors;
const get=(a,k)=>a.items.find(i=>i.system.identifier===k),activities=i=>Object.values(i.system.activities);
const flags=o=>Object.assign(o,{getFlag(m,k){return this.flags?.[m]?.[k];},async setFlag(m,k,v){this.flags??={};(this.flags[m]??={})[k]=v;}});
const put=(o,k,v)=>{const p=k.split('.'),end=p.pop();for(const s of p)o=o[s]??={};o[end]=v;};
const coll=a=>Object.assign(a,{get(id){return this.find(v=>v.id===id);}});
function harness(){
 const notices=[],updates=[],documents=new Map(),hooks=new Map(),gm={id:'gm',isGM:true},scene={id:'s',tokens:coll([]),async updateEmbeddedDocuments(type,rows){updates.push({type,rows});for(const row of rows){const t=this.tokens.get(row._id);for(const [k,v] of Object.entries(row))put(t,k,v);}}};
 const game={user:gm,users:{activeGM:gm},scenes:coll([scene]),modules:new Map([[MOD,{api:{}}]])};
 const context=vm.createContext({console,game,structuredClone,Hooks:{on(k,f){hooks.set(k,f);},once(k,f){hooks.set(k,f);}},ui:{notifications:{warn:s=>notices.push(s),error:s=>notices.push(s)}},fromUuid:async id=>documents.get(id),fromUuidSync:id=>documents.get(id),ChatMessage:{getSpeaker:()=>({scene:'s',token:'caster'})},BagrovoeNewSpells:{distance:(a,b)=>a.parent===b.parent?Math.abs(a.x-b.x):Infinity}});
 vm.runInContext(fs.readFileSync(new URL('../scripts/key-npcs.mjs',import.meta.url),'utf8').replaceAll('export ',''),context);
 function actor(source=na){const a=flags(structuredClone(source));a.id=a._id;a.uuid='Actor.'+a.id;a.isOwner=true;a.isToken=false;a.statuses=new Set();a.update=async data=>{updates.push({actor:a.id,data});for(const [k,v]of Object.entries(data))put(a,k,v);};return a;}
 function token(a,id='caster',linked=true,x=0){const t={id,uuid:`Scene.s.Token.${id}`,actor:a,actorId:a.id,actorLink:linked,parent:scene,x,width:1,height:1,texture:{src:'old'}};scene.tokens.push(t);documents.set(t.uuid,t);return t;}
 function activity(a,key,index=0){const item=flags(structuredClone(get(a,key)));item.actor=a;const x=flags(activities(item)[index]);x.actor=a;x.item=item;return x;}
 function chat(a,x,target){return flags({id:'c',type:'usage',author:gm,flags:{},system:{targets:target?[{token:target.uuid}]:[]},getAssociatedActivity:()=>x});}
 return {context,game,scene,notices,updates,documents,hooks,actor,token,activity,chat};
}

test('key NPCs have independent identities, complete native spellbooks and no external module references',()=>{
 assert.equal(actors.length,21);assert.notEqual(la._id,na._id);
 assert.equal(la.items.filter(i=>i.type==='spell').length,30);assert.equal(na.items.filter(i=>i.type==='spell').length,6);
 assert.doesNotMatch(JSON.stringify(actors),/ag-fifthpendium|ag-icons|cachedFor|dnd5espellchange|@classes\.|@scale\./);
 for(const a of actors){assert.equal(new Set(a.items.map(i=>i._id)).size,a.items.length);assert.equal(a.ownership.default,0);assert.equal(a.prototypeToken.actorLink,true);for(const i of a.items){assert.match(i._id,/^[a-zA-Z0-9]{16}$/);for(const [k,x]of Object.entries(i.system.activities)){assert.equal(k,x._id);assert.notEqual(x.type,'cast');for(const e of x.effects??[])assert.ok(i.effects.some(v=>v._id===e._id),'Missing effect '+i.name);}}}
});
test('Laerin is a level-20 caster, DC 21, with correct full slots and a separate healing pool',()=>{
 assert.equal(la.system.attributes.spell.level,20);assert.equal(la.system.details.cr,20);
 assert.equal(8+6+(la.system.abilities.wis.value-10)/2,21);
 assert.deepEqual(Array.from({length:9},(_,n)=>la.system.spells['spell'+(n+1)].override),[4,3,3,3,3,2,2,1,1]);
 assert.equal(la.system.attributes.hp.max,24*(4.5+6));
 const balm=get(la,'summer-balm');assert.equal(balm.system.uses.max,'20');assert.equal(activities(balm).length,10);
 for(const [n,x]of activities(balm).entries()){assert.equal(x.healing.number,n+1);assert.equal(x.healing.denomination,6);assert.equal(x.consumption.targets[0].value,String(n+1));assert.equal(x.consumption.targets[0].type,'itemUses');assert.equal(x.flags[MOD].balmDice,n+1);}
});
test('native spell secondary actions do not charge another slot; cantrips cost no slots',()=>{
 for(const s of la.items.filter(i=>i.type==='spell'&&i.system.level===0))for(const x of activities(s))assert.equal(x.consumption.spellSlot,false);
 assert.ok(activities(get(la,'entangle')).some(x=>x.type==='check'&&!x.consumption.spellSlot));
 const shape=activities(get(la,'shapechange'));assert.equal(shape.find(x=>x.type==='transform').consumption.spellSlot,false);assert.equal(shape.find(x=>x.type==='utility').consumption.spellSlot,true);
 assert.equal(activities(get(la,'produce-flame'))[0].damage.parts[0].number,4);
 for(const key of ['dream','scrying','teleportation-circle'])for(const x of activities(get(la,key))){assert.equal(x.consumption.spellSlot,false);assert.equal(x.consumption.targets[0].target,get(la,'dream-walker')._id);}
});
test('wild shape retains archdruid spellcasting and uses beast HP rather than 2024 class-level placeholders',()=>{
 const x=activities(get(la,'laerin-wild-shape'))[0];assert.equal(x.type,'transform');assert.equal(x.profiles[0].cr,'1');assert.equal(x.transform.customize,true);assert.ok(x.settings.keep.includes('spells'));assert.ok(!x.settings.keep.includes('hp'));assert.deepEqual(x.consumption.targets,[]);assert.equal(x.duration.value,'10');
});
test('Nazir preserves dragon stats, breath arithmetic and native legendary recovery; guise is independent of resources',()=>{
 assert.equal(na.system.details.cr,16);assert.equal(na.system.attributes.hp.max,212);assert.equal(na.system.attributes.ac.flat,19);assert.equal(na.system.abilities.str.value,25);
 assert.deepEqual(na.system.traits.di.value,['lightning']);assert.equal(na.system.resources.legact.max,3);
 const breath=get(na,'lightning-breath'),b=activities(breath)[0];assert.equal(b.damage.parts[0].number,11);assert.equal(b.damage.parts[0].denomination,10);assert.equal(b.target.template.size,'90');assert.equal(breath.system.uses.recovery[0].formula,'5');assert.equal(b.save.dc.calculation,'con');
 for(const key of ['sonic-boom','cloaked-flight']){const x=activities(get(na,key))[0];assert.equal(x.activation.type,'legendary');assert.equal(x.activation.value,1);assert.equal(x.uses.max,'1');assert.equal(x.uses.recovery[0].period,'turnStart');}
 assert.equal(activities(get(na,'tail-swipe'))[0].type,'attack');
 for(const s of na.items.filter(i=>i.type==='spell')){assert.equal(s.system.method,'innate');for(const x of activities(s))assert.equal(x.consumption.spellSlot,false);assert.equal(s.system.uses.max,['scrying','sending'].includes(s.system.identifier)?'1':'');}
});
test('every shipped portrait, token and distinct spell icon exists',()=>{
 for(const a of actors){for(const url of [a.img,a.prototypeToken.texture.src,...a.items.map(i=>i.img),...Object.values(a.flags[MOD].forms??{}).flatMap(f=>[f.img,f.token])]){if((a.flags[MOD].towerCouncil||a.flags[MOD].groveCouncil||a.flags[MOD].leorina||a.flags[MOD].valkrein||a.flags[MOD].archmage||a.flags[MOD].midnight||a.flags[MOD].raess||a.flags[MOD].ragnaret)&&(url.startsWith('icons/')||url.startsWith('systems/dnd5e/')))continue;assert.ok(url.startsWith(`modules/${MOD}/`));assert.ok(fs.existsSync(new URL('../'+url.slice(`modules/${MOD}/`.length),import.meta.url)),url);}}
 for(const a of [la,na]){const s=a.items.filter(i=>i.type==='spell');assert.equal(new Set(s.map(i=>i.img)).size,s.length);}
});
test('changing form twice preserves wounds, slots, spent resistance, effects and initiative',async()=>{
 const h=harness(),a=h.actor();a.system.attributes.hp.value=81;a.system.resources.legres.spent=2;a.effects=[{_id:'poison'}];const before=structuredClone(a.system),effects=structuredClone(a.effects);h.token(a);
 await h.context.setForm(a,'dragon');assert.equal(a.system.traits.size,'huge');assert.equal(h.scene.tokens[0].width,3);assert.match(h.scene.tokens[0].texture.src,/nazir-khan-dragon/);
 await h.context.setForm(a,'human');assert.equal(a.system.traits.size,'med');assert.equal(a.system.attributes.movement.speeds.fly,'0');assert.equal(h.scene.tokens[0].width,1);
 assert.deepEqual(a.system.attributes.hp,before.attributes.hp);assert.deepEqual(a.system.resources,before.resources);assert.deepEqual(a.system.spells,before.spells);assert.deepEqual(a.system.attributes.init,before.attributes.init);assert.deepEqual(a.effects,effects);
});
test('world guise updates linked tokens but not independent copies',async()=>{
 const h=harness(),a=h.actor(),linked=h.token(a),copy=h.token(a,'copy',false);await h.context.setForm(a,'dragon');assert.equal(linked.width,3);assert.equal(copy.width,1);
});
test('synthetic actor guise updates only its own token',async()=>{
 const h=harness(),a=h.actor(),own=h.token(a),other=h.token(a,'other');a.isToken=true;a.token=own;await h.context.setForm(a,'dragon');assert.equal(own.width,3);assert.equal(other.width,1);
});
test('players cannot switch NPC guise or invoke GM-only healing automation',async()=>{
 const h=harness(),a=h.actor();h.game.user={id:'p',isGM:false};await assert.rejects(h.context.setForm(a,'dragon'));assert.equal(h.updates.length,0);
 const la=h.actor(actors[0]),x=h.activity(la,'summer-balm');assert.equal(h.context.validateKeyUse(x,{},{}),false);
});
test('dragon-only abilities are blocked before resource consumption in human guise',()=>{
 const h=harness(),a=h.actor(),x=h.activity(a,'lightning-breath');assert.equal(h.context.validateKeyUse(x,{},{}),false);a.flags[MOD].guise='dragon';assert.notEqual(h.context.validateKeyUse(x,{},{}),false);
});
test('balm checks range, target count and remaining pool before native consumption',()=>{
 const h=harness(),a=h.actor(la),x=h.activity(a,'summer-balm',4);h.token(a);const target=h.token(h.actor(),'target',true,100),m={data:{system:{targets:[{token:target.uuid}]}}};
 assert.notEqual(h.context.validateKeyUse(x,{},m),false);target.x=121;assert.equal(h.context.validateKeyUse(x,{},m),false);target.x=100;x.item.system.uses.spent=17;assert.equal(h.context.validateKeyUse(x,{},m),false);x.item.system.uses.spent=0;m.data.system.targets=[];assert.equal(h.context.validateKeyUse(x,{},m),false);
});
test('balm grants temporary HP once, never stacks or reduces an existing larger pool',async()=>{
 const h=harness(),a=h.actor(la),target=h.actor(),t=h.token(target,'target'),x=h.activity(a,'summer-balm',4),chat=h.chat(a,x,t);
 await Promise.all([h.context.processKeyUse(chat),h.context.processKeyUse(chat)]);assert.equal(target.system.attributes.hp.temp,5);target.system.attributes.hp.temp=1;await h.context.processKeyUse(chat);assert.equal(target.system.attributes.hp.temp,1);
 target.system.attributes.hp.temp=12;await h.context.processKeyUse(h.chat(a,x,t));assert.equal(target.system.attributes.hp.temp,12);
});
test('only active GM handles real usage messages and player chat cannot grant temporary HP',async()=>{
 const h=harness(),a=h.actor(la),target=h.actor(),t=h.token(target,'target'),x=h.activity(a,'summer-balm'),c=h.chat(a,x,t);
 c.author={isGM:false};await h.context.processKeyUse(c);assert.equal(h.updates.length,0);c.author=h.game.user;c.type='damage';await h.context.processKeyUse(c);assert.equal(h.updates.length,0);c.type='usage';h.game.users.activeGM={id:'other'};await h.context.processKeyUse(c);assert.equal(h.updates.length,0);
});
test('interrupted balm receipt prevents a retry from replenishing temporary HP',async()=>{
 const h=harness(),a=h.actor(la),target=h.actor(),t=h.token(target,'target'),x=h.activity(a,'summer-balm'),c=h.chat(a,x,t);c.flags[MOD]={keyNpcStarted:true};await h.context.processKeyUse(c);assert.equal(h.updates.length,0);
});

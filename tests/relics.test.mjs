import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const MOD='bagrovoe-bleeding';
const data=JSON.parse(fs.readFileSync(new URL('../packs-src/relics.json',import.meta.url)));
const get=(o,k)=>k.split('.').reduce((o,k)=>o?.[k],o);
function put(o,k,v){const p=k.split('.'),last=p.pop();for(const k of p)o=o[k]??={};o[last]=v;}
function doc(d){return Object.assign({flags:{},getFlag(m,k){return get(this.flags[m],k);},async setFlag(m,k,v){put(this,`flags.${m}.${k}`,v);},async update(d){for(const [k,v] of Object.entries(d))put(this,k,v);}},d);}
function setup(key){
 const hooks=new Map(),documents=new Map(),output=[],bleeds=[],stopped=[];
 const klass=doc({id:'class',name:'Fighter',type:'class',system:{levels:5,hd:{denomination:'d10',spent:0}}});
 const item=doc(structuredClone(data.find(i=>i.flags[MOD].relicKey===key)));item.id=item._id;item.uuid='Actor.owner.Item.'+item.id;item.system.attuned=true;item.system.equipped=true;
 const actor=doc({uuid:'Actor.owner',id:'owner',name:'Owner',type:'character',effects:[],statuses:new Set(),system:{attributes:{prof:3,hp:{value:10,max:30,temp:2},spellcasting:'wis'},abilities:{con:{mod:2},wis:{mod:3},int:{mod:1},cha:{mod:4}}},testUserPermission:()=>true,
 async applyDamage(d){if(typeof d==='number'){const t=Math.min(this.system.attributes.hp.temp,d);this.system.attributes.hp.temp-=t;this.system.attributes.hp.value=Math.max(0,this.system.attributes.hp.value-(d-t));}else for(const v of d){this.system.attributes.hp.value=Math.min(30,this.system.attributes.hp.value+(v.type==='healing'?v.value:-v.value));}},
 async createEmbeddedDocuments(t,ds){for(const d of ds)this.effects.push(doc({id:'effect',...d}));},async deleteEmbeddedDocuments(t,ids){this.effects=this.effects.filter(e=>!ids.includes(e.id));},async toggleStatusEffect(s){this.statuses.add(s);},async endConcentration(){this.ended=true;}});
 actor.items=[klass,item];actor.items.get=id=>actor.items.find(i=>i.id===id);item.actor=actor;
 actor.token={uuid:'Scene.s.Token.owner',actor};actor.getActiveTokens=()=>[actor.token];
 const targetActor=doc({uuid:'Actor.target',name:'Target',system:{attributes:{hp:{value:10,max:30,temp:0}}},async applyDamage(d){for(const v of d)this.system.attributes.hp.value+=v.type==='healing'?v.value:-v.value;},async rollSavingThrow(){return [{total:10}];}});
 const target={uuid:'Scene.s.Token.target',name:'Target',actor:targetActor};documents.set(target.uuid,target);
 const req=doc({id:'request',type:'usage',author:{id:'player'},system:{targets:[{token:target.uuid}]},getAssociatedActivity:()=>({item})});
 const game={user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},modules:new Map([[MOD,{api:{get:()=>({disabled:false}),stop:async t=>stopped.push(t),apply:async(t,v)=>bleeds.push({t,v})}}]]),messages:{contents:[]}};
 const ctx=vm.createContext({console,game,Roll:class{constructor(formula){this.formula=formula;}async evaluate(){return {total:this.formula==='1d4'?2:4};}},
  foundry:{utils:{escapeHTML:String},applications:{api:{DialogV2:{wait:async()=>null}}}},FormData,
  fromUuid:async u=>documents.get(u),ChatMessage:{getSpeaker:()=>({}),create:async d=>output.push(d)},
  ui:{notifications:{warn:()=>{},error:()=>{}}},Hooks:{on(n,f){const a=hooks.get(n)??[];a.push(f);hooks.set(n,a);},once(n,f){const a=hooks.get(n)??[];a.push(f);hooks.set(n,a);}},
  BagrovoeSpellRuntime:{expiry:()=>({worldTime:106}),expireControls:async()=>{},resolveAttack:async()=>{}}});
 vm.runInContext(fs.readFileSync(new URL('../scripts/relics.js',import.meta.url),'utf8'),ctx);
 for(const f of hooks.get('ready'))f();
 const api=game.modules.get(MOD).api.relics;
 function source(type,spell=true){const s=doc({id:'source',type,system:{evaluatedTargets:[{token:target.uuid,isMiss:false}]},rolls:[{total:18,toJSON:()=>({class:'D20Roll',total:18,formula:'1d20 + 3',terms:[{class:'Die',number:1,faces:20,results:[{result:15,active:true}],options:{}},{class:'OperatorTerm',operator:'+',options:{}},{class:'NumericTerm',number:3,options:{}}]})}],getAssociatedActor:()=>targetActor,getAssociatedActivity:()=>({item:{type:spell?'spell':'weapon',actor},save:{dc:{value:17}}})});game.messages.contents.push(s);return s;}
 return {api,item,actor,klass,target,req,game,ctx,source,output,bleeds,stopped,hooks};
}
test('seven native items have unique IDs/icons, rarity, attunement, no native double consumption',()=>{
 assert.equal(data.length,7);assert.equal(new Set(data.map(d=>d._id)).size,7);assert.equal(new Set(data.map(d=>d.img)).size,7);
 for(const d of data){assert.match(d._id,/^[A-Za-z0-9]{16}$/);assert.equal(d.system.rarities.length,1);assert.equal(Object.values(d.system.activities)[0].consumption.targets.length,0);assert.ok(fs.existsSync(new URL('../'+d.img.replace('modules/bagrovoe-bleeding/',''),import.meta.url)));}
});
test('thread spends class Hit Die, stops bleeding without healing and consumes one item',async()=>{
 const h=setup('last-stitch');await h.api.execute(h.item,h.actor,h.target,{pool:'class'},h.req);
 assert.equal(h.klass.system.hd.spent,1);assert.equal(h.item.system.quantity,0);assert.equal(h.stopped.length,1);assert.equal(h.actor.system.attributes.hp.value,10);
});
test('bracelet reduces final damage before temporary HP, costs one die/use',async()=>{
 const h=setup('scarlet-bracelet');await h.api.execute(h.item,h.actor,null,{damage:'10'},h.req);
 assert.equal(h.klass.system.hd.spent,1);assert.equal(h.item.system.uses.spent,1);assert.equal(h.actor.system.attributes.hp.value,9);assert.equal(h.actor.system.attributes.hp.temp,0);
});
test('lens marks selected token without a Hit Die cost',async()=>{
 const h=setup('crimson-lens');await h.api.execute(h.item,h.actor,h.target,{},h.req);
 assert.equal(h.klass.system.hd.spent,0);assert.equal(h.actor.effects[0].getFlag(MOD,'relicMark'),h.target.uuid);
});
test('beads heal ally first and then inflict bleeding on owner',async()=>{
 const h=setup('shared-pain');h.source('healing');await h.api.execute(h.item,h.actor,h.target,{source:'source',ability:'wis'},h.req);
 assert.equal(h.target.actor.system.attributes.hp.value,17);assert.equal(h.bleeds[0].t.actor,h.actor);assert.equal(h.bleeds[0].v.levels,1);
});
test('ring validates attack and applies one bleed level on failed save',async()=>{
 const h=setup('open-wound');h.source('attack',false);await h.api.execute(h.item,h.actor,h.target,{source:'source'},h.req);
 assert.equal(h.bleeds[0].v.dc,13);assert.equal(h.bleeds[0].v.levels,1);assert.equal(h.klass.system.hd.spent,1);
});
test('bookmark reduces existing save without rerolling and bypasses temporary HP',async()=>{
 const h=setup('living-ink'),source=h.source('save');await h.api.execute(h.item,h.actor,h.target,{source:'source'},h.req);
 assert.equal(source.rolls[0].total,16);assert.equal(source.rolls[0].terms[0].results[0].result,15);assert.equal(h.actor.system.attributes.hp.value,6);assert.equal(h.actor.system.attributes.hp.temp,2);
});
test('heart replaces lethal damage with 1 HP and rolled temporary HP then two bleed levels',async()=>{
 const h=setup('second-heart');await h.api.execute(h.item,h.actor,null,{damage:15},h.req);
 assert.equal(h.actor.system.attributes.hp.value,1);assert.equal(h.actor.system.attributes.hp.temp,8);assert.equal(h.klass.system.hd.spent,2);assert.equal(h.bleeds[0].v.levels,2);
});
test('heart rejects instant death and nonlethal damage before payment',async()=>{
 for(const damage of [5,42]){const h=setup('second-heart');await assert.rejects(h.api.execute(h.item,h.actor,null,{damage},h.req));assert.equal(h.klass.system.hd.spent,0);assert.equal(h.item.system.uses.spent,0);}
});
test('insufficient dice never substitute HP or spend item charges',async()=>{
 const h=setup('second-heart');h.klass.system.hd.spent=4;await assert.rejects(h.api.execute(h.item,h.actor,null,{damage:15},h.req),/Недостаточно/);assert.equal(h.actor.system.attributes.hp.value,10);assert.equal(h.item.system.uses.spent,0);
});
test('unattuned item rejected before payment',async()=>{
 const h=setup('scarlet-bracelet');h.item.system.attuned=false;await assert.rejects(h.api.execute(h.item,h.actor,null,{damage:10},h.req),/настройтесь/);assert.equal(h.klass.system.hd.spent,0);
});
test('cancelled player request never spends resources',async()=>{
 const h=setup('last-stitch');await h.api.processRequest(h.req);assert.equal(h.req.getFlag(MOD,'relicResolution').status,'cancelled');assert.equal(h.klass.system.hd.spent,0);assert.equal(h.item.system.quantity,1);
});
test('duplicate request executes only once',async()=>{
 const h=setup('last-stitch');await h.api.execute(h.item,h.actor,h.target,{},h.req);await assert.rejects(h.api.execute(h.item,h.actor,h.target,{},h.req),/обработан/);assert.equal(h.klass.system.hd.spent,1);
});
test('player cannot request a relic belonging to an unowned actor',async()=>{
 const h=setup('last-stitch');h.actor.testUserPermission=()=>false;await h.api.processRequest(h.req);assert.equal(h.req.getFlag(MOD,'relicResolution'),undefined);assert.equal(h.klass.system.hd.spent,0);
});
test('multiclass player may choose a larger die, insufficient chosen pool fails',()=>{
 const h=setup('second-heart');const c=doc({id:'barbarian',type:'class',system:{levels:1,hd:{denomination:'d12',spent:0}}});h.actor.items.push(c);
 assert.equal(h.api.planDice(h.actor,1,'barbarian')[0].size,12);assert.throws(()=>h.api.planDice(h.actor,2,'barbarian'),/Недостаточно/);
});
test('lens adds damage once per turn and ignores misses',async()=>{
 const h=setup('crimson-lens');await h.api.execute(h.item,h.actor,h.target,{},h.req);
 h.game.combat={id:'combat',started:true,round:1,turn:0};
 const attack=h.source('attack',false);attack.system.evaluatedTargets[0].isMiss=true;
 await h.api.lensHit(attack);assert.equal(h.target.actor.system.attributes.hp.value,10);
 attack.system.evaluatedTargets[0].isMiss=false;await h.api.lensHit(attack);await h.api.lensHit(attack);
 assert.equal(h.target.actor.system.attributes.hp.value,8);
 const second=h.source('attack',false);second.id='second';await h.api.lensHit(second);assert.equal(h.target.actor.system.attributes.hp.value,8);
});
test('successful ring save consumes cost without inflicting bleeding',async()=>{
 const h=setup('open-wound');h.source('attack',false);h.target.actor.rollSavingThrow=async()=>[{total:20}];
 await h.api.execute(h.item,h.actor,h.target,{source:'source'},h.req);assert.equal(h.bleeds.length,0);assert.equal(h.klass.system.hd.spent,1);
});
test('all permanent relics recover uses only on long rest and depleted item is blocked',async()=>{
 for(const i of data.filter(i=>i.type==='equipment'))assert.deepEqual(i.system.uses.recovery,[{period:'lr',type:'recoverAll'}]);
 const h=setup('scarlet-bracelet');h.item.system.uses.spent=3;await assert.rejects(h.api.execute(h.item,h.actor,null,{damage:10},h.req),/Применения/);assert.equal(h.klass.system.hd.spent,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const MOD='bagrovoe-bleeding';
const items=JSON.parse(fs.readFileSync(new URL('../packs-src/player-subclasses.json',import.meta.url)));
const source=fs.readFileSync(new URL('../scripts/peace-domain.mjs',import.meta.url),'utf8').replaceAll('export ','');
const get=(o,k)=>k.split('.').reduce((o,k)=>o?.[k],o);
function set(o,k,v){const parts=k.split('.'),last=parts.pop();for(const p of parts)o=o[p]??={};o[last]=v;}
function doc(d){return Object.assign({flags:{},getFlag(m,k){return get(this.flags[m],k);},async setFlag(m,k,v){set(this,`flags.${m}.${k}`,v);},async unsetFlag(m,k){delete this.flags[m]?.[k];},async update(d){for(const[k,v]of Object.entries(d))set(this,k,v);},toObject(){return JSON.parse(JSON.stringify(this));}},d);}
function harness(level=6){
 const registry=new Map(),hooks=new Map(),messages=[],output=[],answers=[];let sequence=0;
 const gm={id:'gm',isGM:true},player={id:'player',isGM:false};
 const game={user:gm,users:{activeGM:gm},time:{worldTime:100},actors:[],scenes:[],packs:new Map(),combat:null,messages:{contents:messages,get:id=>messages.find(m=>m.id===id)}};
 const scene={id:'scene',tokens:[],grid:{distance:5,units:'ft'}},canvas={ready:true,scene,grid:{size:100},dimensions:{sceneRect:{x:0,y:0,width:5000,height:5000}},stage:{on(_n,cb){queueMicrotask(()=>cb({getLocalPosition:()=>({x:200,y:0})}));},off(){}}};
 canvas.grid.distance=5;
 const makeItem=(data,a)=>{const i=doc(structuredClone(data));i.id=i._id??'item'+(++sequence);i.uuid=a.uuid+'.Item.'+i.id;i.actor=a;a.items.push(i);registry.set(i.uuid,i);return i;};
 const actor=(id,x)=>{const a=doc({id,uuid:'Actor.'+id,name:id,items:[],effects:[],statuses:new Set(),system:{attributes:{prof:3,hp:{value:30,max:50,temp:0}},abilities:{wis:{mod:3}}},testUserPermission:u=>u?.id==='player',async createEmbeddedDocuments(type,ds){if(type==='Item')return ds.map(d=>makeItem(d,this));const es=ds.map(d=>doc({id:'e'+(++sequence),...d}));this.effects.push(...es);return es;},async deleteEmbeddedDocuments(type,ids){this[type==='Item'?'items':'effects']=this[type==='Item'?'items':'effects'].filter(d=>!ids.includes(d.id));if(type==='Item')this.items.get=id=>this.items.find(i=>i.id===id);},calculateDamage(parts,options){const ds=parts.map(d=>({...d,active:{}}));ds.amount=ds.reduce((n,d)=>n+d.value,0);ctx.expansiveResistance(this,ds,options);return ds;},async applyDamage(parts,options={}){if(parts[0]?.type==='healing'){this.system.attributes.hp.value=Math.min(50,this.system.attributes.hp.value+parts[0].value);return;}const ds=this.calculateDamage(parts,options);this.system.attributes.hp.value=Math.max(0,this.system.attributes.hp.value-ds.amount);this.lastDamage=ds.amount;}});
 a.items.get=id=>a.items.find(i=>i.id===id);const t=doc({id,uuid:'Scene.scene.Token.'+id,name:id,actor:a,parent:scene,x,y:0,width:1,height:1,elevation:0,getSnappedPosition:p=>p});a.token=t;game.actors.push(a);scene.tokens.push(t);registry.set(a.uuid,a);registry.set(t.uuid,t);return a;};
 let ctx;
 ctx=vm.createContext({console,game,canvas,CONFIG:{DND5E:{damageTypes:{slashing:{},fire:{},necrotic:{}}}},queueMicrotask,setTimeout:()=>0,clearTimeout(){},document:{addEventListener(){},removeEventListener(){}},fromUuid:async id=>registry.get(id),Roll:class{constructor(f){this.f=f;}async evaluate(){const n=this.f==='1d4'?3:7;return {total:n,toJSON:()=>({class:'Roll',formula:this.f,total:n,terms:[{class:'Die',faces:this.f==='1d4'?4:6,number:this.f==='1d4'?1:2,results:[{result:n,active:true}],options:{}}]})};}},foundry:{utils:{escapeHTML:String,randomID:()=>String(++sequence).padStart(16,'0')},applications:{api:{DialogV2:{wait:async()=>answers.shift()??null}}}},ChatMessage:{getSpeaker:()=>({}),create:async d=>output.push(d)},ui:{notifications:{error(){},warn(){},info(){}}},Hooks:{on(n,f){hooks.set(n,[...(hooks.get(n)??[]),f]);}}});
 vm.runInContext(source,ctx);
 const cleric=actor('cleric',0),ally=actor('ally',100),other=actor('other',300);
 makeItem({_id:'class',type:'class',system:{identifier:'cleric',levels:level}},cleric);
 for(const i of items.filter(i=>i.flags[MOD].peaceFeature!=='controls'))makeItem(i,cleric);
 const channel=makeItem({_id:'channel',type:'feat',system:{identifier:'channel-divinity-cleric',uses:{spent:0,max:2}}},cleric);
 const controls=items.find(i=>i.flags[MOD].peaceFeature==='controls');game.packs.set(MOD+'.player-subclasses',{getIndex:async()=>[{_id:controls._id,name:controls.name}],getDocument:async()=>({toObject:()=>structuredClone(controls)})});
 const item=(key,a=cleric)=>a.items.find(i=>i.flags[MOD]?.peaceFeature===key);
 const request=(key,action,ts=[ally.token],a=cleric)=>doc({id:'request'+(++sequence),type:'usage',author:player,system:{targets:ts.map(t=>({token:t.uuid}))},getAssociatedActivity:()=>({item:item(key,a),flags:{[MOD]:{peaceAction:action}}})});
 const bond=async()=>{const req=request('bond','bond',[cleric.token,ally.token,other.token]);await ctx.processPeace(req);return req;};
 const roll=(a=ally)=>{const data={class:'D20Roll',formula:'1d20 + 2',total:12,terms:[{class:'Die',faces:20,number:1,results:[{result:10,active:true}],options:{}},{class:'OperatorTerm',operator:'+',options:{}},{class:'NumericTerm',number:2,options:{}}],options:{}};const m=doc({id:'roll'+(++sequence),type:'attack',rolls:[{total:12,toJSON:()=>structuredClone(data)}],getAssociatedActor:()=>a});m.flags[MOD]={peaceRollTurn:ctx.turnStamp(game.combat)};messages.push(m);return m;};
 return {ctx,game,cleric,ally,other,answers,item,request,bond,roll,channel,output,hooks,registry,scene};
}
test('subclass grants correct feature levels, skill choice and no spells or duplicated potent spellcasting',()=>{
 const s=items.find(i=>i.type==='subclass');assert.equal(s.system.classIdentifier,'cleric');assert.equal(s.system.source.rules,'2024');assert.equal(items.length,8);assert.ok(items.every(i=>i.type!=='spell'));
 assert.deepEqual(s.system.advancement.filter(a=>a.type==='ItemGrant').map(a=>a.level),[3,6,17]);
 for(const a of s.system.advancement.filter(a=>a.type==='ItemGrant'))for(const i of a.configuration.items)assert.ok(items.some(d=>i.uuid.endsWith('.'+d._id)));
 assert.deepEqual(s.system.advancement.find(a=>a.type==='Trait').configuration.choices,[{count:1,pool:['skills:ins','skills:prf','skills:per']}]);
 assert.ok(!items.some(i=>/могущественное колдовство/i.test(i.name)));
 const b=items.find(i=>i.flags[MOD].peaceFeature==='bond');assert.equal(b.system.uses.max,'@prof');assert.equal(b.system.uses.recovery[0].period,'lr');
 assert.ok(items.filter(i=>i.flags[MOD].peaceFeature!=='balm').flatMap(i=>Object.values(i.system.activities??{})).every(a=>a.consumption.targets.length===0));
});
test('bond consumes one use, creates controls/effects and recast removes old group only',async()=>{
 const h=harness();await h.bond();assert.equal(h.item('bond').system.uses.spent,1);assert.ok(h.item('controls',h.ally));const first=h.cleric.getFlag(MOD,'peaceBond').id;await h.bond();assert.notEqual(h.cleric.getFlag(MOD,'peaceBond').id,first);assert.equal(h.ally.items.filter(i=>i.flags[MOD]?.peaceFeature==='controls').length,1);assert.equal(h.ally.effects.length,1);
});
test('bond rejects range beyond 30 feet, too many targets, missing class and unauthorized author without charges',async()=>{
 for(const mode of ['range','class','author']){const h=harness(mode==='class'?2:6);if(mode==='range')h.ally.token.x=700;const r=h.request('bond','bond');if(mode==='author')r.author={id:'outsider'};if(mode==='author')await h.ctx.processPeace(r);else await assert.rejects(h.ctx.processPeace(r));assert.equal(h.item('bond').system.uses.spent,0);}
 const h=harness();await h.ctx.processPeace(h.request('bond','bond'));assert.equal(h.item('bond').system.uses.spent,1);assert.equal(h.answers.length,0);
});
test('60-foot range unlocks only at 17, initial casting range remains 30',async()=>{
 const h=harness(17);h.ally.token.x=700;h.answers.push({confirmed:'on'});await assert.rejects(h.ctx.processPeace(h.request('bond','bond')));assert.equal(h.ctx.bondRange(16),30);assert.equal(h.ctx.bondRange(17),60);assert.equal(h.ctx.usableBond({expires:100},100),false);
});
test('bonus preserves original d20, adds die and blocks duplicate requests and turn use',async()=>{
 const h=harness();await h.bond();h.game.combat={id:'combat',started:true,round:1,turn:0,turns:[{actor:h.ally}]};const r=h.roll();h.answers.push({confirmed:'on',roll:r.id+':0'});const req=h.request('controls','bonus',[],h.ally);await h.ctx.processPeace(req);assert.equal(r.rolls[0].total,15);assert.equal(r.rolls[0].terms[0].results[0].result,10);await h.ctx.processPeace(req);assert.equal(r.rolls[0].total,15);
 const second=h.roll();h.answers.push({confirmed:'on',roll:second.id+':0'});await assert.rejects(h.ctx.processPeace(h.request('controls','bonus',[],h.ally)),/уже/);assert.equal(second.rolls[0].total,12);
 h.game.combat.turn=1;const third=h.roll();h.answers.push({confirmed:'on',roll:third.id+':0'});await h.ctx.processPeace(h.request('controls','bonus',[],h.ally));assert.equal(third.rolls[0].total,15);
});
test('bonus rejects expired bond, distant participants and prior-turn roll',async()=>{
 for(const mode of ['expired','far','old']){const h=harness();await h.bond();h.game.combat={id:'c',started:true,round:1,turn:0,turns:[]};const r=h.roll();if(mode==='expired')h.game.time.worldTime=701;if(mode==='far')h.ally.token.x=2000;if(mode==='old')h.game.combat.turn=1;h.answers.push({confirmed:'on',roll:r.id+':0'});await assert.rejects(h.ctx.processPeace(h.request('controls','bonus',[],h.ally)));assert.equal(r.rolls[0].total,12);}
});
test('protective bond teleports and damages only interceptor, recording reaction',async()=>{
 const h=harness(17);await h.bond();h.game.combat={id:'c',started:true,round:1,turn:0,turns:[{actor:h.cleric},{actor:h.ally}]};h.answers.push({confirmed:'on',damage:'fire: 13'},{confirmed:'on'});const r=h.request('controls','protect',[h.ally.token],h.cleric);await h.ctx.processPeace(r);assert.equal(h.cleric.token.x,200);assert.equal(h.cleric.system.attributes.hp.value,24);assert.equal(h.ally.system.attributes.hp.value,30);assert.ok(h.cleric.getFlag(MOD,'peaceReaction'));await h.ctx.processPeace(r);assert.equal(h.cleric.system.attributes.hp.value,24);
});
test('protective bond rejects missing level, reaction lock and occupied destination before damage',async()=>{
 for(const mode of ['level','reaction','occupied']){const h=harness(mode==='level'?3:6);await h.bond();h.game.combat={id:'c',started:true,round:2,turn:0,turns:[{actor:h.cleric}]};if(mode==='reaction')await h.cleric.setFlag(MOD,'peaceReaction','c:2');if(mode==='occupied')h.other.token.x=200;h.answers.push({confirmed:'on',damage:'fire: 12'},{confirmed:'on'});await assert.rejects(h.ctx.processPeace(h.request('controls','protect',[h.ally.token],h.cleric)));assert.equal(h.cleric.system.attributes.hp.value,30);assert.equal(h.cleric.token.x,0);}
});
test('expansive resistance respects existing resistance, immunity and vulnerability rounding',()=>{
 const h=harness(),ds=[{value:13,active:{}},{value:6,active:{type:{resistance:true}}},{value:0,active:{type:{immunity:true}}},{value:26,active:{type:{vulnerability:true}}}];h.ctx.expansiveResistance(h.cleric,ds,{ortesPeaceResistance:true});assert.deepEqual(ds.map(d=>d.value),[6,6,0,12]);assert.equal(ds.amount,24);
 const unchanged=[{value:13,active:{}}];h.ctx.expansiveResistance(h.cleric,unchanged,{});assert.equal(unchanged[0].value,13);
});
test('damage parser rejects invalid types, negative amounts and supports mixed packets',()=>{
 const h=harness();assert.equal(h.ctx.parseDamage('fire: 10; slashing: 8',['fire','slashing']).length,2);for(const input of ['healing: 5','fire: -2','fire: 0','fire: 99999999999999999','x'])assert.throws(()=>h.ctx.parseDamage(input,['fire']));
});
test('expiry cleans only matching temporary features and leaves unrelated items',async()=>{
 const h=harness();await h.bond();h.ally.items.push(doc({id:'keep',flags:{},type:'feat'}));h.game.time.worldTime=700;await h.ctx.cleanup();assert.equal(h.item('controls',h.ally),undefined);assert.ok(h.ally.items.find(i=>i.id==='keep'));assert.equal(h.cleric.getFlag(MOD,'peaceBond'),undefined);assert.equal(h.ally.effects.length,0);
});
test('roll ownership and active GM checks prevent forged cross-actor bonus',async()=>{
 const h=harness();await h.bond();const roll=h.roll(h.other);h.answers.push({confirmed:'on',roll:roll.id+':0'});await assert.rejects(h.ctx.processPeace(h.request('controls','bonus',[],h.ally)));assert.equal(roll.rolls[0].total,12);
 const r=h.request('balm','balm');h.game.user={id:'player'};await h.ctx.processPeace(r);assert.equal(h.channel.system.uses.spent,0);
});

test('player rolls a visible d4 and GM applies that same result without another dialog or roll',async()=>{
 const h=harness();await h.bond();const original=h.roll();h.game.user={id:'player'};
 await h.ctx.playerBonus(h.item('controls',h.ally),original);
 const data=h.output.at(-1);assert.equal(data.rolls[0].formula,'1d4');assert.equal(data.flags[MOD].peaceRequest.playerDie,true);
 const die=data.rolls[0];const req=doc({...data,id:'playerDie',author:{id:'player'},rolls:[{...die,toJSON:()=>die}]});
 h.game.user={id:'gm',isGM:true};await h.ctx.processPeace(req);
 assert.equal(original.rolls[0].total,15);assert.equal(original.rolls[0].terms[0].results[0].result,10);
 assert.equal(req.getFlag(MOD,'peaceResolved').status,'done');
 await h.ctx.processPeace(req);assert.equal(original.rolls[0].total,15);
});
test('protective feature has its own activity and explicit player requests carry targets',async()=>{
 const h=harness();assert.ok(Object.values(h.item('protective').system.activities).some(a=>a.flags[MOD].peaceAction==='protect'));
 await h.bond();h.answers.push({confirmed:'on',damage:'fire: 12'},{confirmed:'on'});
 const req=doc({id:'protectPayload',author:{id:'player'},flags:{[MOD]:{peaceRequest:{kind:'protect',item:h.item('controls').uuid,targets:[h.ally.token.uuid]}}}});
 await h.ctx.processPeace(req);assert.equal(h.cleric.token.x,200);assert.equal(h.cleric.lastDamage,12);assert.equal(h.ally.system.attributes.hp.value,30);
});
test('existing actor items migrate descriptions and protective activity without spending resources',async()=>{
 const h=harness();const templates=items.map(i=>({getFlag:(_m,k)=>i.flags[MOD][k],toObject:()=>structuredClone(i)}));
 h.game.packs.get(MOD+'.player-subclasses').getDocuments=async()=>templates;
 h.item('protective').system.activities={};h.item('bond').system.description.value='Old instructions';h.item('bond').system.uses.spent=2;
 await h.ctx.migratePeace();assert.ok(Object.values(h.item('protective').system.activities).length);assert.equal(h.item('bond').system.uses.spent,2);
 assert.ok(!h.item('bond').system.description.value.includes('Old instructions'));assert.equal(h.item('bond').getFlag(MOD,'peaceRevision'),4);
});
test('ability descriptions contain rules instead of module instructions',()=>{
 for(const item of items.filter(i=>i.type==='feat'))assert.doesNotMatch(item.system.description.value,/скрипт|токен|карточк|вручную|перетаскивайте|ведущий подтверждает/i);
});

test('native d20 config gets an optional d4 in the SAME roll, no post-roll request',async()=>{
 const h=harness();await h.bond();const config={subject:h.ally,hookNames:['attack','d20Test'],rolls:[]};
 h.ctx.setupPeaceRoll(config,{});assert.equal(config.ortesPeaceControl,h.item('controls',h.ally).uuid);
 const roll={parts:['1d20','2'],options:{}};h.ctx.buildPeaceRoll({config},roll,{get:()=>true},0);assert.equal(roll.parts.join(' + '),'1d20 + 2 + 1d4');assert.ok(roll.options.ortesPeaceDie);
 const no={parts:['1d20'],options:{}};h.ctx.buildPeaceRoll({config},no,{get:()=>false},0);assert.equal(no.parts.length,1);
 const other={parts:['1d20'],options:{}};h.ctx.buildPeaceRoll({config},other,{get:()=>true},1);assert.equal(other.parts.length,1);
});

test('Balm uses native healing and native shared resource consumption without intercepting activity',async()=>{
 const h=harness();const item=h.item('balm'),activity={...structuredClone(Object.values(item.system.activities)[0]),item,consumption:{targets:[{type:'itemUses',value:'1',target:'feat:channel-divinity-cleric'}]}};
 assert.equal(activity.type,'heal');assert.equal(activity.healing.number,2);assert.equal(activity.healing.denomination,6);assert.equal(activity.flags[MOD].peaceAction,undefined);
 h.channel.system.identifier='translated';h.channel.name='Божественный канал';
 for(const hook of h.hooks.get('dnd5e.preUseActivity'))assert.notEqual(hook(activity),false);
 assert.equal(activity.consumption.targets[0].target,h.channel.id);assert.equal(activity.consumption.targets[0].value,'1');assert.equal(h.output.length,0);assert.equal(h.channel.system.uses.spent,0);
 await h.ctx.processPeace(h.request('balm','balm'));assert.equal(h.output.length,0);assert.equal(h.channel.system.uses.spent,0);
});
test('d4 click unlocks button and explains missing nearby participant instead of silently returning',async()=>{
 const h=harness();await h.bond();h.ally.token.x=2000;const errors=[];h.ctx.ui.notifications.error=m=>errors.push(m);const button={disabled:false};
 await h.ctx.bonusClick(button,h.item('controls',h.ally),h.roll());assert.equal(button.disabled,false);assert.match(errors[0],/другой участник/);
});
test('native roll form renders usable checkbox without putting documents in cloned config',async()=>{
 const h=harness();await h.bond();h.ctx.document.createElement=()=>({});const children=[];
 const app={config:{ortesPeaceControl:h.item('controls',h.ally).uuid},form:{querySelector:()=>children[0],prepend:e=>children.push(e)}};
 await h.ctx.renderPeaceRoll(app);assert.equal(children.length,1);assert.match(children[0].innerHTML,/ortesPeaceDie/);assert.doesNotMatch(children[0].innerHTML,/disabled/);
 assert.deepEqual(Object.keys(app.config),['ortesPeaceControl']);const roll={parts:['1d20'],options:{}};
 h.ctx.buildPeaceRoll(app,roll,{get:()=>true},0);assert.equal(roll.parts[1],'1d4');
 h.ally.token.x=2000;const far={parts:['1d20'],options:{}};h.ctx.buildPeaceRoll(app,far,{get:()=>true},0);assert.equal(far.parts.length,1);
});

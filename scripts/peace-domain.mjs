const MOD='bagrovoe-bleeding',PACK=MOD+'.player-subclasses';
const flag=(d,k)=>d?.getFlag?.(MOD,k),feature=i=>flag(i,'peaceFeature');
const esc=s=>foundry.utils.escapeHTML(String(s??''));
const gm=()=>game.user?.isGM&&game.users.activeGM?.id===game.user.id;
const owns=(a,u)=>u?.isGM||a?.testUserPermission?.(u,'OWNER');
const now=()=>Number(game.time.worldTime);
export const clericLevel=a=>Number(a.items.find(i=>i.type==='class'&&i.system.identifier==='cleric')?.system.levels??0);
const has=(a,k)=>a.items.some(i=>feature(i)===k);
const token=a=>{const t=a.token?.document??a.token;if(t?.parent?.id===canvas.scene?.id)return t;return a.getActiveTokens?.(true,true)?.find(t=>t.parent?.id===canvas.scene?.id)??null;};
export function turnStamp(c){return c?.started?`${c.id}:${c.round}:${c.turn}`:null;}
export function reactionStamp(c,a){const index=c?.turns?.findIndex(t=>t.actor?.uuid===a.uuid)??-1;return c?.started?`${c.id}:${c.round-(c.turn<index?1:0)}`:null;}
export function bondRange(level){return level>=17?60:30;}
export function usableBond(group,time){return Boolean(group&&Number.isFinite(group.expires)&&time<group.expires);}
export function augmentRoll(original,bonus){
 const a=original.toJSON(),b=bonus.toJSON();
 if(!Number.isFinite(a.total)||!Number.isFinite(b.total))throw Error('Бросок не завершён.');
 return {...a,total:a.total+b.total,formula:`${a.formula} + ${b.formula}`,terms:[...a.terms,{class:'OperatorTerm',operator:'+',options:{}},...b.terms]};
}
// Uses the system's existing resistance flags; never halves resistance twice.
export function expansiveResistance(_actor,damages,options){
 if(options.ortesPeaceResistance!==true)return;
 for(const d of damages){
  if(!(d.value>0)||Object.values(d.active??{}).some(v=>v?.resistance||v?.immunity))continue;
  const vulnerable=Object.values(d.active??{}).some(v=>v?.vulnerability);
  d.value=Math.trunc(d.value/(vulnerable?2:1)/2)*(vulnerable?2:1);
 }
 damages.amount=Math.trunc(damages.reduce((n,d)=>n+d.value,0));
 const threshold=Number(_actor.system.attributes.hp.dt??0);
 if(damages.amount>0&&damages.amount<threshold){damages.amount=0;for(const d of damages)d.value=0;}
}
let pending=Promise.resolve();
function serial(fn){const p=pending.catch(()=>{}).then(fn);pending=p;return p;}
function report(e){console.error(MOD,'peace',e);ui.notifications.error('Домен мира: '+e.message);}
function feetPerUnit(){return /^(m|meter|meters|метр|метры|м)$/i.test(canvas.scene.grid.units??'')?3.28084:1;}
function rect(t){const size=canvas.grid.size;return {x:t.x,y:t.y,w:t.width*size,h:t.height*size};}
export function edgeDistance(a,b,size,distance){
 const dx=Math.max(0,a.x-b.x-b.w,b.x-a.x-a.w),dy=Math.max(0,a.y-b.y-b.h,b.y-a.y-a.h);
 return Math.hypot(dx,dy)/size*distance;
}
function close(a,b,ft){
 if(!a?.actor||!b?.actor||a.parent?.id!==b.parent?.id||a.parent?.id!==canvas.scene?.id)return false;
 // Measure from nearest occupied square centers, respecting the scene's diagonal rule.
 const occupied=t=>{const r=rect(t),ix=Math.min(r.w,canvas.grid.size)/2,iy=Math.min(r.h,canvas.grid.size)/2;return {x:r.x+ix,y:r.y+iy,w:r.w-2*ix,h:r.h-2*iy};};
 const ar=occupied(a),br=occupied(b),clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 const p={x:clamp(br.x,ar.x,ar.x+ar.w),y:clamp(br.y,ar.y,ar.y+ar.h)};
 const q={x:clamp(p.x,br.x,br.x+br.w),y:clamp(p.y,br.y,br.y+br.h)};
 const xy=canvas.grid.measurePath?.([p,q])?.distance??edgeDistance(ar,br,canvas.grid.size,canvas.scene.grid.distance);
 const z=Math.abs(Number(a.elevation??0)-Number(b.elevation??0));
 return Math.hypot(xy,z)*feetPerUnit()<=ft+0.01;
}
function awake(a){if(['incapacitated','unconscious','dead','stunned','paralyzed','petrified'].some(s=>a.statuses?.has(s)))throw Error('Существо не может совершить это действие или реакцию.');}
async function form(title,content){return foundry.applications.api.DialogV2.wait({window:{title},content,buttons:[{action:'apply',label:'Подтвердить',callback:(_e,b)=>{if(!b.form.reportValidity())throw Error('Заполните обязательные поля.');return Object.fromEntries(new FormData(b.form));}},{action:'cancel',label:'Отмена',default:true,callback:()=>null}],rejectClose:false});}
const confirmField=text=>`<label><input type="checkbox" name="confirmed" required>${text}</label>`;
function requireConfirmed(data){if(data?.confirmed!=='on')throw Error('Условие применения не подтверждено.');}
const say=async(actor,text)=>ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content:'<p>'+text+'</p>'});
async function spend(item,max){const spent=Number(item.system.uses.spent??0);if(!Number.isFinite(max)||spent>=max)throw Error('Использования закончились.');await item.update({'system.uses.spent':spent+1});}
async function begin(req){if(flag(req,'peaceResolved'))throw Error('Этот запрос уже обработан.');await req.setFlag(MOD,'peaceResolved',{status:'applying'});}
async function done(req){await req.setFlag(MOD,'peaceResolved',{status:'done'});}
async function cancel(req){await req.setFlag(MOD,'peaceResolved',{status:'cancelled'});}
async function clearBond(source){
 const old=flag(source,'peaceBond');if(!old)return;
 await source.unsetFlag(MOD,'peaceBond');
 for(const member of old.members){const t=await fromUuid(member.token);const a=t?.actor??await fromUuid(member.actor);if(!a)continue;
  for(const [collection,type] of [[a.items,'Item'],[a.effects,'ActiveEffect']]){const ids=collection.filter(d=>flag(d,'peaceMember')?.id===old.id).map(d=>d.id);if(ids.length)await a.deleteEmbeddedDocuments(type,ids);}
 }
}
async function groupFor(item){
 const ref=flag(item,'peaceMember'),source=ref&&await fromUuid(ref.source),group=flag(source,'peaceBond');
 if(!source||!usableBond(group,now())||group.id!==ref.id||!has(source,'bond'))throw Error('Связь закончилась.');
 const member=group.members.find(m=>m.actor===item.actor.uuid&&m.token===ref.token);if(!member)throw Error('Существо не участвует в этой связи.');
 const self=await fromUuid(member.token);if(!self?.actor||self.actor.uuid!==item.actor.uuid)throw Error('Токен участника недоступен.');
 const others=(await Promise.all(group.members.filter(m=>m.token!==self.uuid).map(m=>fromUuid(m.token)))).filter(Boolean);
 const nearby=others.filter(t=>close(self,t,bondRange(clericLevel(source))));
 return {source,group,self,others,nearby};
}
async function targets(req){const ids=[...new Set((flag(req,'peaceRequest')?.targets??req.system?.targets??[]).map(t=>typeof t==='string'?t:t.token).filter(Boolean))];return (await Promise.all(ids.map(id=>fromUuid(id)))).filter(t=>t?.actor);}
async function controlTemplate(){
 const pack=game.packs.get(PACK),index=await pack.getIndex();const template=await pack.getDocument(index.find(d=>d.name==='Ободряющая связь — управление')?._id);
 if(!template)throw Error('Служебная особенность не найдена в компендии.');return template;
}
async function ensureMember(source,group,t,template,item){
 const ref={id:group.id,source:source.uuid,token:t.uuid};
 if(!t.actor.items.some(i=>feature(i)==='controls'&&flag(i,'peaceMember')?.id===group.id)){
  const control=template.toObject();delete control._id;control.flags[MOD].peaceMember=ref;control.system.requirements='Участник Ободряющей связи';await t.actor.createEmbeddedDocuments('Item',[control]);
 }
 if(!t.actor.effects.some(e=>flag(e,'peaceMember')?.id===group.id))await t.actor.createEmbeddedDocuments('ActiveEffect',[{name:clericLevel(source)>=6?'Ободряющая и Защитная связь':'Ободряющая связь',img:item.img,origin:item.uuid,transfer:false,disabled:false,changes:[],duration:{seconds:Math.max(0,group.expires-now()),startTime:now()},flags:{[MOD]:{peaceMember:ref}}}]);
}
export async function repairPeaceMembers(){
 if(!gm())return;
 const actors=new Map((game.actors??[]).map(a=>[a.uuid,a]));for(const t of canvas.scene?.tokens??[])if(t.actor)actors.set(t.actor.uuid,t.actor);
 let template;
 for(const source of actors.values()){
  let group=flag(source,'peaceBond');const item=source.items.find(i=>feature(i)==='bond');if(!item||!usableBond(group,now()))continue;
  const self=token(source),max=Number(source.system.attributes.prof);
  if(self&&flag(item,'peaceIncludeCaster')!==false&&!group.members.some(m=>m.actor===self.actor.uuid)&&group.members.length<max){
   const ts=await Promise.all(group.members.map(m=>fromUuid(m.token)));if(!ts.some(t=>t&&close(self,t,30)))continue;
   group={...group,members:[{token:self.uuid,actor:self.actor.uuid},...group.members]};await source.setFlag(MOD,'peaceBond',group);
  }
  template??=await controlTemplate();
  for(const m of group.members){const t=await fromUuid(m.token);if(t?.actor)await ensureMember(source,group,t,template,item);}
 }
}
for(const event of ['ready','canvasReady'])Hooks.on(event,()=>{void serial(repairPeaceMembers).catch(report);});
async function makeBond(item,req){
 const actor=item.actor,ts=await targets(req),self=token(actor),max=Number(actor.system.attributes.prof);
 if(self&&flag(item,'peaceIncludeCaster')!==false&&!ts.some(t=>t.actor.uuid===self.actor.uuid))ts.unshift(self);
 if(ts.length>max)throw Error(`Включая жреца, можно связать не больше ${max} существ. Уберите лишнюю цель; применение не потрачено.`);
 const valid=()=>{awake(actor);if(!self||!ts.length||ts.length>max||new Set(ts.map(t=>t.actor.uuid)).size!==ts.length||ts.some(t=>!close(self,t,30)))throw Error('Выберите от 1 до бонуса мастерства разных существ в пределах 30 футов на сцене.');if(Number(item.system.uses.spent??0)>=max)throw Error('Применения связи закончились.');};valid();
 const template=await controlTemplate();
 await begin(req);await spend(item,max);await clearBond(actor);
 const group={id:foundry.utils.randomID(),expires:now()+600,members:ts.map(t=>({token:t.uuid,actor:t.actor.uuid}))};
 await actor.setFlag(MOD,'peaceBond',group);
 for(const t of ts)await ensureMember(actor,group,t,template,item);
 await done(req);
 await say(actor,'<strong>Ободряющая связь:</strong> '+ts.map(t=>esc(t.name)).join(', ')+'.').catch(report);

}
function eligibleRoll(m,actor){return ['attack','check','save','initiative'].includes(m.type)&&m.getAssociatedActor?.()?.uuid===actor.uuid&&m.rolls?.some(r=>Number.isFinite(r.total));}
async function addBonus(item,req,payload={}){
 const actor=item.actor;let context=await groupFor(item);if(!context.nearby.length)throw Error('Рядом нет другого участника связи.');
 const choices=game.messages.contents.filter(m=>eligibleRoll(m,actor)).slice(-20).reverse();
 const options=choices.flatMap(m=>m.rolls.map((r,i)=>`<option value="${m.id}:${i}" ${payload.roll===m.id&&Number(payload.index)===i?'selected':''}>${esc(m.flavor||m.getAssociatedActivity?.()?.name||m.type)}: ${r.total} (${m.id}, ${i+1})</option>`)).join('');if(!options)throw Error('Нет подходящего броска в чате.');
 const data=payload.playerDie?{confirmed:'on',roll:payload.roll+':'+payload.index}:await form('Ободряющая связь: +к4',`<label>Бросок<select name="roll">${options}</select></label><p>К20 не перебрасывается. Одно применение за ход, включая чужие ходы. После изменения результата повторно проверьте попадание/спасбросок; уже применённый урон не отменяется.</p>`+confirmField('Бросок относится к текущему ходу; бонус связи ещё не применяли в этот ход.'));
 if(!data)return cancel(req);requireConfirmed(data);context=await groupFor(item);if(!context.nearby.length)throw Error('Участники разошлись.');
 const [mid,n]=data.roll.split(':'),m=game.messages.get(mid),i=Number(n);if(!m||!eligibleRoll(m,actor)||!Number.isInteger(i)||!m.rolls[i])throw Error('Бросок недоступен.');
 const turn=turnStamp(game.combat),recorded=flag(m,'peaceRollTurn');
 if(turn&&recorded!==turn)throw Error('Бросок сделан не в текущий ход.');
 if(flag(m,'peaceBonus')||turn&&flag(actor,'peaceBonusTurn')===turn)throw Error('К4 уже использован для этого броска или хода.');
 const die=payload.playerDie?req.rolls?.[0]:await new Roll('1d4').evaluate();
 if(!die||die.formula?.replace(/\s/g,'')!=='1d4'&&payload.playerDie||!(die.total>=1&&die.total<=4))throw Error('Нужен бросок 1к4.');
 const updated=augmentRoll(m.rolls[i],die);
 await begin(req);if(turn)await actor.setFlag(MOD,'peaceBonusTurn',turn);
 await m.update({rolls:m.rolls.map((r,n)=>n===i?updated:r.toJSON()),[`flags.${MOD}.peaceBonus`]:{roll:i,value:die.total,request:req.id},[`flags.${MOD}.peaceOriginalRoll`]:m.rolls[i].toJSON()});
 if(!payload.playerDie)await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),flavor:'Ободряющая связь',rolls:[die.toJSON()]});await done(req);
}
async function pickPosition(self){
 if(!canvas.ready)throw Error('Откройте сцену с участниками.');
 ui.notifications.info('Щёлкните свободное место назначения защитника. Escape — отмена.');
 return new Promise(resolve=>{
  const stage=canvas.stage;let timer;
  const finish=v=>{stage.off('pointerdown',click);document.removeEventListener('keydown',key);clearTimeout(timer);resolve(v);};
  const key=e=>{if(e.key==='Escape')finish(null);};
  const click=e=>{const p=e.getLocalPosition(stage),snapped=self.getSnappedPosition?.({x:p.x,y:p.y,elevation:self.elevation??0})??{x:p.x,y:p.y};finish({x:snapped.x,y:snapped.y,elevation:self.elevation??0});};
  stage.on('pointerdown',click);document.addEventListener('keydown',key);timer=setTimeout(()=>finish(null),60000);
 });
}
export function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function validDestination(self,target,pos){
 const virtual={...pos,width:self.width,height:self.height,actor:self.actor,parent:self.parent};
 if(!close(virtual,target,5))throw Error('Место назначения должно быть в пределах 5 футов от защищаемого существа.');
 if(canvas.scene.tokens.some(t=>t.uuid!==self.uuid&&overlaps(rect(virtual),rect(t))&&Math.abs(Number(t.elevation??0)-pos.elevation)<canvas.scene.grid.distance))throw Error('Место назначения занято.');
 const r=rect(virtual),bounds=canvas.dimensions.sceneRect;
 if(bounds&&(r.x<bounds.x||r.y<bounds.y||r.x+r.w>bounds.x+bounds.width||r.y+r.h>bounds.y+bounds.height))throw Error('Место находится вне сцены.');
}
function reactionAvailable(actor){awake(actor);if(actor.effects.some(e=>!e.disabled&&!e.isSuppressed&&flag(e,'reactionBan')))throw Error('Реакции запрещены действующим эффектом.');const stamp=reactionStamp(game.combat,actor);if(stamp&&flag(actor,'peaceReaction')===stamp)throw Error('Реакция Защитной связи уже потрачена до следующего хода.');}
export function parseDamage(text,types){const parts=String(text).split(/\n|;/).map(s=>s.trim()).filter(Boolean).map(line=>{const match=/^([a-z]+)\s*[:= ]\s*(\d+)$/.exec(line);if(!match||!types.includes(match[1])||!Number.isSafeInteger(Number(match[2]))||Number(match[2])>1000000)throw Error('Урон: тип: число, например fire: 12.');return {type:match[1],value:Number(match[2])};});if(!parts.length||!parts.some(d=>d.value>0))throw Error('Укажите положительный урон.');return parts;}
async function protect(item,req){
 const actor=item.actor;let c=await groupFor(item);if(clericLevel(c.source)<6||!has(c.source,'protective'))throw Error('Защитная связь ещё не получена.');reactionAvailable(actor);
 const selected=await targets(req);if(selected.length!==1||!c.nearby.some(t=>t.uuid===selected[0].uuid))throw Error('Выберите одного другого участника в пределах дистанции связи.');const target=selected[0];
 const kinds=Object.keys(CONFIG.DND5E.damageTypes);
 const data=await form('Защитная связь',`<p>${esc(actor.name)} принимает ВЕСЬ предназначенный ${esc(target.name)} урон. Исходной цели его НЕ применяйте.</p><p>Введите перенаправляемый урон по типам до защит принимающего; сложные перенаправления разрешите с ведущим заранее. Типы: ${kinds.map(esc).join(', ')}.</p><textarea name="damage" required placeholder="slashing: 12&#10;fire: 6"></textarea><label><input type="checkbox" name="magical">Урон магический</label>`+confirmField('Урон ещё не применён, реакция свободна; согласие защитника и взаимодействие всех защит проверены.'));
 if(!data)return cancel(req);requireConfirmed(data);const damage=parseDamage(data.damage,kinds).map(d=>({...d,properties:new Set(data.magical==='on'?['mgc']:[])}));
 const pos=await pickPosition(c.self);if(!pos)return cancel(req);
 c=await groupFor(item);reactionAvailable(actor);if(!c.nearby.some(t=>t.uuid===target.uuid))throw Error('Цель вышла за пределы связи.');validDestination(c.self,target,pos);
 const approval=await form('Применить телепортацию и урон?',`<p>Точка: ${pos.x}, ${pos.y}. ${esc(actor.name)} будет перемещён и получит указанный урон вместо ${esc(target.name)}.</p>`+confirmField('Место свободно и доступно для телепортации. Это весь предназначенный союзнику урон.'));
 if(!approval)return cancel(req);requireConfirmed(approval);
 c=await groupFor(item);reactionAvailable(actor);if(!c.nearby.some(t=>t.uuid===target.uuid))throw Error('Участники разошлись.');validDestination(c.self,target,pos);
 await begin(req);const stamp=reactionStamp(game.combat,actor);if(stamp)await actor.setFlag(MOD,'peaceReaction',stamp);
 await c.self.update(pos,{movement:{[c.self.id]:{waypoints:[{...pos,action:'displace'}]}}});
 if(Math.abs(c.self.x-pos.x)>1||Math.abs(c.self.y-pos.y)>1)throw Error('Телепортация отменена. Урон не применён; проверьте реакцию.');
 const options={ortesPeaceResistance:clericLevel(c.source)>=17&&has(c.source,'expansive')};
 const calculated=actor.calculateDamage(damage,options);if(!calculated)throw Error('Расчёт урона отменён. Проверьте уже совершённую телепортацию.');
 await actor.applyDamage(damage,options);
 if(calculated.amount>0&&actor.system.attributes.hp.value>0&&actor.statuses?.has('concentrating'))await actor.rollConcentration({target:actor.getConcentrationDC?.(calculated.amount)??Math.max(10,Math.floor(calculated.amount/2))},{configure:false});
 await say(actor,`<strong>Защитная связь:</strong> ${esc(actor.name)} телепортировался и принял ${calculated.amount} урона после защит вместо ${esc(target.name)}. Урон уже применён. Исходной цели его не списывайте.`);await done(req);
}
export async function processPeace(req){
 if(!gm()||flag(req,'peaceResolved'))return;
 const payload=flag(req,'peaceRequest');const activity=req.type==='usage'?req.getAssociatedActivity?.():null;
 let item=payload?await fromUuid(payload.item):activity?.item;
 if(feature(item)==='protective')item=item.actor?.items.find(i=>feature(i)==='controls'&&flag(i,'peaceMember'));
 if(!item?.actor||feature(item)==='balm'||!owns(item.actor,req.author))return;
 const actor=item.actor,current=actor.items.get(item.id);if(!current)return;
 const action=payload?.kind??activity?.flags?.[MOD]?.peaceAction;if(!action)return;
 const expected={bond:'bond',end:'bond',balm:'balm',bonus:'controls',protect:'controls'};
 if(feature(current)!==expected[action])return;
 return serial(async()=>{
  if(flag(req,'peaceResolved'))return;
  try{
   if(['bond','end','balm'].includes(action)&&(clericLevel(actor)<3||!has(actor,'subclass')))throw Error('Нужен Домен мира и минимум 3 уровня жреца.');
   if(action==='bond')await makeBond(current,req);
   if(action==='bonus')await addBonus(current,req,payload??{});
   if(action==='protect')await protect(current,req);
   if(action==='end'){const answer=await form('Завершить связь?',confirmField('Завершить текущую Ободряющую связь?'));if(!answer)return cancel(req);requireConfirmed(answer);await begin(req);await clearBond(actor);await done(req);}
  }catch(e){await req.setFlag(MOD,'peaceResolved',{status:flag(req,'peaceResolved')?.status==='applying'?'failed':'rejected',error:e.message});throw e;}
 });
}
async function cleanup(){if(!gm())return;await serial(async()=>{const actors=new Map((game.actors??[]).map(a=>[a.uuid,a]));for(const s of game.scenes??[])for(const t of s.tokens??[])if(t.actor)actors.set(t.actor.uuid,t.actor);for(const actor of actors.values()){const group=flag(actor,'peaceBond');if(group&&(!usableBond(group,now())||!has(actor,'bond')))await clearBond(actor);for(const collection of [[actor.items,'Item'],[actor.effects,'ActiveEffect']]){const ids=[];for(const d of collection[0]){const ref=flag(d,'peaceMember');if(!ref)continue;const source=await fromUuid(ref.source),g=flag(source,'peaceBond');if(!usableBond(g,now())||g.id!==ref.id)ids.push(d.id);}if(ids.length)await actor.deleteEmbeddedDocuments(collection[1],ids);}}});}
Hooks.on('dnd5e.calculateDamage',expansiveResistance);
export async function playerBonus(item,original){
 const actor=item.actor;if(!owns(actor,game.user))return;
 if(!game.users.activeGM)throw Error('Нужен активный ведущий.');
 const c=await groupFor(item);if(!c.nearby.length)throw Error('Для к4 рядом нужен другой участник этой же связи: не дальше 30 футов (60 футов с 17-го уровня).');
 const turn=turnStamp(game.combat);if(turn&&flag(actor,'peaceBonusTurn')===turn)throw Error('К4 связи уже использован в этот ход.');
 let selected=original;
 if(!selected){const choices=game.messages.contents.filter(m=>eligibleRoll(m,actor)&&!flag(m,'peaceBonus')&&(!turn||flag(m,'peaceRollTurn')===turn)).slice(-20).reverse();if(!choices.length)throw Error('Сначала совершите бросок атаки, проверки или спасброска.');
  const data=await form('Ободряющая связь',`<label>Бросок<select name="roll">${choices.map(m=>`<option value="${m.id}">${esc(m.flavor||m.type)}: ${m.rolls[0].total}</option>`).join('')}</select></label>`);if(!data)return;selected=game.messages.get(data.roll);
 }
 if(!eligibleRoll(selected,actor))throw Error('Выберите бросок атаки, проверки или спасброска этого участника.');if(flag(selected,'peaceBonus'))throw Error('К4 уже добавлен к этому броску.');
 const die=await new Roll('1d4').evaluate();
 await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),flavor:'Ободряющая связь',rolls:[die.toJSON()],whisper:selected.whisper??[],blind:selected.blind??false,flags:{[MOD]:{peaceRequest:{kind:'bonus',item:item.uuid,roll:selected.id,index:0,playerDie:true}}}});
}
Hooks.on('dnd5e.preUseActivity',a=>{
 if(feature(a.item)==='balm'){bindBalmResource(a);return;}
 const action=a.flags?.[MOD]?.peaceAction;if(!action)return;
 if(!game.users.activeGM){ui.notifications.warn('Для способностей Домена мира нужен активный ведущий.');return false;}
 if(action==='bonus'){void playerBonus(a.item).catch(report);return false;}
 if(action==='protect'){
  const item=feature(a.item)==='controls'?a.item:a.item.actor.items.find(i=>feature(i)==='controls'&&flag(i,'peaceMember'));
  if(!item){ui.notifications.warn('Сначала создайте Ободряющую связь с этим участником.');return false;}
  void ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:item.actor}),content:'<p>Защитная связь</p>',flags:{[MOD]:{peaceRequest:{kind:'protect',item:item.uuid,targets:[...game.user.targets].map(t=>t.document.uuid)}}}}).catch(report);return false;
 }
});
Hooks.on('preCreateChatMessage',m=>{if(['attack','check','save','initiative'].includes(m.type))m.updateSource({[`flags.${MOD}.peaceRollTurn`]:turnStamp(game.combat)});});
Hooks.on('createChatMessage',m=>{
 void processPeace(m).catch(report);
 if(gm()&&m.rolls?.some(r=>r.options?.ortesPeaceDie)){
  const actor=m.getAssociatedActor?.(),turn=turnStamp(game.combat);if(actor&&turn)void actor.setFlag(MOD,'peaceBonusTurn',turn);
  void m.setFlag(MOD,'peaceBonus',{native:true});
 }
});
Hooks.on('renderChatMessageHTML',(m,html)=>{
 const actor=m.getAssociatedActor?.();if(actor&&owns(actor,game.user)&&eligibleRoll(m,actor)&&!flag(m,'peaceBonus')){
  const control=actor.items.find(i=>feature(i)==='controls'&&flag(i,'peaceMember'));if(control){const b=document.createElement('button');b.type='button';b.textContent='Ободряющая связь: +к4';b.addEventListener('click',()=>{void bonusClick(b,control,m);});html.append(b);}
 }
 if(flag(m,'peaceRequest')||feature(m.getAssociatedActivity?.()?.item)!=='balm'&&m.getAssociatedActivity?.()?.flags?.[MOD]?.peaceAction){const state=flag(m,'peaceResolved'),p=document.createElement('p');p.textContent=({done:'Способность применена.',cancelled:'Отмена: ресурсы не потрачены.',applying:'Выполняется…',failed:'Выполнение прервано: проверьте уже потраченные ресурсы, перемещение и хиты. Не повторяйте запрос.',rejected:'Запрос отклонён: '+(state?.error??'')})[state?.status]??'Ожидает подтверждения ведущего.';html.append(p);}
});
for(const event of ['ready','updateWorldTime','deleteItem'])Hooks.on(event,()=>{void cleanup().catch(report);});

// Update only module-owned rules text and activities, preserving uses and advancement choices.
export async function migratePeace(){
 if(!gm())return;const pack=game.packs.get(PACK);if(!pack?.getDocuments)return;
 const templates=await pack.getDocuments(),byKey=new Map(templates.map(i=>[feature(i),i]));
 const actors=new Map((game.actors??[]).map(a=>[a.uuid,a]));for(const scene of game.scenes??[])for(const t of scene.tokens??[])if(t.actor)actors.set(t.actor.uuid,t.actor);
 for(const actor of actors.values())for(const item of actor.items){const template=byKey.get(feature(item));if(!template||Number(flag(item,'peaceRevision')??0)>=4)continue;
 const data=template.toObject();await item.update({'system.description.value':data.system.description.value,'system.activities':data.system.activities??{},'system.type':data.system.type??item.system.type,[`flags.${MOD}.peaceRevision`]:4});}
}
Hooks.on('ready',()=>{void migratePeace().catch(report);});

export function bindBalmResource(activity){
 const actor=activity.item.actor;
 const resource=actor.items.find(i=>i!==activity.item&&(flag(i,'peaceChannelResource')||i.system.identifier==='channel-divinity-cleric'))??actor.items.find(i=>i!==activity.item&&Number(i.system.uses?.max)>0&&/божественный канал|проведение энергии|channel divinity/i.test(i.name??''));
 const target=resource?.id??(Number(activity.item.system.uses?.max)>0?'':'feat:channel-divinity-cleric');
 for(const c of activity.consumption?.targets??[])if(c.type==='itemUses')c.target=target;
}
export async function bonusClick(button,item,message){
 button.disabled=true;try{await playerBonus(item,message);}catch(e){report(e);}finally{button.disabled=false;}
}
const nativeUses=new Map();
function rollActor(config){const s=config?.subject;return s?.actor??(s?.items?s:null);}
export function setupPeaceRoll(config,dialog){
 if(!config.hookNames?.some(n=>['d20Test','attack','abilityCheck','savingThrow','initiative'].includes(n)))return;
 const actor=rollActor(config),control=actor?.items.find(i=>feature(i)==='controls'&&flag(i,'peaceMember'));
 if(!control||!owns(actor,game.user))return;
 config.ortesPeaceControl=control.uuid;
 // Preserve native dialog class (attack/check/save); add a field to that same form.
}
Hooks.on('dnd5e.preRoll',setupPeaceRoll);
const rollContexts=new WeakMap();
export async function renderPeaceRoll(app){
 const uuid=app.config?.ortesPeaceControl;if(!uuid||!app.form||app.form.querySelector('[name="ortesPeaceDie"]'))return;
 const item=await fromUuid(uuid),c=await groupFor(item),turn=turnStamp(game.combat);
 const reason=!c.nearby.length?'Рядом нет другого участника связи':turn&&(flag(item.actor,'peaceBonusTurn')===turn||nativeUses.get(item.actor.uuid)===turn)?'К4 уже использован в этот ход':'';
 if(!app.form||app.form.querySelector('[name="ortesPeaceDie"]'))return;
 const label=document.createElement('label');label.className='form-group';
 label.innerHTML='<input type="checkbox" name="ortesPeaceDie"'+(reason?' disabled':'')+'>Ободряющая связь: добавить 1к4 к броску к20'+(reason?' — '+esc(reason):'');
 app.form.prepend(label);rollContexts.set(app,c);
}
Hooks.on('renderApplicationV2',app=>{void renderPeaceRoll(app).catch(report);});
Hooks.on('renderRollConfigurationDialog',app=>{void renderPeaceRoll(app).catch(report);});
export function buildPeaceRoll(app,config,formData,index){
 if(index!==0||!app.config?.ortesPeaceControl||!formData?.get('ortesPeaceDie'))return;
 const c=rollContexts.get(app);if(c&&(!usableBond(flag(c.source,'peaceBond'),now())||!c.others.some(t=>close(c.self,t,bondRange(clericLevel(c.source))))))return;
 config.parts.push('1d4');config.options??={};config.options.ortesPeaceDie=app.config.ortesPeaceControl;
}
Hooks.on('dnd5e.buildRollConfig',buildPeaceRoll);
Hooks.on('dnd5e.postRollConfiguration',(rolls,config)=>{
 if(!rolls.some(r=>r.options?.ortesPeaceDie))return;
 const actor=rollActor(config),turn=turnStamp(game.combat);if(!actor)return false;
 if(turn&&(flag(actor,'peaceBonusTurn')===turn||nativeUses.get(actor.uuid)===turn)){ui.notifications.warn('Ободряющая связь уже использована в этот ход.');return false;}
 if(turn)nativeUses.set(actor.uuid,turn);
});

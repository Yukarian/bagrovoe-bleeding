import {settlementEntries} from './village-storage.mjs';
let simpleClock=null;
export function enableSimpleClock(adapter){simpleClock=adapter;}
export function nativeFacilityAdvance(...args){return nativeAdvance?.(...args);}
import {copy,editVillage,previewWeek,addLog} from './village-model.mjs';
const MOD='bagrovoe-bleeding';
let commit,refresh=()=>{},nativeAdvance,nativeAll,turnQueue=Promise.resolve(),installed=false;
const activeTurns=new Set();
const state=d=>d.getFlag(MOD,'village');
const writer=()=>game.user?.isGM&&game.users.activeGM?.id===game.user.id;
const journals=()=>settlementEntries();
const links=s=>s.bastions??[];
const character=u=>game.actors.find(a=>a.uuid===u&&a.type==='character');
const facilities=a=>a?.items.filter(i=>i.type==='facility')??[];
const calendar=()=>globalThis.dnd5e?.settings.calendarConfig.enabled===true;
const daySeconds=()=>{const d=game.time.calendar?.days;return d?d.hoursPerDay*d.minutesPerHour*d.secondsPerMinute:86400;};
function elapsedDays(start,end){const c=game.time.calendar;return c?.constructor.dayDifference?c.constructor.dayDifference(c.timeToComponents(start),c.timeToComponents(end)):Math.floor((end-start)/daySeconds());}
const duration=()=>Number(globalThis.dnd5e?.settings.bastionConfiguration.duration??7);
const report=e=>{console.error('Мир Ортес | Оплот',e);ui.notifications.error(e.message);};
function requireWriter(){if(!writer())throw Error('Общие ходы деревни и Оплота выполняет активный ведущий.');}
export function plainHTML(html){return String(html??'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li)>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').trim();}
export function withBastionStaff(source){
 const s=copy(source),assigned=new Map();
 for(const uuid of links(s))for(const item of facilities(character(uuid)))for(const u of item.system.hirelings.value)assigned.set(u,item.name);
 for(const n of s.npcs)n.bastionJob=assigned.get(n.actorUuid)??'';
 for(const b of s.buildings)b.staffBlocked=s.schema<2&&b.posts.some(p=>s.npcs.find(n=>n.id===p.npcId)?.bastionJob);
 return s;
}
export function linkedBastions(s){
 return links(s).map(uuid=>{
  const a=character(uuid);if(!a)return {uuid,name:'Персонаж удалён или недоступен',missing:true,facilities:[]};
  const names=xs=>xs.map(u=>fromUuidSync(u)?.name??'Неизвестный персонаж');
  return {uuid,name:a.system.bastion?.name||`Оплот: ${a.name}`,owner:a.name,description:plainHTML(a.system.bastion?.description),facilities:facilities(a).map(i=>{
   const sys=i.system;return {uuid:i.uuid,name:i.name,img:i.img,description:plainHTML(sys.description?.value),special:sys.type.value==='special',built:sys.building.built,disabled:sys.disabled,
    size:game.i18n.localize(CONFIG.DND5E.facilities.sizes[sys.size]?.label??sys.size),progress:copy({value:sys.progress.value,max:sys.progress.max,order:sys.progress.order}),
    order:game.i18n.localize(CONFIG.DND5E.facilities.orders[sys.progress.order]?.label??sys.progress.order??''),hirelings:names(sys.hirelings.value),hirelingMax:sys.hirelings.max??0,defenders:names(sys.defenders.value),defenderMax:sys.defenders.max??0};})};
 });
}
export async function linkBastion(doc,actorUuid){
 requireWriter();const a=character(actorUuid);if(!a)throw Error('Выберите лист персонажа игрока с Оплотом.');
 if(globalThis.dnd5e?.settings.bastionConfiguration.enabled===false)throw Error('Сначала включите Оплоты в настройках D&D5e.');
 if(journals().some(d=>d.id!==doc.id&&links(state(d)).includes(actorUuid)))throw Error('Этот Оплот уже связан с другим поселением. Сначала отключите прежнюю связь.');
 const s=state(doc);if(links(s).includes(actorUuid))return;
 await commit(doc,s.revision,x=>editVillage(x,n=>{if(!links(n).length){n.bastionClock=game.time.worldTime;n.bastionDays=0;}n.bastions=[...links(n),actorUuid];n.bastionCalendar=calendar();addLog(n,`С поселением связан Оплот ${a.name}.`);}));
}
export async function unlinkBastion(doc,actorUuid){
 requireWriter();await commit(doc,state(doc).revision,x=>editVillage(x,n=>{n.bastions=links(n).filter(u=>u!==actorUuid);addLog(n,'Связь с Оплотом отключена. Постройки и персонажи сохранены.');}));
}
export function requireFacility(doc,uuid){
 if(state(doc).syncPending)throw Error('Дождитесь завершения общего хода.');
 const item=fromUuidSync(uuid);if(item?.type!=='facility'||!links(state(doc)).includes(item.actor?.uuid))throw Error('Постройка не принадлежит связанному Оплоту.');return item;
}
export function previewDays(source,days){
 if(!Number.isInteger(days)||days<0||days>36500)throw Error('Некорректная длительность общего хода.');
 let s=withBastionStaff(source),left=(s.bastionDays??0)+days;const messages=[];
 while(left>=7){const p=previewWeek(s);s=p.state;messages.push(...p.messages);left-=7;}
 s.bastionDays=left;s.undo=null;
 return {state:s,messages};
}
function enqueue(task){const p=turnQueue.catch(()=>{}).then(task);turnQueue=p;return p;}
// Receipt is persisted before native mutations. Interrupted turns are reconciled, never replayed.
export async function runSharedTurn(docs,nativeTask,days,{clock}={}){
 requireWriter();const token=foundry.utils.randomID(),plans=[];
 for(const doc of docs){const before=copy(state(doc));if(before.syncPending)throw Error(`${doc.name}: сначала завершите прерванный общий ход.`);
  if(links(before).some(u=>journals().some(d=>d.id!==doc.id&&links(state(d)).includes(u))))throw Error(`${doc.name}: один Оплот связан с несколькими деревнями. Отключите лишнюю связь.`);
  const count=typeof days==='function'?days(before):days,preview=previewDays(before,count);if(clock!==undefined)preview.state.bastionClock=clock;
  plans.push({doc,before,after:preview.state});
 }
 activeTurns.add(token);
 try{
  for(const p of plans)await commit(p.doc,p.before.revision,x=>({...x,revision:x.revision+1,undo:null,syncPending:{token,phase:'started',after:p.after}}));
  const result=await nativeTask();
  for(const p of plans){
   const current=state(p.doc);await commit(p.doc,current.revision,x=>({...x,revision:x.revision+1,syncPending:{...x.syncPending,phase:'nativeDone'}}),{turnToken:token});
  }
  for(const p of plans)await finalizeTurn(p.doc,true,{internal:true});
  refresh();return result;
 }finally{activeTurns.delete(token);refresh();}
}
export async function finalizeTurn(doc,apply,{internal=false}={}){
 requireWriter();const s=state(doc),pending=s.syncPending;if(!pending)return;
 if(!internal&&activeTurns.has(pending.token))throw Error('Ход ещё выполняется. Дождитесь завершения операции.');
 await commit(doc,s.revision,x=>{const n=copy(apply?pending.after:x);delete n.syncPending;n.revision=x.revision+1;n.undo=null;addLog(n,apply?'Общий ход деревни и Оплота учтён.':'Учёт деревни после прерванного хода оставлен без изменений. Постройки Оплота требуют сверки.');return n;},{turnToken:pending.token});refresh();
}
export async function advanceVillage(doc,expected){
 requireWriter();return enqueue(async()=>{
  if(state(doc).revision!==expected)throw Error('Деревня изменилась: обновите предварительный итог.');
  if(calendar()){
   previewDays(state(doc),7);if(state(doc).syncPending)throw Error('Сначала завершите прерванный ход.');
   // D&D5e owns daily facility progress when its calendar is enabled.
   await game.time.advance(7*daySeconds());await syncCalendar();return;
  }
  const owners=links(state(doc)).map(character);if(owners.some(a=>!a))throw Error('Удалите связь с отсутствующим владельцем Оплота.');
  await runSharedTurn([doc],async()=>{for(const a of owners)await nativeAdvance(a,{duration:7});},7);
 });
}
export async function syncCalendar(){
 if(simpleClock||!writer()||!calendar())return;
 const now=Number(game.time.worldTime),docs=journals().filter(d=>links(state(d)).length&&Number.isFinite(state(d).bastionClock)&&elapsedDays(state(d).bastionClock,now)>0);
 if(!docs.length)return;
 // Count native calendar midnights, including custom day lengths. Fallback retains fractional days.
 for(const doc of docs){const elapsed=elapsedDays(state(doc).bastionClock,now),clock=game.time.calendar?.constructor.dayDifference?now:state(doc).bastionClock+elapsed*daySeconds();
  await runSharedTurn([doc],async()=>{},elapsed,{clock});
 }
}
export function installBridge(adapter){
 commit=adapter.commit;refresh=adapter.refresh??refresh;if(installed)return;
 const b=globalThis.dnd5e?.bastion;if(!b)return;installed=true;
 nativeAdvance=b.advanceAllFacilities.bind(b);nativeAll=b.advanceAllBastions.bind(b);
 b.advanceAllFacilities=async(actor,options={})=>{
  if(simpleClock&&!calendar()&&options.performUpdates!==false&&options.turn!==false)return simpleClock.advance(options.duration??duration());
  const doc=journals().find(d=>links(state(d)).includes(actor.uuid));
  if(!doc||options.performUpdates===false||options.turn===false||calendar())return nativeAdvance(actor,options);
  requireWriter();return enqueue(()=>runSharedTurn([doc],async()=>{
   let selected;for(const uuid of links(state(doc))){const a=character(uuid);if(!a)throw Error('Владелец Оплота не найден.');const result=await nativeAdvance(a,options);if(uuid===actor.uuid)selected=result;}return selected;
  },options.duration??duration()));
 };
 b.advanceAllBastions=async()=>{
  if(simpleClock&&!calendar())return simpleClock.advance(duration());
  if(calendar())return nativeAll();
  const all=game.actors.filter(a=>a.system.isCharacter&&facilities(a).length),ids=new Set(all.map(a=>a.uuid)),docs=journals().filter(d=>links(state(d)).some(u=>ids.has(u)));
  if(!docs.length)return nativeAll();requireWriter();
  return enqueue(()=>runSharedTurn(docs,async()=>{for(const actor of all)await nativeAdvance(actor);await game.settings.set('dnd5e','bastionTurns',[...game.settings.get('dnd5e','bastionTurns'),game.time.worldTime]);},duration()));
 };
 Hooks.on('updateWorldTime',()=>{if(writer()&&calendar())void enqueue(syncCalendar).catch(report);});
 Hooks.on('updateSetting',setting=>{
  if(simpleClock||!writer()||setting.key!=='dnd5e.calendarConfig')return;
  void enqueue(async()=>{for(const doc of journals())if(links(state(doc)).length&&state(doc).bastionCalendar!==calendar())await commit(doc,state(doc).revision,x=>editVillage(x,n=>{n.bastionClock=game.time.worldTime;n.bastionCalendar=calendar();}));}).catch(report);
 });
}

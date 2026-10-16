import {broadcastCasinoAnimation} from './casino-animation.mjs';
import {freshCasino,publicCasino,transition,coinsAfter} from './casino-model.mjs';
import {ensurePrivateStorage,privateEntries,createPrivateEntry} from './village-storage.mjs';
const MOD='bagrovoe-bleeding';let queue=Promise.resolve();
export const activeCasinoGM=()=>game.user?.isGM&&game.users.activeGM?.id===game.user.id;
const serial=fn=>{const p=queue.catch(()=>{}).then(fn);queue=p;return p;};
const guard=()=>{if(!activeCasinoGM())throw Error('Действие выполняет активный ведущий.');};
export const casinoDocument=()=>privateEntries().find(d=>d.getFlag(MOD,'casino'));
const currency=a=>Object.fromEntries(['pp','gp','ep','sp','cp'].map(k=>[k,Number(a.system.currency?.[k]??0)]));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const casinoSnapshot=()=>game.journal.find(d=>d.getFlag(MOD,'casinoPublic'))?.getFlag(MOD,'casinoPublic')??publicCasino(freshCasino());
export async function publishCasino(){guard();const d=casinoDocument();if(!d)return;const data=publicCasino(d.getFlag(MOD,'casino').state);data.pending=!!d.getFlag(MOD,'casino').pending;let pub=game.journal.find(d=>d.getFlag(MOD,'casinoPublic'));if(pub)await pub.setFlag(MOD,'casinoPublic',data);else await JournalEntry.create({name:'Колесо фортуны — игровое состояние',ownership:{default:2},pages:[],flags:{[MOD]:{casinoPublic:data}}});}
export function bootCasino(){return serial(async()=>{guard();await ensurePrivateStorage();if(!casinoDocument())await createPrivateEntry({name:'Казино — служебные данные',ownership:{default:0},pages:[],flags:{[MOD]:{casino:{state:freshCasino(),pending:null}}}});await finishReveal(casinoDocument());await publishCasino();}).then(async()=>{if(pendingCasino())return;for(const m of game.messages.filter(m=>m.getFlag(MOD,'casinoRequest')&&!m.getFlag(MOD,'casinoHandled')))await processCasino(m);});}
export async function requestCasino(command){
 if(!game.users.activeGM)throw Error('Для игры нужен подключённый ведущий.');
 const actor=command.actor?game.actors.get(command.actor):null;
 if(actor&&!actor.testUserPermission(game.user,'OWNER'))throw Error('Выберите своего персонажа.');
 return ChatMessage.create({content:'Казино: запрос отправлен крупье.',whisper:[...new Set([game.user.id,...game.users.filter(u=>u.isGM).map(u=>u.id)])],flags:{[MOD]:{casinoRequest:command}}});
}
export function processCasino(message){return serial(async()=>{
 guard();const request=structuredClone(message.getFlag(MOD,'casinoRequest'));if(!request||message.getFlag(MOD,'casinoHandled'))return;
 const doc=casinoDocument();if(!doc)throw Error('Казино ещё загружается.');await finishReveal(doc);const saved=doc.getFlag(MOD,'casino');
 if(saved.state.processed[message.id]){await message.setFlag(MOD,'casinoHandled','done');return;}
 if(saved.pending){await message.setFlag(MOD,'casinoHandled','error');await message.update({content:'Казино: ведущему нужно завершить предыдущий расчёт. Отправьте действие после сверки.'});return;}
 try{
  const author=message.author;if(!author)throw Error('Автор запроса не найден.');
  const actor=request.actor?game.actors.get(request.actor):null;
  const personal=['buy','sell','slots','reroll','wheel','join','grant'].includes(request.action);
  if(personal&&(!actor||actor.type!=='character'||!actor.testUserPermission(author,'OWNER')))throw Error('Нет прав на этого персонажа.');
  const rolls=[];
  const next=await transition(saved.state,request,{id:message.id,now:game.time.worldTime,isGM:author.isGM,name:id=>game.actors.get(id)?.name??'Персонаж',roll:async(sides,count)=>{const r=await new Roll(`${count}d${sides}`).evaluate();rolls.push(r.toJSON());return r.dice.flatMap(d=>d.results.filter(x=>x.active!==false).map(x=>x.result));}});
  if(next.gold){const before=currency(actor),after=coinsAfter(before,next.gold);const pending={request:message.id,actor:actor.id,before,after,next:next.state,results:next.results,rolls,presentation:next.presentation};await doc.setFlag(MOD,'casino',{state:saved.state,pending});await publishCasino();await finishPending(doc);}
  else{await doc.setFlag(MOD,'casino',{state:next.state,pending:null,reveal:{request:message.id,results:next.results,rolls,presentation:next.presentation}});await finishReveal(doc);}
 }catch(e){
  console.error('Ortes casino',e);
  // A prepared currency transaction must remain recoverable, never mark it failed or retry the game.
  if(doc.getFlag(MOD,'casino').pending?.request===message.id){await publishCasino().catch(()=>{});ui.notifications.error('Казино: расчёт сохранён. Откройте казино и выполните сверку.');return;}
  if(doc.getFlag(MOD,'casino').state.processed[message.id]){await publishCasino().catch(()=>{});ui.notifications.warn('Игра рассчитана; результат сохранён в истории казино. Сообщение чата не удалось обновить.');return;}
  await message.update({content:'Казино: '+escapeHTML(e.message),[`flags.${MOD}.casinoHandled`]:'error'});
 }
});}
async function finishPending(doc){
 guard();const p=doc.getFlag(MOD,'casino').pending;if(!p)return;const a=game.actors.get(p.actor);if(!a)throw Error('Персонаж расчёта удалён.');
 const actual=currency(a);if(!same(actual,p.before)&&!same(actual,p.after))throw Error('Монеты изменились. Вручную сверьте остаток с исходным или ожидаемым, затем повторите сверку.');
 if(same(actual,p.before))await a.update({'system.currency':p.after});
 await doc.setFlag(MOD,'casino',{state:p.next,pending:null,reveal:{request:p.request,results:p.results,rolls:p.rolls,presentation:p.presentation??null}});await finishReveal(doc);
}
export function recoverCasino(){return serial(async()=>{guard();await finishPending(casinoDocument());});}
export const pendingCasino=()=>activeCasinoGM()?casinoDocument()?.getFlag(MOD,'casino')?.pending:null;
async function finishReveal(doc){
 const r=doc.getFlag(MOD,'casino').reveal;if(!r)return;const m=game.messages.get(r.request);
 if(m&&!game.messages.some(x=>x.getFlag(MOD,'casinoResult')===r.request))await announce(m,r.results,r.rolls,r.presentation);
 const saved=doc.getFlag(MOD,'casino');await doc.setFlag(MOD,'casino',{...saved,reveal:null});await publishCasino();
}
async function announce(m,texts,rolls,presentation){
 const event=await broadcastCasinoAnimation(m.id,presentation,'Колесо фортуны');
 await m.update({content:'Казино: действие выполнено.',[`flags.${MOD}.casinoHandled`]:'done'});
 const c=m.getFlag(MOD,'casinoRequest'),actor=c.actor?game.actors.get(c.actor):null;
 await ChatMessage.create({speaker:actor?ChatMessage.getSpeaker({actor}):{alias:'Крупье'},content:`<div class="ortes-casino-result"><strong>Колесо фортуны</strong>${texts.map(t=>'<p>'+escapeHTML(t)+'</p>').join('')}</div>`,...(rolls.length?{rolls:rolls.map(r=>Roll.fromData(r))}:{}),flags:{[MOD]:{casinoResult:m.id,...(event?{casinoAnimation:event}:{})}}});
}
export const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
Hooks.on('createChatMessage',m=>{if(activeCasinoGM()&&m.getFlag(MOD,'casinoRequest'))void processCasino(m).catch(e=>ui.notifications.error(e.message));});

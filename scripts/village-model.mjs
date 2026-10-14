import {validateDevelopment} from './village-development.mjs';
import {validateSimple} from './village-simple.mjs';
// Pure settlement rules: no Foundry globals, dice or automatic calendar changes.
export const RESOURCES={supplies:'Припасы',materials:'Материалы',gold:'Золото'};
export const TYPES={house:'Жилой дом',tavern:'Таверна',smithy:'Кузница',temple:'Храм',clinic:'Лечебница',barracks:'Казарма',farm:'Ферма',workshop:'Мастерская',other:'Другое'};
export const CONDITIONS={intact:'Целое',damaged:'Повреждено',ruined:'Разрушено'};
export const ROLES={house:'Смотритель',tavern:'Трактирщик',smithy:'Кузнец',temple:'Жрец',clinic:'Лекарь',barracks:'Капитан',farm:'Фермер',workshop:'Мастер',other:'Ответственный'};
export const PRESETS={
 tavern:{name:'Собрать слухи',weeks:1,cost:{gold:5},gain:{},note:'Ведущий добавляет полезный слух в журнал.'},
 smithy:{name:'Заготовить материалы',weeks:1,cost:{gold:10},gain:{materials:3}},
 temple:{name:'Поддержать жителей',weeks:1,cost:{supplies:2},gain:{},orderGain:1},
 clinic:{name:'Помочь пострадавшим',weeks:1,cost:{supplies:3},gain:{},note:'Ведущий определяет восстановление жителей; HP листов не меняются.'},
 barracks:{name:'Организовать патруль',weeks:1,cost:{supplies:2},gain:{},orderGain:1},
 farm:{name:'Собрать урожай',weeks:1,cost:{},gain:{supplies:8}},
 workshop:{name:'Ремонт / строительство',weeks:2,cost:{materials:5,gold:10},gain:{},repair:true}
};
export const copy=v=>structuredClone(v);
export function freshVillage(name='Новая деревня'){
 return {schema:1,revision:0,name,week:1,population:0,order:3,resources:{supplies:0,materials:0,gold:0},upkeep:{supplies:0,materials:0,gold:0},notes:'',buildings:[],npcs:[],log:[],undo:null};
}
const fail=message=>{throw Error(message);};
function number(value,label,max=100000000){if(!Number.isFinite(value)||value<0||value>max)fail(`${label}: требуется число от 0 до ${max}.`);}
function integer(value,label,max=100000000){number(value,label,max);if(!Number.isInteger(value))fail(`${label}: требуется целое число.`);}
function budget(values,label){for(const k of Object.keys(RESOURCES))number(values?.[k]??0,`${label}: ${RESOURCES[k]}`);}
function unique(list,label){const ids=new Set();for(const x of list){if(!x.id||ids.has(x.id))fail(`Повторяющийся идентификатор: ${label}.`);ids.add(x.id);}return ids;}
export function validate(s){
 if(s.schema===3)return validateDevelopment(s);
 if(s.schema===2)return validateSimple(s);
 if(s.schema!==1)fail('Неизвестная версия данных поселения.');
 if(!s.name?.trim())fail('Укажите название поселения.');
 integer(s.revision,'Версия');integer(s.week,'Неделя');integer(s.population,'Население');integer(s.order,'Порядок',5);
 budget(s.resources,'Запас');budget(s.upkeep,'Содержание');
 const buildings=unique(s.buildings,'здание'),npcs=unique(s.npcs,'житель');
 if(s.npcs.length>s.population)fail('Именных жителей больше общего населения.');
 const assigned=new Set();let residents=0;
 for(const b of s.buildings){
  if(!b.name?.trim()||!TYPES[b.type]||!CONDITIONS[b.condition])fail('Проверьте название, тип и состояние здания.');
  integer(b.capacity,'Вместимость');integer(b.residents,'Жители здания');residents+=b.residents;
  if(b.residents>b.capacity)fail(`В здании «${b.name}» превышена вместимость.`);
  if(!b.occupied&&b.residents)fail(`Пустующее здание «${b.name}» не может иметь жителей.`);
  if(b.condition==='ruined'&&b.residents)fail(`Сначала переселите жителей разрушенного здания «${b.name}».`);
  unique(b.posts,'должность');
  for(const p of b.posts){if(!p.title?.trim())fail('Укажите название должности.');if(!p.npcId)continue;
   if(!npcs.has(p.npcId))fail('Должность ссылается на отсутствующего жителя.');
   if(assigned.has(p.npcId))fail('Один житель может занимать только одну рабочую должность.');assigned.add(p.npcId);
  }
  if(b.job){const j=b.job;if(!j.name?.trim())fail('Укажите название приказа.');integer(j.remaining,'Срок приказа',52);if(j.remaining<1)fail('Срок приказа — минимум неделя.');budget(j.cost,'Цена');budget(j.gain,'Результат');integer(j.orderGain??0,'Изменение порядка',5);
   if(j.targetId&&(!buildings.has(j.targetId)||j.targetId===b.id))fail('Выберите другое существующее здание для работ.');
  }
 }
 if(residents>s.population)fail('По зданиям расселено больше жителей, чем есть в деревне.');
 const linked=new Set();
 for(const n of s.npcs){if(!n.name?.trim())fail('Укажите имя жителя.');if(n.actorUuid){if(linked.has(n.actorUuid))fail('Этот персонаж уже добавлен в поселение.');linked.add(n.actorUuid);}if(n.homeId&&!buildings.has(n.homeId))fail('Дом жителя не найден.');}
 for(const b of s.buildings)if(s.npcs.filter(n=>n.homeId===b.id).length>b.residents)fail(`Именные жители «${b.name}» должны входить в число его жильцов.`);
 return s;
}
export function stats(s){return {total:s.buildings.length,intact:s.buildings.filter(b=>b.condition==='intact').length,damaged:s.buildings.filter(b=>b.condition==='damaged').length,ruined:s.buildings.filter(b=>b.condition==='ruined').length,empty:s.buildings.filter(b=>!b.occupied).length,housed:s.buildings.reduce((n,b)=>n+b.residents,0),vacant:s.buildings.reduce((n,b)=>n+b.posts.filter(p=>!p.npcId).length,0)};}
export function addLog(s,text){s.log.push({week:s.week,...(s.schema>=2?{day:s.calendarDay}:{}),text});if(s.schema>=2)return;const recent=new Set(s.log.filter(l=>!l.manual).slice(-100));s.log=s.log.filter(l=>l.manual||recent.has(l));}
export function writeNote(source,id,text){
 const value=String(text??'').trim();if(!value||value.length>10000)fail('Запись должна содержать от 1 до 10000 символов.');
 return editVillage(source,s=>{const old=s.log.find(l=>l.id===id);if(old){if(!old.manual)fail('Системную запись нельзя изменить.');old.text=value;}else{s.log.push({id,week:s.week,...(s.schema>=2?{day:s.calendarDay}:{}),text:value,manual:true});}});
}
export function editVillage(source,change){const next=copy(source);change(next);next.revision++;next.undo=null;return validate(next);}
export function canWork(b){return b.condition==='intact'&&b.occupied&&!b.staffBlocked&&b.posts.some(p=>p.npcId);}
export function startJob(source,buildingId,job){return editVillage(source,s=>{
 const b=s.buildings.find(b=>b.id===buildingId);if(!b)fail('Здание не найдено.');if(b.job)fail('В здании уже выполняется приказ.');if(!canWork(b))fail('Нужны целое используемое здание и назначенный работник.');
 if(job.targetId&&s.buildings.some(x=>x.job?.targetId===job.targetId))fail('На этом здании уже ведутся работы.');
 budget(job.cost,'Цена');for(const k of Object.keys(RESOURCES)){const cost=job.cost[k]??0;if(s.resources[k]<cost)fail(`Недостаточно ресурса: ${RESOURCES[k]}.`);s.resources[k]-=cost;}
 b.job=copy(job);addLog(s,`${b.name}: начат приказ «${job.name}». Цена оплачена.`);
});}
export function cancelJob(source,id){return editVillage(source,s=>{const b=s.buildings.find(b=>b.id===id);if(!b?.job)fail('Приказ не найден.');addLog(s,`${b.name}: приказ «${b.job.name}» отменён, цена не возвращается.`);b.job=null;});}
export function previewWeek(source){
 validate(source);const s=copy(source);s.undo=null;const messages=[];
 for(const k of Object.keys(RESOURCES)){if(s.resources[k]<s.upkeep[k])fail(`На содержание не хватает: ${RESOURCES[k]}. Сначала скорректируйте запасы или расход.`);s.resources[k]-=s.upkeep[k];}
 messages.push(`Содержание: ${Object.entries(RESOURCES).map(([k,label])=>`${label} −${s.upkeep[k]}`).join(', ')}.`);
 const eligible=new Set(source.buildings.filter(canWork).map(b=>b.id));
 for(const b of s.buildings){if(!b.job)continue;const j=b.job;
  if(!eligible.has(b.id)){messages.push(`${b.name}: работа приостановлена — нет работника или здание непригодно.`);continue;}
  j.remaining--;if(j.remaining){messages.push(`${b.name}: «${j.name}», осталось недель: ${j.remaining}.`);continue;}
  for(const k of Object.keys(RESOURCES))s.resources[k]+=j.gain[k]??0;
  s.order=Math.min(5,s.order+(j.orderGain??0));
  if(j.targetId){const target=s.buildings.find(x=>x.id===j.targetId);target.condition='intact';messages.push(`Завершены работы: ${target.name}.`);}
  messages.push(`${b.name}: выполнено «${j.name}».${j.note?' '+j.note:''}`);b.job=null;
 }
 const vacant=stats(s).vacant;if(vacant)messages.push(`Свободных должностей: ${vacant}.`);
 addLog(s,`Завершена неделя ${s.week}. ${messages.join(' ')}`);s.week++;s.revision++;
 s.undo={revision:s.revision,before:{...copy(source),undo:null}};
 return {state:validate(s),messages};
}
export function undoWeek(source){
 if(!source.undo||source.undo.revision!==source.revision)fail('Нет последнего хода для отмены. После изменений отмена недоступна.');
 const s=copy(source.undo.before);s.revision=source.revision+1;s.undo=null;addLog(s,'Последний недельный ход отменён.');return validate(s);
}

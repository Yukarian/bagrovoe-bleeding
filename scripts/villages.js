import {correctWesterholm,WESTERHOLM_PAGE} from './westerholm-content.mjs';
import {privateEntries,settlementEntries,settlementById,ensurePrivateStorage} from './village-storage.mjs';
import {freshVillage,copy,validate,editVillage,writeNote,RESOURCES,TYPES,ROLES} from './village-model.mjs';
import {esc,button,villageHTML,safeImage} from './village-view.mjs';
import {linkedBastions,linkBastion,unlinkBastion,requireFacility,finalizeTurn,installBridge,plainHTML,withBastionStaff,enableSimpleClock,nativeFacilityAdvance} from './bastion-bridge.mjs';
import {migrateDevelopment as migrateVillage} from './village-development.mjs';
import {installDevelopment,publishDevelopment,flushDevelopment} from './development-runtime.mjs';
import {openDevelopment,refreshDevelopment} from './development-ui.mjs';
import {publicClock,calendarStatus,calendarAdvancing,advanceCalendar,installOrtesClock,bootClock,ensureClock} from './ortes-clock.mjs';
import {openCalendar,openEvents,refreshCalendar} from './ortes-calendar.mjs';
const MOD='bagrovoe-bleeding',FLAG='village';
const {ApplicationV2,DialogV2}=foundry.applications.api;
const uid=()=>foundry.utils.randomID();
const input=(name,label,value='',type='text')=>`<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" step="1"':'maxlength="1000"'}></label>`;
const select=(name,label,values,value='')=>`<label>${esc(label)}<select name="${name}">${Object.entries(values).map(([k,l])=>`<option value="${esc(k)}" ${String(k)===String(value)?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
const textArea=(name,label,value='')=>`<label>${esc(label)}<textarea name="${name}" maxlength="10000">${esc(value)}</textarea></label>`;
const budgets=(prefix,label,v={})=>`<fieldset><legend>${label}</legend>${Object.entries(RESOURCES).map(([k,l])=>input(prefix+k,l,v[k]??0,'number')).join('')}</fieldset>`;
const readBudget=(fd,prefix)=>Object.fromEntries(Object.keys(RESOURCES).map(k=>[k,Number(fd.get(prefix+k))]));
async function form(title,content){return DialogV2.wait({classes:['ortes-dialog'],window:{title},position:{width:540},content:`<div class="ortes-form">${content}</div>`,buttons:[{action:'save',label:'Сохранить',default:true,callback:(_event,b)=>{if(!b.form.reportValidity())throw Error('Проверьте заполнение полей.');return new FormData(b.form);}},{action:'cancel',label:'Отмена',callback:()=>null}],rejectClose:false});}
async function confirm(title,content){return DialogV2.confirm({classes:['ortes-dialog'],window:{title},content:`<div class="ortes-form">${content}</div>`,defaultYes:false,rejectClose:false});}
function requireWriter(){if(!game.user.isGM||game.users.activeGM?.id!==game.user.id)throw Error('Изменения выполняет активный ведущий мира.');}
let queue=Promise.resolve();
// One writer, serialized local operations and revision checks prevent double charging.
export function commitVillage(doc,expected,transform,{turnToken,paymentToken}={}){
 const task=queue.catch(()=>{}).then(async()=>{requireWriter();if(doc.getFlag(MOD,'villageDeleted')===true)throw Error('Поселение удалено.');const state=withBastionStaff(copy(doc.getFlag(MOD,FLAG)));if(state.syncPending&&state.syncPending.token!==turnToken)throw Error('Общий ход Оплота ещё не завершён. Проверьте сообщение в окне деревни.');if(state.revision!==expected)throw Error('Деревня уже изменена. Обновите окно и повторите действие.');if(state.development?.pendingPayment&&state.development.pendingPayment.id!==paymentToken)throw Error('Сначала сверьте незавершённую оплату.');const next=validate(transform(state));const pending=calendarStatus()?.pending;if((pending||calendarAdvancing())&&(!pending||next.lastCalendarTransaction!==pending.id))throw Error('Сначала завершите прерванный ход календаря.');await doc.update({name:next.name,[`flags.${MOD}.${FLAG}`]:next,...(next.schema===3?{ownership:{default:0,...Object.fromEntries((game.users?.filter?.(u=>!u.isGM)??[]).map(u=>[u.id,0]))}}:{})});await publishDevelopment(doc,next);return next;});queue=task;return task;
}
async function settlementFolder(){
 let root=game.folders.find(f=>f.type==='JournalEntry'&&f.name==='Мир Ортес'&&!f.folder);
 root??=await Folder.create({name:'Мир Ортес',type:'JournalEntry',color:'#35564a'});
 let child=game.folders.find(f=>f.type==='JournalEntry'&&f.name==='Поселения'&&f.folder?.id===root.id);
 child??=await Folder.create({name:'Поселения',type:'JournalEntry',folder:root.id,color:'#35564a'});return child;
}
export async function ensureWesterholm(){
 if(!game.user.isGM||game.users.activeGM?.id!==game.user.id)return;
 await ensurePrivateStorage();
 if([...game.journal,...privateEntries()].some(d=>d.getFlag(MOD,'settlementSeed')==='westerholm'||d.name==='Вестерхольм'))return;
 const pack=game.packs.get(MOD+'.settlements');if(!pack)return;
 const source=await pack.getDocument('ortesWesterholm1');if(!source)return;
 const data=source.toObject();delete data._id;data.folder=(await settlementFolder()).id;data.ownership={default:0};
 await JournalEntry.create(data);
}

export class VillageApp extends ApplicationV2{
 static DEFAULT_OPTIONS={id:'ortes-villages',classes:['ortes-villages'],window:{title:'Мир Ортес — Поселения',icon:'fa-solid fa-house-chimney',resizable:true},position:{width:980,height:760}};
 selected=null;snapshot=null;busy=false;
 async _renderHTML(){
  if(!game.user.isGM)return '<p>Управление поселениями доступно ведущему.</p>';
  const entries=settlementEntries();
  if(!entries.some(d=>d.id===this.selected))this.selected=(entries.find(d=>d.getFlag(MOD,'settlementSeed')==='westerholm'||d.name==='Вестерхольм')??entries[0])?.id??null;
  const selectedDoc=settlementById(this.selected);if(selectedDoc&&selectedDoc.getFlag(MOD,FLAG)?.schema!==3&&!selectedDoc.getFlag(MOD,FLAG).syncPending&&game.users.activeGM?.id===game.user.id)await ensureClock();
  this.snapshot=this.selected?withBastionStaff(copy(settlementById(this.selected).getFlag(MOD,FLAG))):null;
  return `<div class="ortes-body">${villageHTML(this.snapshot,entries,this.selected,this.snapshot?linkedBastions(this.snapshot):[],publicClock())}</div>`;
 }
 _replaceHTML(result,content){const open=new Set([...content.querySelectorAll('details[data-row][open]')].map(d=>d.dataset.row)),scroll=content.scrollTop;content.innerHTML=result;for(const d of content.querySelectorAll('details[data-row]'))d.open=open.has(d.dataset.row);content.scrollTop=scroll;
  content.querySelector('[data-village]')?.addEventListener('change',e=>{this.selected=e.target.value;this.render({force:true});});
  content.addEventListener('click',this.clickHandler??=e=>{const b=e.target.closest('[data-cmd]');if(b){e.preventDefault();void this.command(b.dataset.cmd,b.dataset.id);}});
 }
 async command(cmd,id){
  if(this.busy)return;this.busy=true;
  try{
   if(!game.user.isGM)throw Error('Требуются права ведущего.');
   if(cmd==='development'){openDevelopment(this.selected);return;}
   if(cmd==='calendar'){openCalendar();return;}
   if(cmd==='events'){openDevelopment(this.selected,'events');return;}
   if(cmd==='journal'){await game.journal.get(this.selected)?.sheet.render(true);return;}
   if(cmd==='refresh'){await this.render({force:true});return;}
   if(cmd==='actor'){const n=this.snapshot.npcs.find(n=>n.id===id),a=await fromUuid(n.actorUuid);if(!a)throw Error('Связанный персонаж не найден.');await a.sheet.render({force:true});return;}
   requireWriter();
   if((calendarAdvancing()||calendarStatus()?.pending)&&!['calendar','events'].includes(cmd))throw Error('Дождитесь завершения хода календаря.');
   if(cmd==='create'){
    const fd=await form('Новое поселение',input('name','Название','Новая деревня'));if(!fd)return;
    const s=validate(migrateVillage(freshVillage(String(fd.get('name')).trim()),publicClock().day)),folder=await settlementFolder();
    const doc=await JournalEntry.create({name:s.name,folder:folder.id,ownership:{default:0},pages:[{name:'Управление поселением',type:'text',text:{content:'<p>Откройте «Мир Ортес — Поселения» в настройках модуля или кнопкой домика на панели токенов.</p>',format:1}}],flags:{[MOD]:{[FLAG]:s}}});this.selected=doc.id;await ensurePrivateStorage();await publishDevelopment(settlementById(doc.id),s);
   }else{
    const s=copy(this.snapshot),doc=settlementById(this.selected);if(!doc||!s)throw Error('Выберите поселение.');
    if(s.schema!==3&&cmd!=='resolveTurn')throw Error('Сначала завершите прежний ход Оплота для переноса деревни.');
    const save=fn=>commitVillage(doc,s.revision,fn),edit=fn=>save(current=>editVillage(current,fn));
    if(cmd==='deleteVillage'){
     if(await confirm('Удалить поселение?',`<p>Удалить «${esc(s.name)}» и его страницы? Листы персонажей и их Оплоты сохранятся.</p>`))await deleteVillage(doc.id,s.revision);
    }else if(cmd==='linkBastion'){
     const choices=Object.fromEntries(game.actors.filter(a=>a.type==='character'&&!(s.bastions??[]).includes(a.uuid)).map(a=>[a.uuid,a.name]));
     if(!Object.keys(choices).length)throw Error('Нет свободного листа персонажа игрока для связи.');
     const fd=await form('Связать Оплот',select('owner','Владелец Оплота',choices)+'<p>Все его постройки и приказы будут общими с деревней. Один Оплот связывается с одним поселением. Несколько Оплотов в деревне проходят общий ход вместе.</p>');if(!fd)return;await linkBastion(doc,fd.get('owner'));
    }else if(cmd==='unlinkBastion'){
     if(await confirm('Отключить Оплот?','<p>Постройки и их персонал сохранятся на листе владельца. Общие ходы с деревней прекратятся.</p>'))await unlinkBastion(doc,id);
    }else if(cmd==='resolveTurn'){
     const choice=await form('Проверка общего хода','<p>Это восстановление после прерывания соединения. Сначала проверьте прогресс, ремонт и награды на листах Оплотов. Повторно приказы запускаться не будут.</p>'+select('apply','Учёт деревни',{'yes':'Учесть запланированный ход деревни','no':'Оставить деревню без изменений'}));if(choice){await finalizeTurn(doc,choice.get('apply')==='yes');await ensureClock();}
    }else if(cmd==='bastionSheet'||cmd==='bastionEdit'||cmd==='nativeCreate'){
     const a=game.actors.find(a=>a.uuid===id);if(!a||!(s.bastions??[]).includes(id))throw Error('Связанный владелец не найден.');
     if(cmd==='bastionSheet'){await a.sheet.render({force:true});a.sheet.changeTab?.('bastion','primary');}
     if(cmd==='bastionEdit'){
      const before=JSON.stringify(a.system.bastion),fd=await form('Оплот',input('name','Название',a.system.bastion.name)+textArea('description','Описание',plainHTML(a.system.bastion.description)));if(!fd)return;
      if(JSON.stringify(a.system.bastion)!==before)throw Error('Оплот изменён в другом окне. Откройте форму заново.');
      await a.update({'system.bastion.name':String(fd.get('name')).trim(),'system.bastion.description':'<p>'+esc(fd.get('description')).replace(/\n/g,'<br>')+'</p>'});
     }
     if(cmd==='nativeCreate'){
      const subtypes=Object.fromEntries(Object.entries(CONFIG.DND5E.facilities.types.basic.subtypes).map(([k,v])=>[k,game.i18n.localize(v)]));
      const fd=await form('Обычная постройка Оплота',input('name','Название','Новая постройка')+select('subtype','Назначение',subtypes)+'<p>Свободные стартовые постройки и последующее строительство учитывает D&D5e. Особые постройки добавляйте через штатный лист Оплота.</p>');if(!fd)return;
      const name=String(fd.get('name')).trim();if(!name)throw Error('Укажите название.');
      await a.createEmbeddedDocuments('Item',[{name,type:'facility',system:{type:{value:'basic',subtype:fd.get('subtype')},size:'cramped'}}]);
     }
    }else if(cmd.startsWith('native')){
     const item=requireFacility(doc,id);
     if(cmd==='nativeSheet')await item.sheet.render({force:true});
     if(cmd==='nativeOrder')await item.use({legacy:false,chooseActivity:true});
     if(cmd==='nativeDelete'&&await confirm('Удалить постройку Оплота?',`<p>«${esc(item.name)}» будет удалена и из деревни, и из листа владельца. Выполняемый приказ также исчезнет.</p>`))await item.delete();
     if(cmd==='nativeEdit'){
      const snapshot=()=>JSON.stringify([item.name,item.img,item.system.disabled,item.system.description.value]),before=snapshot();
      const fd=await form('Постройка Оплота',input('name','Название',item.name)+select('disabled','Состояние',{'no':'Целая / может работать','yes':'Повреждена / работа приостановлена'},item.system.disabled?'yes':'no')+textArea('description','Описание',plainHTML(item.system.description.value))+'<p>Строительство, размеры, особые правила и приказы доступны в полном листе постройки. Повреждения восстанавливаются по штатным правилам Оплота.</p>');if(!fd)return;
      if(snapshot()!==before)throw Error('Постройка изменена в другом окне. Откройте форму заново.');
      const name=String(fd.get('name')).trim();if(!name)throw Error('Укажите название.');
      await item.update({name,'system.disabled':fd.get('disabled')==='yes','system.description.value':'<p>'+esc(fd.get('description')).replace(/\n/g,'<br>')+'</p>'});
     }
     if(cmd==='nativeStaff'){
      const before=JSON.stringify([item.system.hirelings.value,item.system.defenders.value]);
      const choices=new Map(s.npcs.filter(n=>n.actorUuid).map(n=>[n.actorUuid,n.name]));
      for(const u of [...item.system.hirelings.value,...item.system.defenders.value])if(!choices.has(u))choices.set(u,fromUuidSync(u)?.name??u);
      if(!choices.size)throw Error('Сначала добавьте именных жителей и свяжите их с листами NPC.');
      const group=(key,label)=>`<fieldset><legend>${label} (максимум ${item.system[key].max??0})</legend>${[...choices].map(([u,name])=>`<label><input type="checkbox" name="${key}" value="${esc(u)}" ${item.system[key].value.includes(u)?'checked':''}>${esc(name)}</label>`).join('')}</fieldset>`;
      const fd=await form('Персонал Оплота',group('hirelings','Работники')+group('defenders','Защитники'));if(!fd)return;
      if(JSON.stringify([item.system.hirelings.value,item.system.defenders.value])!==before)throw Error('Персонал изменён в другом окне. Откройте форму заново.');
      const hirelings=fd.getAll('hirelings'),defenders=fd.getAll('defenders');
      if(hirelings.length>(item.system.hirelings.max??0)||defenders.length>(item.system.defenders.max??0))throw Error('Превышено число мест постройки.');
      const other=(s.bastions??[]).flatMap(u=>game.actors.find(a=>a.uuid===u)?.items.filter(i=>i.type==='facility'&&i.uuid!==id)??[]);
      if(hirelings.some(u=>other.some(i=>i.system.hirelings.value.includes(u))))throw Error('Работник уже назначен в другую постройку Оплота.');
      await item.update({'system.hirelings.value':hirelings,'system.defenders.value':defenders});
     }
    }else if(cmd==='note'){
     const old=s.log.find(l=>l.id===id);const fd=await form(old?'Изменить запись':'Запись в журнал деревни',textArea('text','Событие / заметка',old?.text??''));if(!fd)return;
     await save(x=>writeNote(x,id||uid(),fd.get('text')));
    }else if(cmd==='removeNote'){
     if(!await confirm('Удалить запись?','<p>Удалится только запись. Результат события или строительства сохранится.</p>'))return;
     await edit(x=>{if(id.startsWith('index:')){const i=Number(id.slice(6));if(!Number.isInteger(i)||i<0||i>=x.log.length)throw Error('Запись не найдена.');x.log.splice(i,1);}else{x.log=x.log.filter(l=>l.id!==id);}});
    }else if(cmd==='settings'){
     const fd=await form('Параметры поселения',input('name','Название',s.name)+input('population','Население',s.population,'number')+textArea('notes','Заметки',s.notes));if(!fd)return;
     await edit(x=>{x.name=String(fd.get('name')).trim();x.population=Number(fd.get('population'));x.notes=String(fd.get('notes'));});
    }else if(cmd==='building'){
     const b=s.buildings.find(b=>b.id===id)??{id:uid(),name:'Новая постройка',type:'house',condition:'intact',occupied:true,capacity:4,residents:0,owner:'',img:'',notes:'',posts:[],job:null};
     const fd=await form('Здание',input('name','Название',b.name)+select('type','Тип',TYPES,b.type)+select('occupied','Использование',{'yes':'Используется','no':'Пустует'},b.occupied?'yes':'no')+(s.schema===3?'':input('capacity','Вместимость жителей',b.capacity,'number')+input('residents','Жильцы, включая именных',b.residents,'number'))+input('owner','Владелец / группа (заметка)',b.owner)+textArea('notes','Описание',b.notes));if(!fd)return;
     await edit(x=>{const updated={...b,name:String(fd.get('name')).trim(),type:fd.get('type'),occupied:fd.get('occupied')==='yes',capacity:s.schema===3?b.capacity:Number(fd.get('capacity')),residents:s.schema===3?b.residents:Number(fd.get('residents')),owner:String(fd.get('owner')),img:b.img,notes:String(fd.get('notes'))};if(!id)updated.posts=[{id:uid(),title:ROLES[updated.type],npcId:''}];const index=x.buildings.findIndex(v=>v.id===id);if(index<0)x.buildings.push(updated);else x.buildings[index]=updated;});
    }else if(cmd==='npc'){
     const n=s.npcs.find(n=>n.id===id)??{id:uid(),name:'Новый житель',actorUuid:'',homeId:'',notes:''};
     const actorChoices={'':'Без листа персонажа',...Object.fromEntries(game.actors.map(a=>[a.uuid,a.name]))};if(n.actorUuid&&!actorChoices[n.actorUuid])actorChoices[n.actorUuid]='Связанный лист (вне списка)';
     const fd=await form('Именной житель',input('name','Имя',n.name)+select('actorUuid','Лист персонажа',actorChoices,n.actorUuid)+select('homeId','Дом',{'':'Не назначен',...Object.fromEntries(s.buildings.map(b=>[b.id,b.name]))},n.homeId)+textArea('notes','Заметки',n.notes)+'<p>Житель уже должен входить в общее население и число жильцов выбранного дома.</p>');if(!fd)return;
     await edit(x=>{const updated={...n,name:String(fd.get('name')).trim(),actorUuid:fd.get('actorUuid'),homeId:fd.get('homeId'),notes:String(fd.get('notes'))};const index=x.npcs.findIndex(v=>v.id===id);if(index<0)x.npcs.push(updated);else x.npcs[index]=updated;});
    }else if(cmd==='post'){
     if(s.schema===3)throw Error('Распределение должностей отключено.');
     const [bid,pid]=id.split(':'),b=s.buildings.find(b=>b.id===bid),p=b.posts.find(p=>p.id===pid)??{id:uid(),title:ROLES[b.type],npcId:''};
     const fd=await form('Должность',input('title','Название',p.title)+select('npcId','Кто занимает',{'':'Свободно',...Object.fromEntries(s.npcs.map(n=>[n.id,n.name]))},p.npcId));if(!fd)return;
     await edit(x=>{const b=x.buildings.find(b=>b.id===bid),updated={id:p.id,title:String(fd.get('title')).trim(),npcId:fd.get('npcId')},index=b.posts.findIndex(v=>v.id===pid);if(index<0)b.posts.push(updated);else b.posts[index]=updated;});
    }else if(cmd==='removePost'){
     const [bid,pid]=id.split(':');if(!await confirm('Удалить должность?','<p>Назначенный житель останется в деревне.</p>'))return;
     await edit(x=>{const b=x.buildings.find(b=>b.id===bid);b.posts=b.posts.filter(p=>p.id!==pid);});
    }else if(cmd==='removeNpc'){
     if(!await confirm('Убрать именного жителя?','<p>Его должность освободится. Общее население и число жильцов сохранятся.</p>'))return;
     await edit(x=>{x.npcs=x.npcs.filter(n=>n.id!==id);for(const b of x.buildings)for(const p of b.posts)if(p.npcId===id)p.npcId='';});
    }else if(cmd==='removeBuilding'){
     if(!await confirm('Удалить здание?','<p>Сначала переселите жильцов; активное строительство нужно завершить.</p>'))return;
     await edit(x=>{const b=x.buildings.find(b=>b.id===id);if(b.residents||(b.construction&&!b.construction.complete)||x.npcs.some(n=>n.homeId===id)||x.buildings.some(b=>b.job?.targetId===id))throw Error('У здания есть жители или незавершённые работы.');x.buildings=x.buildings.filter(b=>b.id!==id);});
    }else throw Error('Действие недоступно в простом управлении.');
   }
   await this.render({force:true});
  }catch(error){console.error('Мир Ортес | Поселения',error);ui.notifications.error(error.message);if(this.rendered)await this.render({force:true});}finally{this.busy=false;}
 }
}
let app;
function openVillages(){if(!game.user.isGM)return openDevelopment();app??=new VillageApp();return app.render({force:true});}
Hooks.once('init',()=>{game.settings.registerMenu(MOD,'villages',{name:'Поселения Ортеса',label:'Открыть управление',hint:'Здания, жители, журнал и связь со штатными Оплотами D&D5e.',icon:'fa-solid fa-house-chimney',type:VillageApp,restricted:true});});
function refreshVillages(){if(app?.rendered&&!app.busy)void app.render({force:true});}
Hooks.once('ready',async()=>{globalThis.OrtesWorld={...(globalThis.OrtesWorld??{}),openVillages};game.modules.get(MOD).api??={};game.modules.get(MOD).api.villages={open:openVillages,remove:deleteVillage};installBridge({commit:commitVillage,refresh:refreshVillages});installDevelopment({commit:commitVillage});installOrtesClock({commit:commitVillage,flush:async()=>{await flushDevelopment();await queue.catch(()=>{});},nativeAdvance:nativeFacilityAdvance,refresh:()=>{refreshVillages();refreshCalendar();refreshDevelopment();}});enableSimpleClock({advance:days=>advanceCalendar(days,{expected:publicClock().revision})});try{await ensureWesterholm();await ensurePrivateStorage();await bootClock();await refreshWesterholmContent();if(game.user.isGM&&game.users.activeGM?.id===game.user.id)for(const d of settlementEntries().filter(d=>d.getFlag(MOD,'village')?.schema===3))await publishDevelopment(d,d.getFlag(MOD,'village'));refreshVillages();}catch(e){console.error('Ortes initialization',e);ui.notifications.error('Поселения: '+e.message);}});
for(const event of ['createItem','updateItem','deleteItem','updateActor','deleteActor','updateJournalEntry','deleteJournalEntry'])Hooks.on(event,refreshVillages);
Hooks.on('getSceneControlButtons',controls=>{if(controls.tokens)controls.tokens.tools.ortesVillage={name:'ortesVillage',title:'Мир Ортес — Поселения',icon:'fa-solid fa-house-chimney',order:100,button:true,visible:true,onChange:openVillages};});

export async function deleteVillage(id,expected){
 await flushDevelopment();
 const task=queue.catch(()=>{}).then(async()=>{
  requireWriter();const doc=settlementById(id),s=doc?.getFlag(MOD,FLAG);
  if(!s||doc.getFlag(MOD,'villageDeleted')===true)throw Error('Поселение уже удалено.');
  if(s.revision!==expected)throw Error('Поселение изменилось. Обновите окно.');
  if(s.syncPending||s.development?.pendingPayment||calendarAdvancing()||calendarStatus()?.pending)throw Error('Сначала завершите текущий ход или расчёт.');
  for(const d of [...game.journal].filter(d=>d.id===id||d.getFlag(MOD,'privateStateReference')===id||d.getFlag(MOD,'developmentPublic')?.villageId===id))await d.delete();
  await doc.update({[`flags.${MOD}.villageDeleted`]:true});
  refreshVillages();refreshDevelopment();
 });queue=task;return task;
}
export async function refreshWesterholmContent(){
 if(!game.user.isGM||game.users.activeGM?.id!==game.user.id)return;
 for(const doc of settlementEntries().filter(d=>d.getFlag(MOD,'settlementSeed')==='westerholm')){
  const s=doc.getFlag(MOD,FLAG);
  if(s.westerholmContentVersion!==2)await commitVillage(doc,s.revision,x=>correctWesterholm(x,[...game.actors]));
  for(const journal of game.journal.filter(d=>d.id===doc.id||d.getFlag(MOD,'privateStateReference')===doc.id)){
   if(journal.getFlag(MOD,'westerholmPublicVersion')===1)continue;
   const page=journal.pages?.find(p=>p.id==='westerholmPage01'||p.name==='Вестерхольм и начальное состояние');
   if(page){await journal.updateEmbeddedDocuments('JournalEntryPage',[{_id:page.id,name:'Вестерхольм', 'text.content':WESTERHOLM_PAGE}]);await journal.setFlag(MOD,'westerholmPublicVersion',1);}
  }
 }
}

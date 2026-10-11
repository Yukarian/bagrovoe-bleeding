import {freshVillage,copy,validate,editVillage,startJob,cancelJob,previewWeek,undoWeek,RESOURCES,TYPES,CONDITIONS,ROLES,PRESETS} from './village-model.mjs';
import {esc,button,villageHTML,safeImage} from './village-view.mjs';
const MOD='bagrovoe-bleeding',FLAG='village';
const {ApplicationV2,DialogV2}=foundry.applications.api;
const uid=()=>foundry.utils.randomID();
const input=(name,label,value='',type='text')=>`<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" step="1"':'maxlength="1000"'}></label>`;
const select=(name,label,values,value='')=>`<label>${esc(label)}<select name="${name}">${Object.entries(values).map(([k,l])=>`<option value="${esc(k)}" ${String(k)===String(value)?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
const textArea=(name,label,value='')=>`<label>${esc(label)}<textarea name="${name}" maxlength="10000">${esc(value)}</textarea></label>`;
const budgets=(prefix,label,v={})=>`<fieldset><legend>${label}</legend>${Object.entries(RESOURCES).map(([k,l])=>input(prefix+k,l,v[k]??0,'number')).join('')}</fieldset>`;
const readBudget=(fd,prefix)=>Object.fromEntries(Object.keys(RESOURCES).map(k=>[k,Number(fd.get(prefix+k))]));
async function form(title,content){return DialogV2.wait({window:{title},position:{width:540},content:`<div class="ortes-form">${content}</div>`,buttons:[{action:'save',label:'Сохранить',default:true,callback:(_event,b)=>{if(!b.form.reportValidity())throw Error('Проверьте заполнение полей.');return new FormData(b.form);}},{action:'cancel',label:'Отмена',callback:()=>null}],rejectClose:false});}
async function confirm(title,content){return DialogV2.confirm({window:{title},content,defaultYes:false,rejectClose:false});}
function requireWriter(){if(!game.user.isGM||game.users.activeGM?.id!==game.user.id)throw Error('Изменения выполняет активный ведущий мира.');}
let queue=Promise.resolve();
// One writer, serialized local operations and revision checks prevent double charging.
export function commitVillage(doc,expected,transform){
 const task=queue.catch(()=>{}).then(async()=>{requireWriter();const state=copy(doc.getFlag(MOD,FLAG));if(state.revision!==expected)throw Error('Деревня уже изменена. Обновите окно и повторите действие.');const next=validate(transform(state));await doc.update({name:next.name,[`flags.${MOD}.${FLAG}`]:next});return next;});queue=task;return task;
}
async function settlementFolder(){
 let root=game.folders.find(f=>f.type==='JournalEntry'&&f.name==='Мир Ортес'&&!f.folder);
 root??=await Folder.create({name:'Мир Ортес',type:'JournalEntry',color:'#35564a'});
 let child=game.folders.find(f=>f.type==='JournalEntry'&&f.name==='Поселения'&&f.folder?.id===root.id);
 child??=await Folder.create({name:'Поселения',type:'JournalEntry',folder:root.id,color:'#35564a'});return child;
}
export class VillageApp extends ApplicationV2{
 static DEFAULT_OPTIONS={id:'ortes-villages',classes:['ortes-villages'],window:{title:'Мир Ортес — Поселения',icon:'fa-solid fa-house-chimney',resizable:true},position:{width:980,height:760}};
 selected=null;snapshot=null;busy=false;
 async _renderHTML(){
  if(!game.user.isGM)return '<p>Управление поселениями доступно ведущему.</p>';
  const entries=game.journal.filter(d=>d.getFlag(MOD,FLAG));
  if(!entries.some(d=>d.id===this.selected))this.selected=entries[0]?.id??null;
  this.snapshot=this.selected?copy(game.journal.get(this.selected).getFlag(MOD,FLAG)):null;
  return `<div class="ortes-body">${villageHTML(this.snapshot,entries,this.selected)}</div>`;
 }
 _replaceHTML(result,content){content.innerHTML=result;
  content.querySelector('[data-village]')?.addEventListener('change',e=>{this.selected=e.target.value;this.render({force:true});});
  content.addEventListener('click',this.clickHandler??=e=>{const b=e.target.closest('[data-cmd]');if(b){e.preventDefault();void this.command(b.dataset.cmd,b.dataset.id);}});
 }
 async command(cmd,id){
  if(this.busy)return;this.busy=true;
  try{
   if(!game.user.isGM)throw Error('Требуются права ведущего.');
   if(cmd==='refresh'){await this.render({force:true});return;}
   if(cmd==='actor'){const n=this.snapshot.npcs.find(n=>n.id===id),a=await fromUuid(n.actorUuid);if(!a)throw Error('Связанный персонаж не найден.');await a.sheet.render({force:true});return;}
   requireWriter();
   if(cmd==='create'){
    const fd=await form('Новое поселение',input('name','Название','Новая деревня'));if(!fd)return;
    const s=validate(freshVillage(String(fd.get('name')).trim())),folder=await settlementFolder();
    const doc=await JournalEntry.create({name:s.name,folder:folder.id,ownership:{default:0},pages:[{name:'Управление поселением',type:'text',text:{content:'<p>Откройте «Мир Ортес — Поселения» в настройках модуля или кнопкой домика на панели токенов.</p>',format:1}}],flags:{[MOD]:{[FLAG]:s}}});this.selected=doc.id;
   }else{
    const s=copy(this.snapshot),doc=game.journal.get(this.selected);if(!doc||!s)throw Error('Выберите поселение.');
    const save=fn=>commitVillage(doc,s.revision,fn),edit=fn=>save(current=>editVillage(current,fn));
    if(cmd==='settings'){
     const fd=await form('Параметры поселения',input('name','Название',s.name)+input('population','Общее население (включая именных)',s.population,'number')+input('order','Порядок: 0–5',s.order,'number')+budgets('res','Запасы',s.resources)+budgets('up','Недельное содержание',s.upkeep)+textArea('notes','Заметки',s.notes));if(!fd)return;
     await edit(x=>{x.name=String(fd.get('name')).trim();x.population=Number(fd.get('population'));x.order=Number(fd.get('order'));x.resources=readBudget(fd,'res');x.upkeep=readBudget(fd,'up');x.notes=String(fd.get('notes'));});
    }else if(cmd==='building'){
     const b=s.buildings.find(b=>b.id===id)??{id:uid(),name:'Новая постройка',type:'house',condition:'intact',occupied:true,capacity:4,residents:0,owner:'',img:'',notes:'',posts:[],job:null};
     const fd=await form('Здание',input('name','Название',b.name)+select('type','Тип',TYPES,b.type)+select('condition','Состояние',CONDITIONS,b.condition)+select('occupied','Использование',{'yes':'Используется','no':'Пустует'},b.occupied?'yes':'no')+input('capacity','Вместимость жителей',b.capacity,'number')+input('residents','Жильцы, включая именных',b.residents,'number')+input('owner','Владелец Бастиона / группа игроков',b.owner)+input('img','Путь к изображению',b.img)+textArea('notes','Описание',b.notes));if(!fd)return;
     await edit(x=>{const updated={...b,name:String(fd.get('name')).trim(),type:fd.get('type'),condition:fd.get('condition'),occupied:fd.get('occupied')==='yes',capacity:Number(fd.get('capacity')),residents:Number(fd.get('residents')),owner:String(fd.get('owner')),img:safeImage(fd.get('img')),notes:String(fd.get('notes'))};if(!id)updated.posts=[{id:uid(),title:ROLES[updated.type],npcId:''}];const index=x.buildings.findIndex(v=>v.id===id);if(index<0)x.buildings.push(updated);else x.buildings[index]=updated;});
    }else if(cmd==='npc'){
     const n=s.npcs.find(n=>n.id===id)??{id:uid(),name:'Новый житель',actorUuid:'',homeId:'',notes:''};
     const actorChoices={'':'Без листа персонажа',...Object.fromEntries(game.actors.map(a=>[a.uuid,a.name]))};if(n.actorUuid&&!actorChoices[n.actorUuid])actorChoices[n.actorUuid]='Связанный лист (вне списка)';
     const fd=await form('Именной житель',input('name','Имя',n.name)+select('actorUuid','Лист персонажа',actorChoices,n.actorUuid)+select('homeId','Дом',{'':'Не назначен',...Object.fromEntries(s.buildings.map(b=>[b.id,b.name]))},n.homeId)+textArea('notes','Заметки',n.notes)+'<p>Житель уже должен входить в общее население и число жильцов выбранного дома.</p>');if(!fd)return;
     await edit(x=>{const updated={...n,name:String(fd.get('name')).trim(),actorUuid:fd.get('actorUuid'),homeId:fd.get('homeId'),notes:String(fd.get('notes'))};const index=x.npcs.findIndex(v=>v.id===id);if(index<0)x.npcs.push(updated);else x.npcs[index]=updated;});
    }else if(cmd==='post'){
     const [bid,pid]=id.split(':'),b=s.buildings.find(b=>b.id===bid),p=b.posts.find(p=>p.id===pid)??{id:uid(),title:ROLES[b.type],npcId:''};
     const fd=await form('Должность',input('title','Название',p.title)+select('npcId','Кто занимает',{'':'Свободно',...Object.fromEntries(s.npcs.map(n=>[n.id,n.name]))},p.npcId));if(!fd)return;
     await edit(x=>{const b=x.buildings.find(b=>b.id===bid),updated={id:p.id,title:String(fd.get('title')).trim(),npcId:fd.get('npcId')},index=b.posts.findIndex(v=>v.id===pid);if(index<0)b.posts.push(updated);else b.posts[index]=updated;});
    }else if(cmd==='removePost'){
     const [bid,pid]=id.split(':');if(!await confirm('Удалить должность?','<p>Назначенный житель останется в деревне. Приказ без работников приостановится.</p>'))return;
     await edit(x=>{const b=x.buildings.find(b=>b.id===bid);b.posts=b.posts.filter(p=>p.id!==pid);});
    }else if(cmd==='removeNpc'){
     if(!await confirm('Убрать именного жителя?','<p>Его должность освободится. Общее население и число жильцов сохранятся.</p>'))return;
     await edit(x=>{x.npcs=x.npcs.filter(n=>n.id!==id);for(const b of x.buildings)for(const p of b.posts)if(p.npcId===id)p.npcId='';});
    }else if(cmd==='removeBuilding'){
     if(!await confirm('Удалить здание?','<p>Сначала освободите дом и отмените связанные строительные работы.</p>'))return;
     await edit(x=>{const b=x.buildings.find(b=>b.id===id);if(b.residents||b.job||x.npcs.some(n=>n.homeId===id)||x.buildings.some(b=>b.job?.targetId===id))throw Error('У здания есть жители или незавершённые работы.');x.buildings=x.buildings.filter(b=>b.id!==id);});
    }else if(cmd==='job'){
     const b=s.buildings.find(b=>b.id===id),p=PRESETS[b.type]??{name:'Работы',weeks:1,cost:{},gain:{},note:''};
     const fd=await form('Приказ: '+b.name,input('name','Приказ',p.name)+input('weeks','Длительность, недель (1–52)',p.weeks,'number')+budgets('cost','Цена при назначении',p.cost)+budgets('gain','Получить по завершении',p.gain)+input('orderGain','Повысить порядок на (0–5)',p.orderGain??0,'number')+select('targetId','Ремонт / строительство: завершить здание',{'':'Не изменять здания',...Object.fromEntries(s.buildings.filter(x=>x.id!==id&&x.condition!=='intact').map(x=>[x.id,x.name]))})+textArea('note','Сюжетный результат',p.note??'')+'<p>Цена списывается сразу. Один приказ на здание. Отмена не возвращает ресурсы. Для строительства добавьте пустое разрушенное здание как заготовку и выберите его здесь.</p>');if(!fd)return;
     await save(x=>startJob(x,id,{name:String(fd.get('name')).trim(),remaining:Number(fd.get('weeks')),cost:readBudget(fd,'cost'),gain:readBudget(fd,'gain'),orderGain:Number(fd.get('orderGain')),targetId:fd.get('targetId'),note:String(fd.get('note'))}));
    }else if(cmd==='cancel'){
     if(!await confirm('Отменить приказ?','<p>Оплаченная цена не возвращается.</p>'))return;await save(x=>cancelJob(x,id));
    }else if(cmd==='week'){
     const preview=previewWeek(s);const totals=Object.entries(RESOURCES).map(([k,l])=>`${l}: ${s.resources[k]} → ${preview.state.resources[k]}`);
     if(!await confirm('Завершить неделю '+s.week+'?',`<ul>${[...preview.messages,...totals,`Порядок: ${s.order} → ${preview.state.order}`].map(v=>`<li>${esc(v)}</li>`).join('')}</ul><p>Календарь мира и листы персонажей не изменяются.</p>`))return;
     await save(x=>previewWeek(x).state);
    }else if(cmd==='undo'){
     if(!await confirm('Отменить последний недельный ход?','<p>Запасы, порядок, работы и здания вернутся к состоянию перед ходом.</p>'))return;await save(undoWeek);
    }
   }
   await this.render({force:true});
  }catch(error){console.error('Мир Ортес | Поселения',error);ui.notifications.error(error.message);}finally{this.busy=false;}
 }
}
let app;
function openVillages(){if(!game.user.isGM)return ui.notifications.warn('Управление поселениями доступно ведущему.');app??=new VillageApp();return app.render({force:true});}
Hooks.once('init',()=>{game.settings.registerMenu(MOD,'villages',{name:'Поселения Ортеса',label:'Открыть управление',hint:'Здания, жители, должности, запасы и приказы Бастиона.',icon:'fa-solid fa-house-chimney',type:VillageApp,restricted:true});});
Hooks.once('ready',()=>{globalThis.OrtesWorld={...(globalThis.OrtesWorld??{}),openVillages};game.modules.get(MOD).api??={};game.modules.get(MOD).api.villages={open:openVillages};});
Hooks.on('getSceneControlButtons',controls=>{if(controls.tokens)controls.tokens.tools.ortesVillage={name:'ortesVillage',title:'Мир Ортес — Поселения',icon:'fa-solid fa-house-chimney',order:100,button:true,visible:game.user.isGM,onChange:openVillages};});

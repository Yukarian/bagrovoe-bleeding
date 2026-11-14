import {DevelopmentApp} from './development-ui.mjs';
import {settlementEntries} from './village-storage.mjs';
import {developmentDoc,manageEvents} from './development-runtime.mjs';
import {eventDefinitions,eventRange,eventSettings,eventRepeatText,eventCount,eventLimit,eventEffectText} from './village-event-catalog.mjs';
import {CATEGORY,TRACKS,eligible} from './village-development.mjs';
import {publicClock} from './ortes-clock.mjs';
import {esc,button} from './village-view.mjs';
const MOD='bagrovoe-bleeding',Dialog=foundry.applications.api.DialogV2;
const field=(key,label,value,type='text')=>`<label>${label}<input name="${key}" type="${type}" value="${esc(value)}"></label>`;
const select=(key,label,options,value)=>`<label>${label}<select name="${key}">${Object.entries(options).map(([k,v])=>`<option value="${esc(k)}" ${k===value?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
const form=(title,html)=>Dialog.wait({window:{title},classes:['ortes-dialog'],position:{width:650},content:'<div class="ortes-form">'+html+'</div>',buttons:[{action:'save',label:'Сохранить',callback:(_,b)=>new FormData(b.form)},{action:'cancel',label:'Отмена',callback:()=>null}],rejectClose:false});
const condition=e=>[e.track?`${TRACKS[e.track].name}: завершено не менее ${e.min} этапов`:'Без требования к развитию',e.effects.days?'Нужен активный проект':'',e.effects.discount?'Нужен неоплаченный этап':''].filter(Boolean).join('. ');
const consequences=e=>['stock','materials','treasury'].some(k=>e.effects[k])?Object.entries({stock:'Припасы',materials:'Материалы',treasury:'Казна'}).filter(([k])=>e.effects[k]).map(([k,n])=>`${n}: ${e.effects[k]>0?'+':''}${e.effects[k]}`).join('; '):eventEffectText(e);
export class VillageEventsApp extends DevelopmentApp{
 static DEFAULT_OPTIONS={id:'ortes-village-events',classes:['ortes-villages'],window:{title:'Мир Ортес — События деревни',icon:'fa-solid fa-scroll',resizable:true},position:{width:1000,height:800}};
 section='pending';search='';
 async _renderHTML(){
  if(!game.user.isGM)return '<p>Только ведущий.</p>';
  const choices=settlementEntries().filter(d=>d.getFlag(MOD,'village')?.schema===3);
  if(!choices.some(d=>d.id===this.selected))this.selected=choices[0]?.id;
  let html=`<div class="ortes-body"><header class="ortes-toolbar"><select data-village aria-label="Деревня">${choices.map(d=>`<option value="${esc(d.id)}" ${d.id===this.selected?'selected':''}>${esc(d.name)}</option>`).join('')}</select>${button('section','Ожидают решения','pending')}${button('section','Список событий','catalog')}${button('section','История','history')}</header>`;
  if(!this.selected)return html+'<p>Сначала создайте поселение.</p></div>';
  const s=developmentDoc(this.selected).getFlag(MOD,'village'),settings=eventSettings(s);
  html+=`<h2>${esc(s.name)} — события</h2><p>Только ведущий. Автоматически: ${settings.mode==='table'?'таблица к100':'категории к20'} каждые ${settings.interval} дн. Перерыв: ${settings.cooldown} дн.</p><div class="ortes-actions">${button('eventSettings','Настройки бросков')}${button('rollTable','Бросить к100 сейчас')}${button('newEvent','Добавить событие')}</div>`;
  if(s.lastEventRoll)html+=`<p>Последний к100: <strong>${s.lastEventRoll.roll}</strong> — ${esc(s.lastEventRoll.reason)}</p>`;
  if(this.section==='catalog'){
   html+=`<p>Диапазоны относятся к к100. Не занятые числа — без события. 0–0 — только ручной вызов. В режиме к20 используются категории, а не эти диапазоны.</p><input data-search aria-label="Поиск событий" placeholder="Поиск по названию и описанию" value="${esc(this.search)}">`;
   for(const e of eventDefinitions(s).filter(e=>(e.title+' '+e.text).toLocaleLowerCase().includes(this.search.toLocaleLowerCase()))){const [a,b]=eventRange(s,e.id);html+=`<details class="ortes-row"><summary><strong>${esc(e.title)}</strong><span>${a?`${a}–${b}`:'Вручную'} · ${esc(eventRepeatText(s,e))}</span></summary><div class="ortes-row-content"><p>${esc(e.text)}</p><p><b>Последствия:</b> ${esc(consequences(e))}</p><p>${esc(condition(e))}. ${esc(CATEGORY[e.category])}.</p><p>${eligible(s,e)?'Можно вызвать вручную.':'Недоступно: условия, лимит или уже в очереди.'}</p>${button('editEvent','Изменить',e.id)}${button('callEvent','Вызвать',e.id)}${button('copyEvent','Создать копию',e.id)}</div></details>`;}
  }else{
   const history=this.section==='history',rows=history?[...s.eventHistory].reverse():s.developmentEvents;
   html+=`<p>${history?'История сохраняется при изменении текста, диапазонов и лимитов.':'Ручной вызов обходит срок между появлениями, но сохраняет условия, лимиты и защиту от дублей. Последствия — только после подтверждения.'}</p>`;
   html+=rows.map(e=>`<article class="ortes-row-content"><h3>${esc(e.title)}</h3><p>${esc({pending:'Ожидает решения',deferred:'Отложено',applied:'Применено',skipped:'Пропущено'}[e.status])} · день ${e.day}${e.roll!==null&&e.roll!==undefined?' · бросок '+e.roll:''}</p><p>${esc(e.text)}</p><p>${esc(e.result??consequences(e))}</p>${history?(e.moneyPending?button('eventMoney','Рассчитать выплату',e.id):''):button('apply','Применить',e.id)+button('defer','Отложить',e.id)+button('skip','Пропустить',e.id)}</article>`).join('')||'<p>Событий нет.</p>';
  }
  return html+'</div>';
 }
 _replaceHTML(html,content){const scroll=content.scrollTop;content.innerHTML=html;content.scrollTop=scroll;content.querySelector('[data-village]')?.addEventListener('change',e=>{this.selected=e.target.value;void this.render({force:true});});content.querySelector('[data-search]')?.addEventListener('change',e=>{this.search=e.target.value;void this.render({force:true});});content.onclick=e=>{const b=e.target.closest('[data-cmd]');if(b){e.preventDefault();void this.command(b.dataset.cmd,b.dataset.id);}};}
 async command(cmd,id){
  if(!game.user.isGM)return;if(this.busy)return;
  if(['apply','defer','skip','eventMoney'].includes(cmd))return super.command(cmd,id);
  this.busy=true;
  try{
   if(cmd==='section'){this.section=id;return;}
   const s=developmentDoc(this.selected).getFlag(MOD,'village'),rev=s.revision;
   if(cmd==='eventSettings'){
    const cfg=eventSettings(s),fd=await form('Броски событий',select('mode','Способ автоматического выбора',{legacy:'Прежние категории к20',table:'Моя таблица к100'},cfg.mode)+field('interval','Проверка каждые N игровых дней',cfg.interval,'number')+field('cooldown','Минимум дней между повторениями',cfg.cooldown,'number')+'<p>При изменении интервала следующая проверка отсчитывается от текущего дня. Бросок к100 сейчас всегда использует таблицу, даже в режиме к20.</p>');
    if(fd)await manageEvents(this.selected,'settings',Object.fromEntries(fd),rev);
   }else if(cmd==='callEvent'){
    await manageEvents(this.selected,'request',{key:id},rev);this.section='pending';
   }else if(cmd==='rollTable'){
    const roll=await new Roll('1d100').evaluate();await manageEvents(this.selected,'roll',{roll:roll.total},rev);this.section='pending';
   }else if(['editEvent','newEvent','copyEvent'].includes(cmd)){
    const original=eventDefinitions(s).find(e=>e.id===id),creating=cmd!=='editEvent';
    if(!creating&&!original)throw Error('Событие не найдено.');
    const e=original??{title:'Новое событие',text:'',category:'story',track:null,min:0,effects:{}};
    const [a,b]=creating?[0,0]:eventRange(s,id),limit=creating?-1:(eventLimit(s,e)??-1);
    const fd=await form(creating?'Создать событие':'Изменить событие',field('title','Название',cmd==='copyEvent'?e.title+' — копия':e.title)+`<label>Описание<textarea name="text" rows="5">${esc(e.text)}</textarea></label>`+select('category','Категория',CATEGORY,e.category)+field('from','Диапазон к100: от',a,'number')+field('to','Диапазон к100: до',b,'number')+field('limit','Максимум применений: -1 без ограничения, 0 выключено',limit,'number')+`<p>Уже применено: ${creating?0:eventCount(s,id)}. 0–0 в диапазоне означает только ручной вызов.</p>`+select('track','Требование к развитию',{'':'Нет',...Object.fromEntries(Object.entries(TRACKS).map(([k,v])=>[k,v.name]))},e.track??'')+field('min','Минимум завершённых этапов (0–5)',e.min,'number')+'<details><summary>Автоматические последствия</summary><p>Положительные числа добавляют, отрицательные вычитают. Срок или скидка задаются отдельно от ресурсов.</p>'+Object.entries({days:'Изменение срока текущего проекта, дней',discount:'Скидка на неоплаченный этап, зм',stock:'Изменение припасов',materials:'Изменение материалов',treasury:'Изменение казны, зм'}).map(([k,n])=>field(k,n,e.effects[k]??0,'number')).join('')+'</details><p>Изменения применяются к будущим появлениям. Уже ожидающие события и история сохраняют прежний текст и последствия. Чтобы заменить ожидающее событие, пропустите его и вызовите изменённое.</p>');
    if(fd){const data=Object.fromEntries(fd);data.key=creating?'custom-'+foundry.utils.randomID():id;data.effects=Object.fromEntries(['days','discount','stock','materials','treasury'].map(k=>[k,Number(fd.get(k))]));await manageEvents(this.selected,'edit',data,rev);this.section='catalog';}
   }
  }catch(e){ui.notifications.error(e.message);}finally{this.busy=false;await this.render({force:true});}
 }
}
let app;
export function openVillageEvents(id){if(!game.user.isGM)return;app??=new VillageEventsApp();if(id)app.selected=id;return app.render({force:true});}
for(const hook of ['createJournalEntry','updateJournalEntry','deleteJournalEntry'])Hooks.on(hook,()=>{if(app?.rendered&&!app.busy)void app.render({force:true});});

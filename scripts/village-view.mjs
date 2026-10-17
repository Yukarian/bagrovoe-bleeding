import {economyHTML} from './economy-view.mjs';
import {RESOURCES,TYPES} from './village-model.mjs';
import {consumption,income} from './village-simple.mjs';
import {dateLabel} from './ortes-date.mjs';
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const button=(cmd,label,id='')=>`<button type="button" data-cmd="${cmd}" data-id="${esc(id)}">${label}</button>`;
export function villageHTML(s,entries,selected,bastions=[],clock={day:0}){
 const options=entries.map(d=>`<option value="${esc(d.id)}" ${d.id===selected?'selected':''}>${esc(d.name)}</option>`).join('');
 const header=`<header class="ortes-toolbar"><select aria-label="Поселение" data-village>${options||'<option>Нет поселений</option>'}</select>${button('development','Развитие')}${button('calendar','Календарь')}<details class="ortes-menu"><summary>Ещё</summary>${button('create','＋ Поселение')}${button('refresh','Обновить')}${button('journal','Карта деревни')}${selected?button('deleteVillage','Удалить поселение'):''}</details></header>`;
 if(!s)return header+'<p>Выберите или создайте поселение.</p>';
 const npc=id=>s.npcs.find(n=>n.id===id)?.name??'';
 const row=b=>`<details class="ortes-row" data-row="${esc(b.id)}"><summary><strong>${esc(b.name)}</strong><span>${esc((b.posts??[]).map(p=>npc(p.npcId)).filter(Boolean).join(', ')||TYPES[b.type])}</span>${b.construction&&!b.construction.complete?'<em>Строится до '+esc(dateLabel(b.construction.end,clock.months))+'</em>':''}</summary><div class="ortes-row-content">${b.img?`<img class="ortes-building-image" src="${esc(safeImage(b.img))}" alt="">`:''}<p class="ortes-notes">${esc(b.notes)}</p><p>${s.schema!==3&&b.type==='house'?`Жильцы: ${b.residents} / ${b.capacity}. `:''}${esc(b.owner)}</p><ul>${(b.posts??[]).map(p=>`<li>${esc(p.title)}: ${esc(npc(p.npcId)||'не назначен')} ${s.schema===3?'':button('post','Изменить',b.id+':'+p.id)+button('removePost','Убрать',b.id+':'+p.id)}</li>`).join('')}</ul><div class="ortes-actions">${button('building','Изменить',b.id)}${s.schema===3?'':button('post','＋ NPC',b.id)}${button('removeBuilding','Удалить',b.id)}</div></div></details>`;
 const houses=s.buildings.filter(b=>b.type==='house'),others=s.buildings.filter(b=>b.type!=='house'),work=s.buildings.filter(b=>b.construction&&!b.construction.complete);
 return `${header}<section class="ortes-heading"><div><h2>${esc(s.name)}</h2><p>${esc(dateLabel(clock.day,clock.months))}</p></div>${button('settings','Параметры')}</section>
 ${s.schema===3?`<p class="ortes-economy">Население: <strong>${s.population}</strong> · Завершено этапов: <strong>${Object.values(s.development.tracks).flat().filter(p=>p.status==='complete').length}/20</strong>. ${button('development','Развитие деревни')}</p>`:` <div class="ortes-stats">${[['Население',s.population],...Object.entries(RESOURCES).map(([k,l])=>[l,s.resources[k]])].map(([l,v])=>`<div><strong>${v}</strong><span>${l}</span></div>`).join('')}</div>
 <p class="ortes-economy">За 7 дней: припасы <strong>+${income(s)} / −${consumption(s)}</strong> · итог ${income(s)-consumption(s)>=0?'+':''}${income(s)-consumption(s)}</p>
 ${s.shortage?`<p class="ortes-alert">Не хватает ${s.shortage.amount} припасов. Решение — за ведущим.</p>`:''}
`}
 ${s.schema===3?economyHTML(s):''}
 ${s.syncPending?`<p class="ortes-alert">Прежний ход Оплота прерван. ${button('resolveTurn','Проверить ход')}</p>`:''}
 ${work.length?`<p>Строится: ${work.map(b=>esc(b.name)+' — '+esc(dateLabel(b.construction.end,clock.months))).join('; ')}</p>`:''}
 ${(s.developmentEvents??s.pendingEvents??[]).length?`<p>${button('events','События на рассмотрении: '+(s.developmentEvents??s.pendingEvents).length)}</p>`:''}
 <h3>Оплоты ${button('linkBastion','＋ Связать')}</h3>${bastions.map(bastionHTML).join('')||'<p class="ortes-muted">Подключите Оплот персонажа. Его постройки и ресурсы остаются в листе владельца.</p>'}
 <h3>Ключевые здания <details class="ortes-menu"><summary>Добавить</summary>${s.schema===3?'':button('construct','Строительство')}${button('building','Готовое здание')}</details></h3>
 <div class="ortes-list">${others.map(row).join('')}</div>
 <details class="ortes-section" data-row="history"><summary>Журнал · ${s.log.length}</summary>${button('note','＋ Запись')}${[...s.log].reverse().map(l=>`<article class="ortes-log-entry"><p><strong>${l.day!==undefined?esc(dateLabel(l.day,clock.months)):'Неделя '+l.week}</strong> · ${esc(l.text)}</p>${l.manual?button('note','Изменить',l.id):''}${button('removeNote','Удалить','index:'+s.log.indexOf(l))}</article>`).join('')}</details>
`;
}
export function bastionHTML(b){
 if(b.missing)return `<section class="ortes-bastion"><p>${esc(b.name)}</p>${button('unlinkBastion','Отключить связь',b.uuid)}</section>`;
 return `<section class="ortes-bastion"><header><div><h4>${esc(b.name)}</h4><span class="ortes-muted">${esc(b.owner)}</span></div><details class="ortes-menu"><summary>Управление</summary>${button('bastionSheet','Открыть Оплот',b.uuid)}${button('bastionEdit','Описание',b.uuid)}${button('nativeCreate','＋ Обычная постройка',b.uuid)}${button('unlinkBastion','Отключить',b.uuid)}</details></header><div class="ortes-grid">${b.facilities.map(f=>`<article class="ortes-card"><h4>${esc(f.name)}</h4><p>${f.special?'Особая':'Обычная'} · ${esc(f.size)} · ${f.disabled?'Повреждена':f.built?'Готова':'Строится'}</p><p>${f.progress.max?`${esc(f.order||'Работа')}: ${f.progress.value}/${f.progress.max} дн.`:'Нет приказа'}</p><details><summary>Подробности</summary><p class="ortes-notes">${esc(f.description)}</p><p>Персонал ${f.hirelings.length}/${f.hirelingMax}: ${esc(f.hirelings.join(', ')||'нет')}</p><p>Защитники ${f.defenders.length}/${f.defenderMax}: ${esc(f.defenders.join(', ')||'нет')}</p>${button('nativeEdit','Изменить',f.uuid)}${button('nativeStaff','Персонал',f.uuid)}${button('nativeDelete','Удалить',f.uuid)}</details><div class="ortes-actions">${button('nativeSheet','Лист',f.uuid)}${button('nativeOrder','Приказ',f.uuid)}</div></article>`).join('')||'<p>Построек пока нет. Добавьте их в листе владельца.</p>'}</div></section>`;
}
export function safeImage(src){const s=String(src??'').trim();return /^(?:javascript|data|vbscript):/i.test(s)?'':s;}

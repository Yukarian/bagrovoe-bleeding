export const MONTHS=['Верналь','Флорен','Майрен','Юнар','Солар','Аврен','Сентир','Октар','Норвен','Декран','Нивар','Февран'];
export const SEASONS=['Весна','Лето','Осень','Зима'];
export function integer(n,min=0,max=100000000){if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(`Нужно целое число от ${min} до ${max}.`);return n;}
export function toDay({year,month,day}){integer(year,1,100000);integer(month,1,12);integer(day,1,30);return (year-1)*360+(month-1)*30+day-1;}
export function fromDay(day){integer(day,0,35999999);return {year:Math.floor(day/360)+1,month:Math.floor(day%360/30)+1,day:day%30+1};}
export function dateLabel(day,months=MONTHS){const d=fromDay(day);return `${d.day} ${months[d.month-1]}, ${d.year} г.`;}
export function monthCells(year,month){const start=toDay({year,month,day:1}),offset=start%7;return Array.from({length:Math.ceil((offset+30)/7)*7},(_,i)=>i<offset||i>=offset+30?null:start+i-offset);}
export function occurs(note,day){return note.annual?day>=note.day&&note.day%360===day%360:note.day===day;}
export function canSee(note,user){return user.isGM||note.visibility==='public'||note.author===user.id&&note.visibility==='pending';}
export function canEdit(note,user){return user.isGM||note.author===user.id&&!note.locked&&note.visibility!=='gm';}
export function validateNote(n){toDay(fromDay(n.day));if(!String(n.title??'').trim()||n.title.length>150||String(n.text??'').length>10000)throw Error('Нужны название до 150 и описание до 10000 символов.');if(!['public','pending','gm'].includes(n.visibility))throw Error('Неизвестная видимость.');return n;}
export function nearby(notes,day,user){return notes.filter(n=>canSee(n,user)).map(n=>({...n,next:n.annual?Math.max(n.day,day+((n.day%360-day%360+360)%360)):n.day})).filter(n=>n.next>=day).sort((a,b)=>a.next-b.next).slice(0,8);}

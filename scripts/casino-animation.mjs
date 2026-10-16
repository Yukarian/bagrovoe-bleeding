import {SYMBOLS} from './casino-model.mjs';
const now=()=>Number.isFinite(globalThis.game?.time?.serverTime)?game.time.serverTime:Date.now();
const MOD='bagrovoe-bleeding',seen=new Map();let loadedAt=now(),queue=Promise.resolve();
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function animationDuration(p){return p?.kind==='wheel'?Math.min(12000,2600+600*(p.path?.length??1)):p?.kind==='slots'?3400:2800;}
export function validPresentation(p){
 const dice=(ds,max)=>Array.isArray(ds)&&ds.length>0&&ds.length<=100&&ds.every(n=>Number.isInteger(n)&&n>=1&&n<=max);
 if(p?.kind==='slots')return dice(p.dice,6)&&p.dice.length===3&&Array.isArray(p.indices)&&p.indices.every(i=>[0,1,2].includes(i));
 if(p?.kind==='wheel')return Array.isArray(p.path)&&p.path.length>0&&p.path.length<=100&&p.path.every(t=>Array.isArray(t)&&t.length===2&&[1,2,3].includes(t[0])&&Number.isInteger(t[1])&&t[1]>=1&&t[1]<=10)&&typeof p.prize==='string';
 return p?.kind==='dice'&&[6,20].includes(p.sides)&&Array.isArray(p.rows)&&p.rows.length>0&&p.rows.length<=100&&p.rows.every(r=>typeof r.name==='string'&&dice(r.dice,p.sides));
}
// Stable identity makes a delayed journal update and a result-message render share one animation.
export function playCasinoAnimation(event){
 if(!event?.id||!validPresentation(event.presentation))return Promise.resolve();
 if(seen.has(event.id))return seen.get(event.id);
 if(!Number.isFinite(event.created)||event.created<loadedAt||now()-event.created>60000)return Promise.resolve();
 const task=queue.catch(()=>{}).then(()=>animate(event));queue=task;seen.set(event.id,task);
 // Bound memory without evicting any animation still queued or playing.
 void task.finally(()=>{if(seen.size>200)seen.delete(seen.keys().next().value);}).catch(()=>{});
 return task;
}
export function wheelSVG(){
 const radii=[[145,111],[106,73],[68,31]];
 return `<svg viewBox="0 0 320 320" role="img" aria-label="Три кольца Колеса фортуны">${radii.map(([r,inr],ring)=>`<g class="casino-ring" data-ring="${ring}" style="transform-origin:160px 160px">${Array.from({length:10},(_,i)=>{const point=(radius,a)=>[160+radius*Math.cos(a*Math.PI/180),160+radius*Math.sin(a*Math.PI/180)].join(',');const a=i*36-108,b=a+36,label=point((r+inr)/2,i*36-90).split(',');return `<path d="M${point(r,a)} A${r},${r} 0 0 1 ${point(r,b)} L${point(inr,b)} A${inr},${inr} 0 0 0 ${point(inr,a)} Z" fill="${i%2?'#36515c':'#27343e'}" stroke="#b49b62" stroke-width="1"/><text x="${label[0]}" y="${label[1]}" text-anchor="middle" dominant-baseline="central" fill="#f7e5b6" font-size="15">${i+1}</text>`;}).join('')}</g>`).join('')}<circle cx="160" cy="160" r="25" fill="#1a2229" stroke="#d4bb80"/><text x="160" y="168" text-anchor="middle" fill="#d4bb80" font-size="25">✦</text><path d="M150 5 L170 5 L160 25Z" fill="#ffe4a1"/></svg>`;
}
export function slotSymbol(n){const shapes=['','<path d="M10 36c-8-16 13-22 12-5s22 7 14-10" fill="none" stroke="#466b35" stroke-width="8" stroke-linecap="round"/><circle cx="35" cy="21" r="2" fill="#111"/>','<path d="M10 12Q16 3 24 9Q34 3 39 13Q41 22 35 29L32 43Q27 46 24 27Q20 45 16 43L13 28Q7 21 10 12" fill="#fffbea" stroke="#8b7963" stroke-width="2"/>','<ellipse cx="24" cy="28" rx="15" ry="13" fill="none" stroke="#b28420" stroke-width="7"/><path d="M16 10L22 4H29L34 10L25 20Z" fill="#54a6af" stroke="#94701e" stroke-width="2"/>','<path d="M19 3H29L31 10L38 8L44 16L39 22L44 29L39 38L31 36L28 44H19L17 36L9 38L4 29L9 23L4 16L10 8L17 10Z" fill="#95816a" stroke="#514439" stroke-width="2"/><circle cx="24" cy="24" r="8" fill="#e6d7b7" stroke="#514439" stroke-width="2"/>','<path d="M24 43L6 24C-5 8 15-1 24 13C34-1 53 8 42 24Z" fill="#a73f43" stroke="#692931" stroke-width="2"/>','<path d="M24 44V5M7 7V20Q7 27 24 27Q41 27 41 20V7M1 13L7 5L13 13M18 12L24 3L30 12M35 13L41 5L47 13" fill="none" stroke="#74433c" stroke-width="3" stroke-linejoin="round"/>'];return `<svg viewBox="0 0 48 48" aria-hidden="true">${shapes[n]}</svg><small>${esc(SYMBOLS[n])}</small>`;}
export function animationHTML(p){
 if(p.kind==='wheel')return `<div class="casino-spin-wheel">${wheelSVG()}</div><p class="casino-animation-status">Внешнее кольцо…</p>`;
 if(p.kind==='slots')return `<div class="casino-moving-reels">${p.dice.map((n,i)=>`<div class="casino-reel-window"><div class="casino-reel-strip" data-reel="${i}">${Array.from({length:31},(_,j)=>`<div class="casino-reel-symbol">${slotSymbol(j===30?n:(j%6)+1)}</div>`).join('')}</div></div>`).join('')}</div><p class="casino-animation-status">Барабаны вращаются…</p>`;
 return `<div class="casino-dice-tray">${p.rows.map(r=>`<section><h4>${esc(r.name)}</h4><div class="casino-dice-row">${r.dice.map(n=>`<div class="casino-tumbling-die ${p.sides===20?'d20':'d6'}" data-result="${n}"><span>?</span></div>`).join('')}</div></section>`).join('')}</div><p class="casino-animation-status">Кости брошены…</p>`;
}
async function animate(event){
 if(typeof document==='undefined')return;
 const p=event.presentation,duration=animationDuration(p),panel=document.createElement('section');
 panel.className='ortes-casino-animation';panel.setAttribute('role','region');panel.setAttribute('aria-label','Бросок казино');
 panel.innerHTML=`<header><strong>${esc(event.title??'Колесо фортуны')}</strong><small>Результат появится после анимации</small></header>${animationHTML(p)}`;
 document.body.append(panel);const animations=[];
 const motion=async(el,frames,ms)=>{if(!el?.animate){await wait(ms);return;}const a=el.animate(frames,{duration:ms,easing:'cubic-bezier(.15,.6,.2,1)',fill:'forwards'});animations.push(a);await Promise.race([a.finished.catch(()=>{}),wait(ms+250)]);};
 try{
  if(p.kind==='slots'){
   await Promise.all([...panel.querySelectorAll('[data-reel]')].map(async(el,i)=>{if(!p.indices.includes(i)){el.style.transform='translateY(-2400px)';return;}await motion(el,[{transform:'translateY(0)',filter:'blur(2px)'},{offset:.85,filter:'blur(1px)'},{transform:'translateY(-2400px)',filter:'blur(0)'}],2200+i*350);}));
   panel.querySelector('.casino-animation-status').textContent=p.dice.map(n=>SYMBOLS[n]).join(' · ');await wait(500);
  }else if(p.kind==='wheel'){
   const angles=[0,0,0],step=(duration-600)/p.path.length,status=panel.querySelector('.casino-animation-status');
   for(const [ring,number]of p.path){const i=ring-1,from=angles[i],target=(360-(number-1)*36)%360;angles[i]=from+720+((target-from%360+360)%360);status.textContent=['Внешнее','Среднее','Внутреннее'][i]+' кольцо…';await motion(panel.querySelector(`[data-ring="${i}"]`),[{transform:`rotate(${from}deg)`},{transform:`rotate(${angles[i]}deg)`}],step);status.textContent=`${['Внешнее','Среднее','Внутреннее'][i]} кольцо: ${number}`;}
   status.textContent=p.prize;await wait(600);
  }else{
   const dice=[...panel.querySelectorAll('[data-result]')];
   await Promise.all(dice.map(async(el,i)=>{const ms=1700+(i%6)*90;await motion(el,[{transform:'translate(-28px,-40px) rotate(-250deg) scale(.5)',opacity:0},{offset:.4,transform:'translate(10px,8px) rotate(100deg) scale(1.12)',opacity:1},{transform:'translate(0,0) rotate(0) scale(1)',opacity:1}],ms);el.querySelector('span').textContent=el.dataset.result;}));
   panel.querySelector('.casino-animation-status').textContent='Бросок завершён';await wait(650);
  }
 }finally{for(const a of animations)a.cancel();panel.remove();}
}
export async function broadcastCasinoAnimation(id,presentation,title){
 if(!validPresentation(presentation))return null;
 const event={id,presentation,title,created:now()};
 const pub=game.journal.find(d=>d.getFlag(MOD,'casinoPublic'));
 if(pub)await pub.setFlag(MOD,'casinoAnimation',event);
 await playCasinoAnimation(event);return event;
}
export function installCasinoAnimations(){
 Hooks.on('ready',()=>{loadedAt=now();});
 Hooks.on('updateJournalEntry',doc=>{const e=doc.getFlag(MOD,'casinoAnimation');if(doc.getFlag(MOD,'casinoPublic')&&e)void playCasinoAnimation(e).catch(console.error);});
 Hooks.on('renderChatMessageHTML',(message,html)=>{
  // Transport requests carry no visible chat text. Errors are still shown.
  if(message.getFlag(MOD,'casinoRequest')&&message.getFlag(MOD,'casinoHandled')!=='error'){html.style.display='none';return;}
  const event=message.getFlag(MOD,'casinoAnimation');if(!event||(!seen.has(event.id)&&(event.created<loadedAt||now()-event.created>60000)))return;
  html.style.visibility='hidden';void playCasinoAnimation(event).finally(()=>{html.style.visibility='';}).catch(console.error);
 });
}

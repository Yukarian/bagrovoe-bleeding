// Rule summaries and executable mechanics; no adventure prose or PDF assets are distributed.
export const GAMES={slots:'Игровые автоматы',hand:'Кости мёртвой руки',olida:'Щедрость Олидаммары',wheel:'Колесо фортуны'};
export const SYMBOLS=['','Червь','Зуб','Кольцо','Шестерня','Сердце','Вилы'];
const JACKPOTS=['','Оковы измерений','Свиток: превращение','Кольцо защиты','Булава кары','Зелье отличного лечения','Ожерелье огненных шаров'];
export const WHEEL=[
 ['none','none','none','mug','coin','tunic','potion','tentacle','trinket','next'],
 ['back','none','key','feather','coins2','sword','clover','bag','compass','next'],
 ['back','letter','crown','fox','coins3','ghost','grand','house','tongue','star']
];
export const PRIZES={none:'Нет приза',mug:'Напиток в баре',coin:'50 зм',tunic:'Памятная туника',potion:'Фляга святой воды',tentacle:'Щупальце свежевателя разума',trinket:'Случайная безделушка',key:'Портальный ключ',feather:'Перо Кваля: птица',coins2:'500 зм',sword:'Оружие +1 на выбор',clover:'Камень удачи',bag:'Сумка хранения',compass:'Портальный компас',letter:'Рекомендательное письмо Шемешки',crown:'Статус квазибога с малой сферой влияния (решение ведущего)',fox:'Цитриновая статуэтка: лиса (основа — ониксовая собака)',coins3:'5000 зм',ghost:'Бутылка с душой',grand:'Позолоченный аппарат Квалиша',house:'Документы на дом в портальном городе',tongue:'Один язык на выбор',star:'Дар удачи'};
export const freshCasino=()=>({schema:1,enabled:false,wallets:{},jackpots:[],table:null,claims:[],history:[],processed:{}});
const copy=x=>structuredClone(x);
export function integer(n,min=1,max=1000000){if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(`Введите целое число от ${min} до ${max}.`);return n;}
export function coinsAfter(input,gold){integer(gold,-10000000,10000000);const rates={pp:1000,gp:100,ep:50,sp:10,cp:1},before=Object.fromEntries(Object.keys(rates).map(k=>[k,integer(Number(input?.[k]??0),0,100000000)]));let sum=Object.entries(rates).reduce((v,[k,r])=>v+before[k]*r,0)-gold*100;if(sum<0)throw Error('Недостаточно монет.');if(!Number.isSafeInteger(sum))throw Error('Слишком большая сумма.');if(before.gp>=gold)return {...before,gp:before.gp-gold};const after={};for(const[k,r]of Object.entries(rates)){after[k]=Math.floor(sum/r);sum%=r;}return after;}
export function publicCasino(s){return {enabled:s.enabled,wallets:copy(s.wallets),table:s.table?{id:s.table.id,game:s.table.game,stake:s.table.stake,players:Object.keys(s.table.entries)}:null,history:copy(s.history),claims:s.claims.map(c=>({...c})),jackpots:[...s.jackpots]};}
export function slotMatch(dice){if(dice.length!==3||dice.some(d=>!Number.isInteger(d)||d<1||d>6))throw Error('Неверные барабаны.');const count={};for(const d of dice)count[d]=(count[d]??0)+1;const pair=Object.entries(count).find(([,n])=>n>=2);return pair?{symbol:Number(pair[0]),jackpot:pair[1]===3}:{modron:[...dice].sort().join(',')==='2,4,6'};}
export function handWinners(entries){const scores=entries.map(e=>({...e,total:e.dice.includes(1)?0:e.dice.reduce((a,b)=>a+b,0),bust:e.dice.includes(1)})),best=Math.max(0,...scores.map(e=>e.total));return {scores,winners:best?scores.filter(e=>e.total===best).map(e=>e.actor):[]};}
export async function transition(original,command,ctx){
 const s=copy(original),{action,actor}=command,c=command;const id=ctx.id,now=ctx.now;let gold=0;const results=[];
 const gm=()=>{if(!ctx.isGM)throw Error('Только ведущий.');};
 const wallet=(who=actor)=>s.wallets[who]??=( {chips:0,modron:false,lastWheel:null,slot:null} );
 const take=n=>{integer(n);const w=wallet();if(w.chips<n)throw Error('Недостаточно бритволистов.');w.chips-=n;};
 const add=(who,n)=>{const w=wallet(who);w.chips=integer(w.chips+n,0,100000000);};
 const claim=(text,who=actor)=>s.claims.push({id:id+':'+s.claims.length,actor:who,text,delivered:false});
 const log=text=>{s.history.push({id,actor:actor??null,text,time:now});s.history=s.history.slice(-100);results.push(text);};
 if(s.processed[id])throw Error('Этот запрос уже выполнен.');
 if(action==='enable'){gm();s.enabled=!!c.value;log(s.enabled?'Казино открыто.':'Казино закрыто.');}
 else if(action==='grant'){gm();add(actor,integer(c.amount));log(`Выдано ${c.amount} бритволистов.`);}
 else if(action==='delivered'){gm();const p=s.claims.find(x=>x.id===c.claim);if(!p||p.delivered)throw Error('Приз уже отмечен или не найден.');p.delivered=true;log('Ведущий отметил выдачу: '+p.text);}
 else {
  if(!s.enabled&&action!=='cancelTable')throw Error('Ведущий ещё не открыл казино.');
  if(['buy','sell'].includes(action)){integer(c.amount,1,100000);if(action==='buy'){gold=c.amount*10;add(actor,c.amount);}else{take(c.amount);gold=-c.amount*10;}log(`${action==='buy'?'Куплено':'Обменено на золото'} ${c.amount} бритволистов.`);}
  else if(action==='slots'){
   if(wallet().slot)throw Error('Сначала завершите предыдущий автомат.');take(1);const dice=await ctx.roll(6,3);
   if(wallet().modron){wallet().modron=false;wallet().slot={dice,id};log('Время модрона: выберите барабаны для одного переброса или оставьте результат.');}
   else await finishSlots(dice);
  }else if(action==='reroll'){
   const p=wallet().slot;if(!p||p.id!==c.round)throw Error('Автомат уже завершён.');if(!Array.isArray(c.indices)||new Set(c.indices).size!==c.indices.length||c.indices.some(i=>!Number.isInteger(i)||i<0||i>2))throw Error('Неверные барабаны.');const dice=[...p.dice];if(c.indices.length){const rolls=await ctx.roll(6,c.indices.length);c.indices.forEach((n,i)=>dice[n]=rolls[i]);}wallet().slot=null;await finishSlots(dice);
  }else if(action==='wheel'){
   const w=wallet();if(w.lastWheel!==null&&now-w.lastWheel<86400)throw Error('Колесо доступно раз в 24 игровых часа.');take(5);let ring=0,key,trail=[];
   for(let n=0;n<100;n++){const [d]=await ctx.roll(10,1);key=WHEEL[ring][d-1];trail.push(`${ring+1}:${d}`);if(key==='next')ring++;else if(key==='back')ring--;else break;}
   if(['next','back'].includes(key))throw Error('Слишком длинная серия переходов; ставка не списана.');w.lastWheel=now;const cash={coin:50,coins2:500,coins3:5000}[key];if(cash)gold=-cash;else if(key!=='none')claim(PRIZES[key]);log(`Колесо [${trail.join(' → ')}]: ${PRIZES[key]}${cash?' — зачислено в монеты персонажа':''}.`);
  }else if(action==='openTable'){
   gm();if(s.table)throw Error('Сначала завершите или отмените открытый стол.');if(!['hand','olida'].includes(c.game))throw Error('Неизвестный стол.');s.table={id,game:c.game,stake:c.game==='hand'?integer(c.stake,1,100000):0,dealerDice:c.game==='hand'?integer(c.dice,1,100):0,entries:{}};log('Приём ставок: '+GAMES[c.game]);
  }else if(action==='join'){
   const t=s.table;if(!t||t.id!==c.round)throw Error('Раунд сменился.');if(t.entries[actor])throw Error('Вы уже сделали ставку в этом раунде.');
   if(t.game==='hand'){integer(c.dice,1,100);take(t.stake);t.entries[actor]={dice:c.dice,stake:t.stake};}
   else{if(!c.bets||typeof c.bets!=='object'||Array.isArray(c.bets))throw Error('Укажите ставки.');const bets={};let total=0;for(const[k,v]of Object.entries(c.bets)){if(String(integer(Number(k),1,20))!==k)throw Error('Неверный номер.');bets[k]=integer(v,1,100000);total+=v;}take(total);t.entries[actor]={bets,stake:total};}log('Ставка принята. Выбор скрыт до броска.');
  }else if(action==='cancelTable'){
   gm();const t=table();for(const[a,e]of Object.entries(t.entries))add(a,e.stake);s.table=null;log('Стол отменён, все ставки возвращены.');
  }else if(action==='resolveTable'){
   gm();const t=table(),entries=Object.entries(t.entries);if(!entries.length)throw Error('Нет участников.');
   if(t.game==='olida'){const[d]=await ctx.roll(20,1);const payouts=[];for(const[a,e]of entries){const n=(e.bets[d]??0)*5;if(n)add(a,n);payouts.push(`${ctx.name(a)}: ставки ${Object.entries(e.bets).map(([k,v])=>`${k}×${v}`).join(', ')}; выплата ${n}`);}log(`Олидаммара: ${d}. ${payouts.join('; ')}.`);}
   else{const rows=[{actor:'dealer',dice:await ctx.roll(6,t.dealerDice)}];for(const[a,e]of entries)rows.push({actor:a,dice:await ctx.roll(6,e.dice)});const {scores,winners}=handWinners(rows),bank=t.stake*(entries.length+1),share=winners.length?Math.floor(bank/winners.length):0;for(const a of winners)if(a!=='dealer')add(a,share);log(`Мёртвая рука: ${scores.map(r=>`${r.actor==='dealer'?'Крупье':ctx.name(r.actor)} [${r.dice.join(', ')}] ${r.bust?'перебор (единица)':r.total}`).join('; ')}. Банк ${bank}; ${winners.length?'победители: '+winners.map(a=>a==='dealer'?'Крупье':ctx.name(a)).join(', ')+`, по ${share} фишек`:'все проиграли'}. Остаток неделимого банка остаётся казино.`);}
   s.table=null;
  }else throw Error('Неизвестное действие.');
 }
 s.processed[id]=true;return {state:s,gold,results};
 function table(){if(!s.table||s.table.id!==c.round)throw Error('Раунд уже завершён.');return s.table;}
 async function finishSlots(dice){const m=slotMatch(dice);let prize='Нет приза';if(m.modron){wallet().modron=true;prize='Время модрона: один переброс выбранных барабанов следующей игры';}else if(m.symbol){if(m.jackpot&&!s.jackpots.includes(m.symbol)){s.jackpots.push(m.symbol);prize='Джекпот: '+JACKPOTS[m.symbol];claim(prize);}else {switch(m.symbol){case 1:prize=`Ларвы: ${(await ctx.roll(3,1))[0]}`;break;case 2:prize=`Зубы: ${(await ctx.roll(4,1))[0]+1}`;break;case 3:prize='Золотое кольцо (стоимость 15 зм)';break;case 4:prize='Медная шестерня (стоимость 25 зм)';break;case 5:prize=`Получить ${(await ctx.roll(10,1))[0]} временных хитов`;break;case 6:prize=`Получить ${(await ctx.roll(6,1))[0]} урона огнём (учесть сопротивления и временные хиты)`;break;}claim(prize);}}log(`Автомат [${dice.map(n=>SYMBOLS[n]).join(' · ')}]: ${prize}.`);}
}

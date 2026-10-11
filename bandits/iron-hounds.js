
const MOD = "bagrovoe-bleeding";
const PACK = "iron-hounds";
const npc = [
  {name:"Рядовой Железных Гончих", cr:0.5, ac:16, hp:27, formula:"5d8+5", stats:[14,12,12,10,11,10], speed:30, traits:["Строевая выучка: один раз в ход +1к4 урона копьём, когда цель рядом с союзником.","Щитовая стойка: преимущество на спасброски от сбивания с ног при использовании щита."], attacks:[["Копьё","1d6+2","piercing",4],["Короткий меч","1d6+2","piercing",4]]},
  {name:"Арбалетчик Железных Гончих", cr:0.5, ac:14, hp:22, formula:"4d8+4", stats:[10,15,12,10,12,10], speed:30, traits:["Удобная позиция: +1к4 урона дальнобойной атакой, если в свой ход не перемещался.","Прикрывающий огонь: попавшая цель не совершает атаки по возможности до начала следующего хода арбалетчика."], attacks:[["Лёгкий арбалет","1d8+2","piercing",4],["Кинжал","1d4+2","piercing",4]]},
  {name:"Разведчик Железных Гончих", cr:0.5, ac:14, hp:24, formula:"5d8+5", stats:[10,16,12,11,13,10], speed:35, traits:["Ловкий отход: Отход или Рывок бонусным действием.","Точный выстрел: один раз в ход +2к6 урона при преимуществе либо при союзнике рядом с целью."], attacks:[["Короткий лук","1d6+3","piercing",5],["Короткий меч","1d6+3","piercing",5]]},
  {name:"Ветеран Железных Гончих", cr:1, ac:17, hp:45, formula:"7d8+14", stats:[16,12,14,10,12,11], speed:30, traits:["Мультиатака: две атаки мечом.","Опыт строевого боя: +1 к КД, пока в пределах 5 футов есть союзник.","Прикрывающая реакция: накладывает помеху на атаку по соседнему союзнику."], attacks:[["Длинный меч","1d8+3","slashing",5],["Алебарда","1d10+3","slashing",5]]},
  {name:"Гаррет Хольм", cr:2, ac:16, hp:60, formula:"8d8+24", stats:[17,12,16,10,11,13], speed:30, traits:["Мультиатака: две атаки булавой.","Жестокий надсмотрщик: +1к8 урона по цели, раненой в этом раунде.","Запугивающий рёв (перезарядка 5–6): спасбросок Мудрости Сл 11 в радиусе 10 футов; помеха на следующую атаку при провале.","Толчок щитом: попадание 1к4+3 дробящего урона, Сила Сл 13 либо состояние Сбитый с ног."], attacks:[["Тяжёлая булава","1d8+4","bludgeoning",5],["Толчок щитом","1d4+3","bludgeoning",5]]},
  {name:"Сайлас Вейн", cr:2, ac:15, hp:49, formula:"9d8+9", stats:[10,16,12,14,13,12], speed:30, traits:["Мультиатака: две атаки арбалетом или кинжалом.","Хитрый отход: Отход или Засада бонусным действием.","Выверенный выстрел: +3к6 урона один раз в ход при преимуществе или при союзнике рядом с целью.","Скользкий шаг (реакция): отступление на половину скорости после приближения противника."], attacks:[["Ручной арбалет","1d6+3","piercing",5],["Кинжал","1d4+3","piercing",5]]},
  {name:"Марта Грейвс", cr:3, ac:18, hp:68, formula:"9d8+27", stats:[16,12,16,11,13,14], speed:30, traits:["Мультиатака: две атаки длинным мечом.","Стена щитов: союзникам в 5 футах +1 к КД против дальнобойных атак.","Верная защитница (реакция): меняется местами с соседним союзником, принимая атаку на себя.","Командный окрик (перезарядка 5–6): два союзника в 30 футах перемещаются на половину скорости без провоцирования атак."], attacks:[["Длинный меч","1d8+3","slashing",5]]},
  {name:"Родерик Варн", cr:6, ac:18, hp:110, formula:"13d8+52", stats:[18,14,18,12,14,16], speed:30, traits:["Мультиатака: две атаки длинным мечом.","Закалённый командир: преимущество против Испуга.","Железная дисциплина: выбранным союзникам в 30 футах +1 к спасброскам против Испуга и Очарования.","Боевой расчёт: один раз в ход +1к8 урона по цели рядом с союзником Родерика.","Командный приказ (перезарядка 5–6): два союзника в 60 футах используют реакции, чтобы атаковать или переместиться на половину скорости.","Боевой натиск (1/день): лечение 1к10+11 хитов.","Парирование (реакция): +3 КД против одной рукопашной атаки."], attacks:[["Длинный меч","1d10+4","slashing",7],["Тяжёлый арбалет","1d10+2","piercing",5]]}
];
function hashId(name){ let h=2166136261; for(const c of name){h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;} return ("IH"+h.toString(36)).padEnd(16,"0").slice(0,16); }
const ranks = {0.5:100,1:200,2:450,3:700,6:2300};
function feat(name, detail){return {name,type:"feat",img:"icons/svg/book.svg",system:{description:{value:"<p>"+detail+"</p>"},type:{value:"monster"},activities:{}},effects:[]};}
function weapon([name,formula,damageType,bonus]){
 const ranged=/арбалет|лук/.test(name.toLowerCase());
 const id=hashId("activity-"+name+"-"+formula);
 return {name,type:"weapon",img:ranged?"icons/svg/target.svg":"icons/svg/sword.svg",
 system:{description:{value:"<p>Атака +"+bonus+"; "+formula+" "+damageType+".</p>"},type:{value:"simpleM"},equipped:true,identified:true,properties:[],activities:{
 [id]:{_id:id,type:"attack",name:"Атака",activation:{type:"action",value:1,override:true},attack:{ability:"",bonus:String(bonus),flat:true,type:{value:ranged?"ranged":"melee",classification:"weapon"}},damage:{includeBase:false,parts:[{number:1,denomination:6,bonus:"",types:[damageType],custom:{enabled:true,formula}}]},range:{override:true,units:"ft",value:ranged?80:5,long:ranged?320:null},target:{override:true,affects:{type:"creature",count:"1"}},consumption:{targets:[],scaling:{allowed:false}},uses:{spent:0,max:"",recovery:[]}}}}
 ,effects:[]};
}
function actor(n){
 const names=["str","dex","con","int","wis","cha"];
 const abilities=Object.fromEntries(names.map((k,i)=>[k,{value:n.stats[i],proficient:0,bonuses:{check:"",save:""}}]));
 const id=hashId(n.name);
 return {_id:id,name:n.name,type:"npc",img:"icons/svg/mystery-man.svg",system:{
  abilities,attributes:{ac:{calc:"flat",flat:n.ac},hp:{value:n.hp,max:n.hp,formula:n.formula},movement:{walk:n.speed,units:"ft"},senses:{units:"ft"},init:{ability:"dex"}},
  details:{type:{value:"humanoid",subtype:"человек"},alignment:"",cr:n.cr,xp:{value:ranks[n.cr]},biography:{value:"<h2>Железные Гончие</h2><p>"+n.traits.join("</p><p>")+"</p>"}},
  traits:{size:"med",languages:{value:["common"],custom:""}},currency:{pp:0,gp:0,ep:0,sp:0,cp:0},skills:{}
 },items:[...n.attacks.map(weapon),...n.traits.map(s=>feat(s.split(":")[0],s))],
 prototypeToken:{name:n.name,texture:{src:"icons/svg/mystery-man.svg"},disposition:-1,actorLink:false,width:1,height:1,bar1:{attribute:"attributes.hp"}},flags:{[MOD]:{ironHound:true}},effects:[]};
}
Hooks.once("ready", async()=>{
 if(!game.user.isGM)return;
 try{
  let pack=game.packs.get("world."+PACK);
  if(!pack){
   pack=await CompendiumCollection.createCompendium({name:PACK,label:"Железные Гончие | Разбойники",type:"Actor",package:"world"});
  }
  const existing=await pack.getIndex({fields:["name"]});
  for(const n of npc){
    if(existing.some(x=>x.name===n.name))continue;
    await Actor.createDocuments([actor(n)],{pack:pack.collection,keepId:true});
  }
  console.info("Железные Гончие: NPC проверены",pack.collection);
 }catch(error){console.error("Железные Гончие: ошибка импорта",error);ui.notifications?.error("Ошибка загрузки Железных Гончих. См. консоль.");}
});

// Authoring tool. Never reads or modifies a live Foundry world.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),yaml=require('js-yaml');
const root=path.resolve(__dirname,'..'),M='bagrovoe-bleeding',category='Отряд Раэсса Валира';
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8')),write=(p,v)=>fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');
const id=k=>crypto.createHash('sha256').update('ortes:raess-company:'+k).digest('hex').slice(0,16);
const all=read('packs-src/key-npcs.json'),base=all.find(a=>a.flags[M].raess),p=t=>`<p>${t}</p>`;
const data=[
 ['garrik-holt','Гаррик Хольт','Человек',4,18,95,'10d8 + 50',30,[18,12,20,11,13,14],['str','con'],{ath:1,prc:1,itm:1},'',0,'14_22_59-1','14_34_51','Воин с красным плащом и шрамом на лице. Говорит коротко, внимательно следит за дорогой и за людьми рядом.'],
 ['brenna-tark','Бренна Тарк','Дварф',3,19,85,'10d8 + 40',25,[18,10,18,10,14,11],['str','con'],{ath:1,prc:1},'',0,'14_23_38-4','14_31_01-4','Рыжеволосая воительница с тяжёлым щитом и молотом. Немногословна, упряма и заботится о безопасности спутников.'],
 ['rogan-klyk','Роган Клык','Полуорк',3,16,78,'12d8 + 24',35,[16,18,14,9,12,10],['str','dex'],{ath:1,ste:1,prc:1},'',0,'14_23_41-5','14_31_05-5','Подвижный полуорк с парными клинками и красным шарфом. Прямолинеен, нетерпелив, уважает смелость и честный разговор.'],
 ['eyden-morst','Эйден Морст','Полуэльф',4,15,66,'12d8 + 12',30,[9,14,12,18,14,11],['int','wis'],{arc:2,his:1,inv:1},'int',6,'14_23_28-3','14_30_59-3','Сереброволосый маг в тёмно-синей одежде. Любознателен, педантичен и предпочитает сначала разобраться в неизвестной магии.'],
 ['vespa-kern','Веспа Керн','Тифлинг',4,15,60,'11d8 + 11',30,[8,16,12,14,12,18],['con','cha'],{dec:1,arc:1,itm:1},'cha',6,'14_23_08-2','14_30_56-2','Тифлинг с фиолетовой кожей и спокойной улыбкой. Наблюдательна, иронична, ценит свободу выбора и умение договариваться.'],
 ['sylas-veyn-company','Сайлас Вейн','Лесной эльф',3,16,68,'11d8 + 22',35,[11,18,14,12,16,10],['dex','wis'],{prc:2,ste:1,sur:1},'',0,'14_23_44-6','14_31_08-6','Эльфийский лучник в зелёном плаще. Спокоен, терпелив и замечает следы, которые остальные проходят мимо.'],
 ['mirel-sorn','Мирель Сорн','Человек',3,16,72,'11d8 + 22',30,[10,12,14,12,18,14],['wis','cha'],{med:2,ins:1,rel:1},'wis',5,'14_23_47-7','14_31_10-7','Жрица в бело-синих одеждах со звёздчатым посохом. Мягка в общении, решительна перед чужой болью и не отказывает раненым в помощи.']
];
const icons={weapon:'icons/skills/melee/strike-sword-steel-yellow.webp',defense:'icons/svg/shield.svg',magic:'icons/svg/daze.svg',heal:'icons/svg/regen.svg',move:'icons/svg/wing.svg'};
const part=(n,d,type,bonus='')=>({number:n,denomination:d,bonus:String(bonus),types:[type],custom:{enabled:false,formula:''},scaling:{mode:'',number:0},modifiers:[]});
const act=(k,type='utility',activation='action')=>({_id:id(k),type,name:'',activation:{type:activation,value:1,override:true},consumption:{targets:[],spellSlot:false,scaling:{allowed:false}},duration:{units:'inst',concentration:false,override:true},range:{units:'self',override:true},target:{affects:{type:'self',count:'1'},template:{},prompt:false,override:true},uses:{max:'',spent:0,recovery:[]},effects:[],flags:{}});
const first=i=>Object.values(i.system.activities)[0];
function feat(a,key,name,text,type='utility',activation='action',icon='weapon'){
 const i={_id:id(a._id+key),name,type:'feat',img:icons[icon],effects:[],flags:{[M]:{companyFeature:true}},system:{identifier:key,type:{value:'monster'},source:{rules:'2024',custom:'Мир Ортес'},description:{value:p(text),chat:''},uses:{max:'',spent:0,recovery:[]},activities:{}}};
 if(type){const x=act(a._id+key+':use',type,activation);i.system.activities[x._id]=x;}a.items.push(i);return i;
}
function uses(i,n,recharge=false){i.system.uses={max:String(n),spent:0,recovery:recharge?[{period:'recharge',type:'recoverAll',formula:'5'}]:[{period:'lr',type:'recoverAll'}]};first(i).consumption.targets=[{type:'itemUses',target:'',value:'1'}];}
function target(x,feet,count='1'){x.range={units:'ft',value:String(feet),override:true};x.target={affects:{type:'creature',count},template:{},prompt:true,override:true};}
function attack(a,key,name,n,d,damage,bonus,range=5,long){const i=feat(a,key,name,`Атака +6; урон ${n}к${d} + ${bonus}. ${long?`Дистанция ${range}/${long}`:`Досягаемость ${range}`} футов.`,'attack');const x=first(i);target(x,range);if(long)x.range.long=String(long);x.attack={ability:'',bonus:'6',flat:true,type:{value:range>5?'ranged':'melee',classification:'weapon'},critical:{threshold:null}};x.damage={includeBase:false,parts:[part(n,d,damage,bonus)],critical:{bonus:''}};return i;}
function roll(a,key,name,text,formula,activation='reaction',count){const i=feat(a,key,name,text,'utility',activation,'defense');first(i).roll={formula,prompt:false,visible:true};if(count)uses(i,count);return i;}
function damage(a,key,name,text,n,d,damage){const i=feat(a,key,name,text,'damage','special');first(i).damage={parts:[part(n,d,damage)],critical:{allow:true}};target(first(i),5);return i;}
function heal(a,key,name,text,n,d,bonus,activation,count,targets=1){const i=feat(a,key,name,text,'heal',activation,'heal');uses(i,count);const x=first(i);if(targets>1)target(x,30,String(targets));x.healing=part(n,d,'healing',bonus);return i;}
function effect(i,name,statuses,changes){const e={_id:id(i._id+':effect'),name,img:i.img,type:'base',transfer:false,disabled:false,statuses,changes:[],duration:{},system:{magical:true,changes:changes.map(([key,value,type='override'],n)=>({_id:id(i._id+':change'+n),key,value,type,phase:'initial',priority:null}))},flags:{}};i.effects.push(e);return e;}
const actors=data.map(([slug,name,race,cr,ac,hp,formula,speed,stats,saves,skills,ability,level,art,token,bio])=>{
 const a=structuredClone(base);a._id=id(slug);a.name=name;a.items=[];a.effects=[];a.folder=null;a.flags={[M]:{keyNpc:true,namedNpc:true,raessCompany:true,category,sourceSlug:slug,contentVersion:'6.13.0'}};
 a.img=`modules/${M}/assets/raess-company/${slug}/portrait.png`;a.prototypeToken.name=name;a.prototypeToken.texture.src=`modules/${M}/assets/raess-company/${slug}/token.png`;a.prototypeToken.sight={...a.prototypeToken.sight,enabled:false,range:0};
 a.system.identifier=slug;a.system.details={...a.system.details,cr,type:{value:'humanoid',subtype:race,custom:'',swarm:''},biography:{public:p(bio),value:p(bio)}};
 a.system.attributes.ac={flat:ac,calcs:['natural'],formulas:[],override:null};a.system.attributes.hp={value:hp,max:hp,temp:0,formula};a.system.attributes.spellcasting=ability;a.system.attributes.spell={level};a.system.attributes.movement.speeds={walk:String(speed)};a.system.attributes.senses={units:'ft',ranges:{},special:''};
 for(const[k,v]of Object.entries(a.system.abilities)){v.value=stats[['str','dex','con','int','wis','cha'].indexOf(k)];v.proficient=saves.includes(k)?1:0;v.bonuses={check:'',save:''};}
 for(const[k,v]of Object.entries(a.system.skills)){v.value=skills[k]??0;v.bonuses={check:'',passive:''};}
 a.system.traits.languages={value:['common',...(/эльф/.test(race)?['elvish']:race==='Дварф'?['dwarvish']:race==='Полуорк'?['orc']:race==='Тифлинг'?['infernal']:[])],custom:'',communication:{}};
 a.system.spells=Object.fromEntries(Array.from({length:9},(_,j)=>['spell'+(j+1),{value:level?[4,3,level===5?2:3][j]??0:0,override:level?[4,3,level===5?2:3][j]??0:0}]));a.system.spells.pact={value:0,override:0};a.system.source={rules:'2024',custom:'Мир Ортес — спутники Раэсса'};
 const dir=path.join(root,'assets/raess-company',slug);fs.mkdirSync(dir,{recursive:true});
 for(const[k,time]of [['portrait',art],['token',token]]){const dest=path.join(dir,k+'.png');const source=path.join(process.env.COMPANY_ART_SOURCE||'D:/Downloads',`Изображение ChatGPT 28 окт. 2026 г., ${time}.png`);if(fs.existsSync(source))fs.copyFileSync(source,dest);else if(!fs.existsSync(dest))throw Error('Missing approved art '+source);}
 return a;
});
let [g,b,r,e,v,s,m]=actors,i,x;
attack(g,'greatsword','Двуручный меч',2,6,'slashing',4);feat(g,'multiattack','Мультиатака','Две атаки двуручным мечом. Нажмите атаку дважды; дополнительный урон эта карточка не наносит.');
i=feat(g,'battle-order','Боевой приказ','Один союзник в пределах 30 футов может потратить свою реакцию, переместиться на половину скорости и совершить одну атаку оружием. Перезарядка 5–6. Союзника перемещает ведущий, атаку делает из его листа.');target(first(i),30);uses(i,1,true);
heal(g,'veteran-endurance','Стойкость ветерана','Бонусным действием восстанавливает 2к10 + 4 хита. Один раз за долгий отдых.',2,10,4,'bonus',1);
roll(g,'intercept','Перехват удара','Когда союзник в пределах 5 футов получает урон, реакцией уменьшает этот урон на 1к10 + 3. Вычтите результат из одного пакета урона, минимум 0.','1d10 + 3');target(first(g.items.at(-1)),5);
attack(b,'warhammer','Боевой молот',1,8,'bludgeoning',4);feat(b,'multiattack','Мультиатака','Две атаки боевым молотом. Одну можно заменить Ударом щитом. Бросьте выбранные атаки отдельно.');
i=attack(b,'shield-bash','Удар щитом',1,4,'bludgeoning',4);i.system.description.value+=p('Заменяет одну атаку мультиатаки. Только после попадания цель делает спасбросок Силы Сл 14; при провале падает ничком.');x=act(i._id+':save','save','special');x.name='Спасбросок — только после попадания';target(x,5);x.save={ability:['str'],dc:{calculation:'',formula:'14'}};x.damage={parts:[],onSave:'none'};let ef=effect(i,'Ничком',['prone'],[]);x.effects=[{_id:ef._id,onSave:false}];i.system.activities[x._id]=x;
i=feat(b,'unbreakable-defense','Несокрушимая оборона','Бонусным действием получает 15 временных хитов. Они не складываются с другими временными хитами. Пока именно эти временные хиты остаются, скорость уменьшается на 10 футов. Ведущий применяет эффект «Оборона — скорость» и удаляет его при исчерпании либо замене этих временных хитов.','heal','bonus','defense');uses(i,1);first(i).healing={...part(0,0,'temphp'),custom:{enabled:true,formula:'15'}};effect(i,'Оборона — скорость',[],[['system.attributes.movement.speeds.walk',-10,'add']]);
feat(b,'protect-ally','Защитить союзника','Реакцией даёт помеху одной атаке против другого существа в пределах 5 футов. Объявите до броска и включите помеху для этой атаки; постоянный эффект не накладывается.','utility','reaction','defense');target(first(b.items.at(-1)),5);
attack(r,'paired-blades','Парные клинки',1,6,'piercing',4);feat(r,'multiattack','Мультиатака','Три атаки короткими мечами. Все три входят в действие, бонусное действие для третьей не требуется. Бросьте атаку трижды.');damage(r,'bloody-charge','Кровавый натиск','Один раз в свой ход после перемещения минимум на 15 футов по прямой перед попаданием: дополнительно 1к6 колющего урона. Бросайте только при выполнении условия; при критическом попадании кости удваиваются.',1,6,'piercing');feat(r,'breakthrough','Прорыв','Бонусным действием совершает Рывок или Отход. Выберите один вариант.','utility','bonus','move');i=feat(r,'relentless-endurance','Неукротимая живучесть','Если урон уменьшает хиты до 0, но не убивает мгновенно, вместо этого остаётся с 1 хитом. Один раз за долгий отдых. Ведущий подтверждает условие, расходует применение и устанавливает 1 хит. Это особенность без действия и без реакции.','utility','special','defense');uses(i,1);
i=attack(e,'arcane-impulse','Чародейский импульс',3,8,'force',0,90);first(i).attack.type.classification='spell';first(i).damage.parts[0].bonus='';i.system.description.value=p('Действием совершает дальнобойную атаку заклинанием +6 по существу в пределах 90 футов: 3к8 силового урона. Перезарядка 5–6; ячейка не требуется.');uses(i,1,true);
i=feat(v,'distorted-perception','Искажённое восприятие','Цель в пределах 60 футов: спасбросок Мудрости Сл 14. При провале помеха на атаки до конца следующего хода Веспы. Перезарядка 5–6. Ведущий удаляет эффект в конце нужного хода Веспы.','save','action','magic');target(first(i),60);uses(i,1,true);first(i).save={ability:['wis'],dc:{calculation:'spellcasting',formula:''}};first(i).damage={parts:[],onSave:'none'};ef=effect(i,'Искажённое восприятие',[],[['system.rolls.attack.mode',-1,'add']]);first(i).effects=[{_id:ef._id,onSave:false}];
i=feat(v,'reposition','Смена позиции','Бонусным действием телепортируется на расстояние до 15 футов. Два раза за долгий отдых.','teleport','bonus','move');uses(i,2);first(i).teleport={value:'15',units:'ft',override:true};
attack(s,'longbow','Длинный лук',1,8,'piercing',4,150,600);feat(s,'multiattack','Мультиатака','Две атаки длинным луком. Бросьте атаку дважды.');i=damage(s,'aimed-shot','Прицельный выстрел','Один раз в свой ход, если до попадания не перемещался в этом ходу: одна успешная атака луком наносит дополнительные 1к8 колющего урона. При критическом попадании кости удваиваются.',1,8,'piercing');target(first(i),150);first(i).range.long='600';
i=feat(s,'binding-arrow','Сковывающая стрела','После попадания стрелой цель делает спасбросок Силы Сл 14. При провале её скорость равна 0 до конца следующего хода Сайласа. Два раза за долгий отдых; расходуется только после выбранного попадания. Урон лука повторно не бросается. Ведущий удаляет эффект в конце нужного хода Сайласа.','save','special');target(first(i),600);uses(i,2);first(i).save={ability:['str'],dc:{calculation:'',formula:'14'}};first(i).damage={parts:[],onSave:'none'};ef=effect(i,'Сковывающая стрела',[],['walk','fly','swim','climb','burrow'].map(k=>['system.attributes.movement.speeds.'+k,0]));first(i).effects=[{_id:ef._id,onSave:false}];feat(s,'forest-cover','Лесное укрытие','Бонусным действием совершает Засаду, соблюдая обычные условия скрытности.','utility','bonus','move');
heal(m,'healing-wave','Целительная волна','Действием до трёх существ в пределах 30 футов восстанавливают 2к8 + 4 хита каждое. Один раз за долгий отдых. Выберите до трёх разных целей и примените результат к каждой один раз.',2,8,4,'action',1,3);
roll(m,'protective-prayer','Защитная молитва','Когда союзник в пределах 30 футов получает урон, реакцией уменьшает этот урон на 1к8 + 4, минимум до 0. Два раза за долгий отдых. Ведущий вычитает выпавшее число из одного пакета урона.','1d8 + 4','reaction',2);target(first(m.items.at(-1)),30);

// Use native 6.0.6 spell activities, with local Russian descriptions and no optional module links.
const native=path.resolve(root,process.env.DND5E_SOURCE||'../dnd5e','packs/_source/spells24');
const files=fs.readdirSync(native,{recursive:true}).filter(f=>f.endsWith('.yml'));
const spellDir=path.resolve(root,process.env.COMPANY_SPELL_SOURCE||'../../outputs/raess-source-review/spells');
const library=fs.readdirSync(spellDir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(spellDir,f),'utf8')));
const byId=new Map(library.map(i=>[i._id,i.name.replace(/\s*\[[^\]]*\]/g,'').trim()]));
const cleanText=t=>(t||'').replace(/@UUID\[([^\]]+)\](?:\{([^}]+)\})?/g,(_,uuid,label)=>label||byId.get(uuid.split('.').at(-1))||'соответствующий эффект').replace(/&(?:amp;)?[Rr]eference\{([^}]+)\}/g,'$1').replace(/\s*\[[A-Za-z][^\]]*\]/g,'');
const names={'ray-of-frost':'Луч холода','mage-hand':'Волшебная рука','scorching-ray':'Палящий луч','lightning-bolt':'Молния','charm-person':'Очарование личности','hypnotic-pattern':'Гипнотический узор','guidance':'Указание','spare-the-dying':'Пощада умирающему','healing-word':'Лечащее слово','cure-wounds':'Лечение ран','lesser-restoration':'Малое восстановление','prayer-of-healing':'Молебен лечения','spiritual-weapon':'Духовное оружие','mass-healing-word':'Массовое лечащее слово'};
const lists=[
 [e,['fire-bolt','ray-of-frost','mage-hand','shield','magic-missile','mage-armor','misty-step','scorching-ray','fireball','lightning-bolt','counterspell']],
 [v,['minor-illusion','fire-bolt','mage-hand','shield','charm-person','web','invisibility','hypnotic-pattern','slow']],
 [m,['sacred-flame','guidance','light','spare-the-dying','healing-word','cure-wounds','bless','lesser-restoration','prayer-of-healing','spiritual-weapon','mass-healing-word','revivify']]
];
const keys=new Set(['_id','type','name','sort','img','activation','consumption','description','duration','effects','range','target','uses','attack','damage','save','check','healing','roll','ability','dc','teleport']);
for(const[a,list]of lists)for(const key of list){
 const original=library.find(i=>i.type==='spell'&&i.system.identifier===key&&i.system.source?.rules==='2024');if(!original)throw Error('Missing 2024 '+key);
 const file=files.find(f=>path.basename(f)===key+'.yml');if(!file)throw Error('Missing native '+key);const n=yaml.load(fs.readFileSync(path.join(native,file),'utf8'));
 const spell={_id:id(a._id+':spell:'+key),name:names[key]||original.name.replace(/\s*\[[^\]]*\]/g,'').trim(),type:'spell',img:n.img,effects:[],flags:{[M]:{companySpell:true}},system:structuredClone(n.system)};
 const sys=spell.system;delete sys.preparation;sys.identifier=key;sys.sourceItem='';sys.source={rules:'2024',custom:'D&D 2024 / dnd5e 6.0.6'};sys.ability=a.system.attributes.spellcasting;sys.method=sys.level?'spell':'atwill';sys.prepared=1;sys.uses={max:'',spent:0,recovery:[]};sys.description={value:cleanText(original.system.description.value),chat:''};
 for(const e0 of n.effects??[]){const e=structuredClone(e0);delete e._stats;delete e._key;delete e.origin;e.flags={};e.disabled=false;e.name=spell.name;e.description='';e.img=spell.img;e.system??={};e.system.changes=(e.system.changes??[]).filter(c=>!/(flags\.|items\.|@classes|@scale)/.test(c.key+' '+c.value));spell.effects.push(e);}
 const activities={};for(const[k,x0]of Object.entries(sys.activities??{})){const x=Object.fromEntries(Object.entries(x0).filter(([k])=>keys.has(k)));x._id=k;x.flags={};x.img=spell.img;x.name={attack:'Атака',save:'Спасбросок',damage:'Урон',heal:'Лечение',utility:'Сотворить',summon:'Сотворить',teleport:'Телепортация'}[x.type]||spell.name;x.description={value:'',chatFlavor:''};if(typeof x.save?.ability==='string')x.save.ability=[x.save.ability];x.consumption??={targets:[],spellSlot:true};x.consumption.targets=[];x.consumption.spellSlot=!!sys.level&&x.consumption.spellSlot!==false;
 if(x.type==='summon'){
  x.type='utility';x.name='Сотворить — размещение вручную';sys.description.value+=p('Создаваемый образ или объект размещает ведущий. Отдельная библиотека призывов не требуется.');
 }
 if(['cast','forward','enchant','transform'].includes(x.type))throw Error('Unsupported '+key+' '+x.type);
 x.effects=(x.effects??[]).filter(e=>spell.effects.some(f=>f._id===e._id));activities[k]=x;}
 sys.activities=activities;
 if(['fire-bolt','ray-of-frost','sacred-flame'].includes(key))for(const x of Object.values(activities))for(const d of x.damage?.parts??[]){d.number=2;d.scaling={mode:'',number:0};}
 if(['magic-missile','scorching-ray'].includes(key)){
  const cast=first(spell);cast.name='Сотворить и бросить первый '+(key==='magic-missile'?'дротик':'луч');
  const repeat=structuredClone(cast);repeat._id=id(spell._id+':repeat');repeat.name='Остальные '+(key==='magic-missile'?'дротики':'лучи')+' — без ячейки';repeat.activation={type:'special',override:true};repeat.consumption.spellSlot=false;activities[repeat._id]=repeat;
  sys.description.value+=p('Первое применение расходует одну ячейку и бросает урон одного снаряда. Остальные снаряды бросаются отдельной кнопкой без ячейки: всего 3 на базовом круге, +1 за каждый круг выше. Распределите цели вручную. Не считайте повторные броски новым сотворением.');
 }
 if(key==='shield')spell.effects.forEach(e=>e.duration={value:1,units:'turns',expiry:'sourceStart'});
 if(key==='mage-armor'){spell.effects=[];first(spell).effects=[];}
 if(key==='guidance'){
  const cast=first(spell);cast.effects=[];
  for(const ef of spell.effects){const skill=ef.system.changes[0]?.key.split('.')[2];const label={acr:'Акробатика',ani:'Уход за животными',arc:'Магия',ath:'Атлетика',dec:'Обман',his:'История',ins:'Проницательность',itm:'Запугивание',inv:'Анализ',med:'Медицина',nat:'Природа',prc:'Внимательность',prf:'Выступление',per:'Убеждение',rel:'Религия',slt:'Ловкость рук',ste:'Скрытность',sur:'Выживание'}[skill]||skill;ef.name='Указание — '+label;const choice=structuredClone(cast);choice._id=id(spell._id+skill);choice.name=label;choice.effects=[{_id:ef._id}];activities[choice._id]=choice;}
  delete activities[cast._id];sys.description.value+=p('Выберите ровно одну кнопку навыка: +1к4 действует только на этот навык, а не на все проверки.');
 }
 if(key==='web'){
  const save=first(spell);const burning=act(spell._id+':burn','damage','special');burning.name='Горящая паутина — только при поджигании';burning.damage={parts:structuredClone(save.damage.parts),critical:{allow:false}};target(burning,60);activities[burning._id]=burning;
  save.name='Спасбросок в паутине — без ячейки';save.activation={type:'special',override:true};save.consumption.spellSlot=false;save.damage={parts:[],onSave:'none'};const webEffect=effect(spell,'Опутан паутиной',['restrained'],[]);save.effects=[{_id:webEffect._id,onSave:false}];
  const cast=act(spell._id+':cast');cast.name='Создать паутину';cast.consumption.spellSlot=true;cast.range={override:false};cast.target={override:false};cast.duration={override:false};activities[cast._id]=cast;
  sys.description.value+=p('Сначала «Создать паутину» расходует одну ячейку. Спасброски в области и урон только от подожжённой паутины — отдельные кнопки без повторного расхода. Освобождение из паутины и снятие состояния проверяет ведущий.');
 }
 if(key==='slow'){
  const repeat=structuredClone(first(spell));repeat._id=id(spell._id+':repeat');repeat.name='Повторный спасбросок в конце хода';repeat.activation={type:'special',override:true};repeat.consumption.spellSlot=false;repeat.effects=[];activities[repeat._id]=repeat;sys.description.value+=p('При успехе повторного спасброска ведущий снимает эффект. Повторный спасбросок не расходует ячейку.');
 }
 if(key==='spiritual-weapon'){
  const hit=act(spell._id+':attack','attack','bonus');hit.name='Атака оружия — без повторной ячейки';target(hit,5);hit.attack={ability:'',bonus:'6',flat:true,type:{value:'melee',classification:'spell'},critical:{threshold:null}};hit.damage={includeBase:false,parts:[part(1,8,'force',4)],critical:{bonus:''}};sys.activities[hit._id]=hit;
  sys.description.value+=p('После сотворения разрешена атака без дополнительного бонусного действия. В следующих ходах перемещение оружия до 20 футов и атака занимают бонусное действие. Дистанцию 5 футов измеряйте от оружия, а не от жрицы. При сотворении ячейкой 3-го круга замените 1к8 на 2к8. Концентрация обязательна (2024).');
 }
 // Fixed NPC AC already represents its normal protection; Mage Armor is not a stacking +3.
 if(key==='mage-armor')sys.description.value+=p('КД Эйдена 15 уже учитывает Магический доспех: 13 + Ловкость 2. Не добавляйте ещё 3 КД. Ячейка при сотворении расходуется обычным образом. Без доспеха базовая КД 12; измените фиксированную КД вручную при окончании эффекта.');
 for(const x of Object.values(sys.activities)){
  if(x.attack)x.attack.type.classification='spell';
  // A follow-up is not a new casting and must not restart concentration.
  if(sys.level&&!x.consumption.spellSlot)x.duration={units:'inst',concentration:false,override:true};
 }
 a.items.push(spell);
}
for(const a of actors)write('exports/'+a.system.identifier+'.json',a);
const retained=all.filter(a=>!a.flags[M].raessCompany);retained.find(a=>a.flags[M].raess).flags[M].category=category;
write('packs-src/key-npcs.json',[...retained,...actors]);write('exports/raess-valir.json',retained.find(a=>a.flags[M].raess));
const inline=t=>t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g,'<a href="$2">$1</a>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
function html(text){let out='',table=false,list=false;for(const line of text.split('\n')){
 if(line.startsWith('|')){if(!table){out+='<table>';table=true;}if(!/^\|[\s:|\-]+\|$/.test(line))out+='<tr>'+line.split('|').slice(1,-1).map(v=>'<td>'+inline(v.trim())+'</td>').join('')+'</tr>';continue;}
 if(table){out+='</table>';table=false;}if(line.startsWith('- ')){if(!list){out+='<ul>';list=true;}out+='<li>'+inline(line.slice(2))+'</li>';continue;}if(list){out+='</ul>';list=false;}if(line.trim())out+=p(inline(line));
 }return out+(table?'</table>':'')+(list?'</ul>':'');}
const sections=fs.readFileSync(path.join(root,'RAESS_COMPANY.md'),'utf8').split(/^## /m).slice(1);
const journal={_id:id('journal'),name:category,categories:[],ownership:{default:0},flags:{[M]:{raessCompany:true,category,contentVersion:'6.13.0'}},pages:sections.map((section,n)=>{const cut=section.indexOf('\n');return{_id:id('page:'+n),name:section.slice(0,cut),type:'text',sort:n*100000,title:{show:true,level:1},text:{format:1,content:html(section.slice(cut+1))},ownership:{default:0},flags:{}};})};
// Add stable document links to the private journal, never to public biographies.
journal.pages[0].text.content=p([retained.find(a=>a.flags[M].raess),...actors].map(a=>`@UUID[Compendium.${M}.key-npcs.Actor.${a._id}]{${a.name}}`).join(' · '))+journal.pages[0].text.content;
write('packs-src/key-npc-lore.json',[...read('packs-src/key-npc-lore.json').filter(j=>!j.flags?.[M]?.raessCompany),journal]);write('exports/raess-company-lore.json',journal);
console.log('Built seven companions with approved images. Existing combat data preserved.');

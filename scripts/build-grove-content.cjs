// Compact NPC authoring; native SRD data from the pinned D&D5e 6.0.6 checkout.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),yaml=require('js-yaml');
const root=path.resolve(__dirname,'..'),MOD='bagrovoe-bleeding',P=`modules/${MOD}/assets/`,clone=structuredClone;
const id=s=>crypto.createHash('sha256').update('ortes:grove:470:'+s).digest('hex').slice(0,16);
const packFile=path.join(root,'packs-src/key-npcs.json'),previous=JSON.parse(fs.readFileSync(packFile)).filter(a=>!a.flags[MOD].groveCouncil);
const base=previous.find(a=>a.flags[MOD].sourceSlug==='gharok-ineykoren');
const source=path.resolve(process.env.DND5E_SOURCE||'../dnd5e','packs/_source/spells');
const files=fs.readdirSync(source,{recursive:true}).filter(f=>f.endsWith('.yml'));
const clean=v=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['_key','_stats','folder','ownership'].includes(k)).map(([k,x])=>[k,clean(x)])):v;
const icon=s=>P+`icons/key-npcs/${s}.svg`;
const rows=[
 {slug:'saris-faelorn',name:'Сарис Фэйлорн',role:'Круг Моря; инженер',traits:'Холодный, расчётливый, гениальный. Видит город как живую систему воды и корней.',stats:[10,16,16,20,20,12],hp:128,ac:17,skills:['arc','inv','nat','per'],expert:['inv'],spells:['guidance','healing-word','dispel-magic','control-water','ice-storm','control-weather']},
 {slug:'mirella-daenel',name:'Мирелла Даэнель',role:'Круг Звёзд; верховная жрица',traits:'Спокойная, мистичная, фанатичная. Толкует знамения и ставит верность Мировому Древу выше удобства.',stats:[10,14,16,16,22,18],hp:136,ac:17,skills:['ins','med','per','rel'],expert:['rel'],spells:['guidance','healing-word','guiding-bolt','scrying','heal','sunburst']},
 {slug:'korven-lael',name:'Корвен Лаэль',role:'Круг Луны; глава разведки',traits:'Сдержанный, скрытный, с острым умом. Предпочитает узнать об угрозе прежде, чем она заметит Суйгу.',stats:[14,20,18,16,20,10],hp:152,ac:18,skills:['ins','per','ste','sur'],expert:['ste','per'],spells:['guidance','pass-without-trace','polymorph','heal','animal-shapes']},
 {slug:'siana-illior',name:'Сиана Иллиор',role:'Круг Земли; хозяйка урожая',traits:'Добрая, упрямая, честная. Заботится о полях, запасах и людях, которых совет может не замечать.',stats:[12,14,18,14,20,16],hp:136,ac:17,skills:['ani','ins','med','nat','sur'],expert:['nat'],spells:['guidance','healing-word','plant-growth','greater-restoration','heal','control-weather']},
 {slug:'ral-kann',name:'Рал’Канн',role:'Круг сохранения; воевода Стражи Леса',traits:'Грубый, прямолинейный, решительный. В первую очередь сохраняет жизни стражей и целостность леса.',stats:[20,14,20,12,20,12],hp:168,ac:19,skills:['ath','itm','per','sur'],expert:['ath'],spells:['guidance','entangle','freedom-of-movement','wall-of-thorns','heal','earthquake']}
];
const extra={
 'control-water':['Власть над водами','Концентрация до 10 минут: управляет свободной водой в кубе до 100 футов, создавая потоп, проход, перенаправляя течение или вызывая водоворот.'],
 'control-weather':['Управление погодой','Сотворение 10 минут, концентрация до 8 часов; постепенно меняет осадки, температуру и ветер в радиусе 5 миль. Требует открытого неба.'],
 'animal-shapes':['Превращение в животных','Концентрация до 24 часов: выбранные согласные существа в 30 футах превращаются в зверей не крупнее Большого с ПО до 4. Сохраняют личность и ментальные характеристики; не могут творить заклинания.']
};
function spell(a,key){let s=previous.flatMap(a=>a.items).find(i=>i.type==='spell'&&i.system.identifier===key);s=s?clone(s):clean(yaml.load(fs.readFileSync(path.join(source,files.find(f=>path.basename(f)===key+'.yml')),'utf8')));s._id=id(a._id+key);s.flags={[MOD]:{groveSpell:key}};s.system.identifier=key;s.system.ability='wis';s.system.method='spell';s.system.prepared=1;s.system.sourceItem='';delete s.system.preparation;
 if(extra[key]){const [name,text]=extra[key];s.name=name;s.system.description.value=`<p>${text}</p><details><summary>Полные правила — SRD</summary>${s.system.description.value.replace(/<section\b[^>]*>[\s\S]*?<\/section>/gi,'')}</details>`;}
 s.system.description.value=s.system.description.value.replace(/Лаэрин[а-я]*/g,a.name).replace(/1к4 \+ 7/g,'1к4 + модификатор Мудрости');
 for(const x of Object.values(s.system.activities||{})){x.consumption??={targets:[]};x.consumption.spellSlot=s.system.level>0&&x.consumption.spellSlot!==false;x.img=s.img;x.effects=(x.effects||[]).filter(e=>s.effects.some(v=>v._id===e._id));}
 a.items.push(s);
}
function feature(a,key,name,text,type='utility',activation='action',image='druid-casting'){
 const x={_id:id(a._id+key+'act'),type,name:'',activation:{type:activation,value:1,override:true},consumption:{targets:[],spellSlot:false,scaling:{allowed:false}},duration:{units:'inst',concentration:false,override:true},range:{units:'self',override:true},target:{affects:{type:'self',count:'1'},template:{},override:true,prompt:false},uses:{max:'',spent:0,recovery:[]},effects:[],flags:{},roll:{formula:'',visible:false,prompt:false}};
 const i={_id:id(a._id+key),name,type:'feat',img:icon(image),system:{identifier:key,description:{value:`<p>${text}</p>`,chat:''},type:{value:'monster',subtype:''},uses:{max:'',spent:0,recovery:[]},source:{book:'Мир Ортес — краткая авторская адаптация',rules:'2014'},activities:type?{[x._id]:x}:{}},effects:[],flags:{[MOD]:{groveFeature:true}}};a.items.push(i);return [i,x];
}
const part=(n,d,b,t)=>({number:n,denomination:d,bonus:String(b||''),types:[t],custom:{enabled:false,formula:''},scaling:{mode:'',number:0},modifiers:[]});
const limit=(i,x,n)=>{i.system.uses={max:String(n),spent:0,recovery:[{period:'lr',type:'recoverAll'}]};x.consumption.targets=[{type:'itemUses',target:'',value:'1'}];};
const actors=rows.map(row=>{
 const a=clone(base);a._id=id(row.slug);a.name=row.name;a.flags={[MOD]:{keyNpc:true,namedNpc:true,groveCouncil:true,briefSheet:true,sourceSlug:row.slug,category:'Круг Рощи',classLevel:16,contentVersion:'4.7.0'}};a.items=[];a.effects=[];a.system.identifier=row.slug;a.system.source={book:'Мир Ортес — Круг Рощи, краткие NPC',rules:'2014'};a.system.details.cr=12;a.system.details.level=0;a.system.details.type={value:'humanoid',subtype:'эльф',custom:'',swarm:''};
 a.system.details.biography={value:`<p><strong>${row.role}.</strong> ${row.traits}</p><p>Эльф, друид 16-го уровня. Сл ${8+5+(row.stats[4]-10)/2}, атака заклинанием +${5+(row.stats[4]-10)/2}. Ячейки 4/3/3/3/2/1/1/1. Короткая игровая адаптация; не полный перечень классовых умений.</p>`,public:`<p>${row.name}, член Круга Рощи Суйгу.</p>`};
 for(const [n,k]of ['str','dex','con','int','wis','cha'].entries()){a.system.abilities[k].value=row.stats[n];a.system.abilities[k].proficient=['int','wis'].includes(k)?1:0;}
 for(const [k,s]of Object.entries(a.system.skills)){s.value=row.expert.includes(k)?2:row.skills.includes(k)?1:0;s.bonuses={check:'',passive:''};}
 a.system.attributes.hp={value:row.hp,max:row.hp,temp:0,formula:`0d8 + ${row.hp}`};a.system.attributes.ac={flat:row.ac,calcs:['natural'],formulas:[],override:null};a.system.attributes.spell.level=16;a.system.attributes.hd={max:0,denomination:'d8',spent:0};a.system.attributes.movement.speeds={walk:'30'};a.system.traits.di.value=[];a.system.traits.dr.value=[];a.system.traits.ci.value=[];a.system.traits.languages={value:['common','elvish','druidic','sylvan'],custom:'',communication:{}};
 for(let n=1;n<=9;n++)a.system.spells['spell'+n]={value:[4,3,3,3,2,1,1,1,0][n-1],override:[4,3,3,3,2,1,1,1,0][n-1]};
 a.img=P+`portraits/grove/${row.slug}.png`;a.prototypeToken.name=row.name;a.prototypeToken.texture.src=P+`tokens/grove/${row.slug}.png`;
 const cls=clone(base.items.find(i=>i.type==='class'));cls._id=id(row.slug+'class');cls.name='Друид 16';cls.system.levels=16;cls.system.description.value='<p>Друид 16-го уровня; краткий лист NPC.</p>';a.items.push(cls);
 feature(a,'elven-traits','Эльфийская природа','Тёмное зрение 60 футов. Преимущество спасбросков от очарования; магия не может усыпить. Транс 4 часа.',null,'special','ancient-elf');
 const wild=clone(base.items.find(i=>i.system.identifier==='wild-shape'));wild._id=id(row.slug+'wild');wild.flags={[MOD]:{groveFeature:true}};a.items.push(wild);
 for(const s of row.spells)spell(a,s);
 return a;
});
const [s,m,k,l,r]=actors;
let [i,x]=feature(s,'tidal-push','Удар прилива','Трижды за продолжительный отдых: конус 30 футов, спасбросок Силы Сл 18. Провал — 6к8 дробящего урона и отталкивание на 15 футов; успех — половина урона без отталкивания.','save','action','call-lightning');limit(i,x,3);x.target={template:{type:'cone',size:'30',units:'ft'},affects:{type:'creature'},override:true,prompt:true};x.save={ability:['str'],dc:{calculation:'wis',formula:''}};x.damage={parts:[part(6,8,0,'bludgeoning')],onSave:'half'};
feature(s,'water-engineer','Инженер живой воды','Дышит под водой, плавает со скоростью 40 футов. С преимуществом исследует водные сооружения и природные потоки; может за 10 минут выявить безопасный способ устранить обычный засор или утечку.',null);s.system.attributes.movement.speeds.swim='40';
[i,x]=feature(m,'star-arrow','Звёздная стрела','Бонусным действием совершает дальнюю атаку заклинанием +11 в пределах 60 футов; 2к8 + 6 излучением. Краткая авторская адаптация звёздной формы.','attack','bonus','sunburst');x.range={value:'60',units:'ft',override:true};x.target.affects={type:'creature',count:'1'};x.attack={ability:'wis',type:{value:'ranged',classification:'spell'},bonus:'',flat:false};x.damage={parts:[part(2,8,6,'radiant')],critical:{bonus:''}};
[i,x]=feature(m,'star-omen','Знамение звёзд','Реакция, пять раз за продолжительный отдых: добавляет или вычитает 1к6 из атаки, проверки или спасброска видимого существа в 30 футах, до объявления результата.','utility','reaction','dream-walker');limit(i,x,5);x.roll={formula:'1d6',visible:true,prompt:false};
const moon=k.items.find(i=>i.system.identifier==='wild-shape');moon.name='Лунный облик';moon.system.description.value='<p>Бонусным действием принимает облик знакомого зверя с ПО до 5 на срок до 8 часов. Два применения за короткий или продолжительный отдых. Использует хиты зверя, сохраняет концентрацию, не творит заклинания. Краткая адаптация Круга Луны.</p>';for(const a of Object.values(moon.system.activities)){a.activation={type:'bonus',value:1,override:true};for(const p of a.profiles)p.cr='5';}
feature(k,'silent-scout','Бесшумный дозор','Преимущество проверок Внимательности по слуху и запаху в зверином облике. Обычная лесная растительность не оставляет заметного следа его прохода; магическое обнаружение действует нормально.',null,'special','pass-without-trace');
[i,x]=feature(k,'moon-escape','Лунный уход','Реакция, трижды за продолжительный отдых: после получения урона перемещается до 15 футов без провоцирования атак.','utility','reaction','hidden-paths');limit(i,x,3);
[i,x]=feature(l,'harvest-balm','Бальзам урожая','Трижды за продолжительный отдых: бонусным действием лечит живое существо в 30 футах на 4к8 + 5 хитов. Не действует на нежить и конструктов.','heal','bonus','summer-balm');limit(i,x,3);x.range={value:'30',units:'ft',override:true};x.target.affects={type:'creature',count:'1'};x.healing=part(4,8,5,'healing');
feature(l,'keeper-of-fields','Хранительница полей','С преимуществом определяет болезни растений, качество почвы и причину неурожая. За час осмотра находит угрозу урожаю в пределах одной фермы; устранение магической порчи может потребовать отдельного заклинания.',null,'special','plant-growth');
[i,x]=feature(r,'forest-spear','Копьё Стражи','Две атаки копьём действием. Каждая: +10 к попаданию, досягаемость 5 футов, 2к8 + 5 колющего урона; атаки магические.','attack','action','root-staff');x.range={value:'5',units:'ft',override:true};x.target.affects={type:'creature',count:'1'};x.attack={ability:'str',type:{value:'melee',classification:'weapon'},bonus:'',flat:false};x.damage={parts:[part(2,8,5,'piercing')],critical:{bonus:''}};i.system.properties=['mgc'];
[i,x]=feature(r,'grove-guard','Покров рощи','Реакция, пять раз за продолжительный отдых: уменьшает урон видимому союзнику в 30 футах на 3к8 + 5, минимум до 0.','utility','reaction','moonlit-hearth');limit(i,x,5);x.roll={formula:'3d8 + 5',visible:true,prompt:false};
fs.writeFileSync(packFile,JSON.stringify([...previous,...actors],null,2)+'\n');
console.log('Grove:',actors.map(a=>`${a.name}: ${a.items.length} records`).join('; '));

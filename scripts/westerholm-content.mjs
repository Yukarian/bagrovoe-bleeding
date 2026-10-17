// Roles verified against the NPC biographies in the user's world, not the old settlement draft.
export const weeklySupplies=population=>Math.ceil(Math.max(0,Number(population)||0)/10);
export const RESIDENTS=[
 {id:'bran',name:'Бран Хольт',role:'Трактирщик',homeId:'house1',description:'Добродушный и наблюдательный хозяин таверны «Старый дуб». Знает почти всех в деревне и охотно беседует с посетителями.'},
 {id:'garret',name:'Гаррет Вейл',role:'Капитан стражи',homeId:'house9',description:'Бывший наёмник, обосновавшийся в деревне. Руководит четырьмя постоянными стражниками и заботится о безопасности жителей.'},
 {id:'ragna',name:'Рагна',role:'Кузнец',homeId:'house2',description:'Сильная и прямолинейная кузнечиха. Чинит инструменты, оружие, лодочную фурнитуру и металлические детали построек.'},
 {id:'torrek',name:'Торрек',role:'Главный рыбак',homeId:'house3',description:'Старейший действующий рыбак деревни. Хорошо знает местные воды, течения и повадки рыбы.'},
 {id:'mira',name:'Мира',role:'Лекарь',homeId:'house4',description:'Деревенская целительница. Разбирается в лекарственных травах и обработке ран, собирает растения в окрестностях.'},
 {id:'elvar',name:'Эльвар',role:'Смотритель святилища, друид',homeId:'house5',description:'Пожилой хранитель местных традиций. Проводит обряды, следит за природой вокруг поселения и помогает жителям своей магией.'},
 {id:'rikki',name:'Рикки',role:'Лавочник',homeId:'house6',description:'Общительный и предприимчивый кобольд. Торгует повседневными товарами и полезными мелочами.'},
 {id:'brena',name:'Брэна',role:'Плотник',homeId:'house7',description:'Практичная и крепкая мастер. Ремонтирует дома, лодки и причал, берётся за строительные работы.'},
 {id:'naya',name:'Ная Серый Хвост',role:'Охотница и проводник',homeId:'house8',description:'Свободолюбивая охотница. Знает окрестные леса, берега и звериные тропы.'}
];
const PLACES={
 hall:{name:'Дом старосты',type:'other',notes:'Здесь жители собираются для обсуждения общих дел и хранят деревенские документы.',role:'Староста'},
 tavern:{name:'Таверна «Старый дуб»',type:'tavern',npc:'bran',notes:'Таверна Брана Хольта принимает местных жителей и редких путников. За столами обсуждают новости и отдыхают после работы.'},
 smithy:{name:'Кузница',type:'smithy',npc:'ragna',notes:'В кузнице Рагны чинят инструменты и лодочную фурнитуру, куют металлические детали. Железа в деревне немного.'},
 granary:{name:'Общий амбар',type:'other',notes:'В общем амбаре хранят зерно и другие продовольственные запасы деревни.',role:'Кладовщик'},
 clinic:{name:'Лечебница',type:'clinic',npc:'mira',notes:'Здесь Мира принимает больных и раненых, сушит травы и готовит простые лекарства.'},
 mill:{name:'Мельница',type:'other',notes:'На мельнице перемалывают зерно для деревни.',role:'Мельник'},
 chapel:{name:'Святилище',type:'temple',npc:'elvar',notes:'Эльвар заботится о святилище и проводит обряды, связанные с природой и традициями деревни.'},
 carpentry:{name:'Плотницкая мастерская',type:'workshop',npc:'brena',notes:'В мастерской Брэны ремонтируют лодки, делают деревянные детали и готовят всё необходимое для починки домов и причала.'},
 manor:{name:'Особняк Альдена',type:'other',notes:'Старый особняк стоит на отдельном скалистом островке, соединённом с деревней мостом. Его двери закрыты.'},
 pier:{name:'Рыбацкий причал',type:'other',npc:'torrek',notes:'У причала стоят рыбацкие лодки и развешаны сети. Торрек и другие рыбаки выходят отсюда на промысел.'},
 shop:{name:'Лавка Рикки',type:'other',npc:'rikki',notes:'Небольшая лавка с повседневными товарами, инструментами и всевозможными полезными мелочами.'},
 watch:{name:'Пост стражи',type:'barracks',npc:'garret',notes:'Здесь собираются стражники Гаррета Вейла, прежде чем отправиться на обход деревни.'}
};
export function correctWesterholm(source,actors=[]){
 const s=structuredClone(source);if(s.westerholmContentVersion===1)return s;
 // Retain custom residents and all economic/construction state; replace only the invented storekeeper.
 s.npcs=s.npcs.filter(n=>!(n.id==='oren'&&n.name==='Орен'&&!n.actorUuid));
 for(const r of RESIDENTS){let n=s.npcs.find(n=>n.id===r.id);if(!n){n={id:r.id,homeId:r.homeId,actorUuid:''};s.npcs.push(n);}Object.assign(n,{name:r.name,profession:r.role,notes:r.description});const matches=actors.filter(a=>a.type==='npc'&&a.name===r.name);if(matches.length===1)n.actorUuid=matches[0].uuid;}
 for(const[id,p]of Object.entries(PLACES)){let b=s.buildings.find(b=>b.id===id);if(!b){if(!['pier','shop','watch'].includes(id))continue;b={id,condition:'intact',occupied:true,capacity:0,residents:0,owner:'Община Вестерхольма',img:'',job:null};s.buildings.push(b);}Object.assign(b,{name:p.name,type:p.type,notes:p.notes,posts:p.npc?[{id:id+'post',title:RESIDENTS.find(n=>n.id===p.npc).role,npcId:p.npc}]:p.role?[{id:id+'post',title:p.role,npcId:''}]:[]});}
 for(const b of s.buildings)for(const p of b.posts??[])if(!s.npcs.some(n=>n.id===p.npcId))p.npcId='';
 const oldHunter=s.buildings.find(b=>b.id==='house6');if(oldHunter){oldHunter.posts=oldHunter.posts.filter(p=>p.id!=='house6post');oldHunter.notes='Жилой дом Рикки.';}
 s.westerholmContentVersion=1;s.revision++;return s;
}
export const WESTERHOLM_PAGE=`<h1>Вестерхольм</h1><p>Небольшая прибрежная деревня у тихой бухты. Дороги огибают озеро, соединяя дома, огороды и мастерские. У воды стоят рыбацкие лодки; над берегом слышны удары молота из кузницы и голоса людей, занятых повседневными делами.</p><figure><img src="modules/bagrovoe-bleeding/assets/maps/westerholm.png" alt="Карта Вестерхольма"></figure><h2>Места деревни</h2><ul>${Object.values(PLACES).map(p=>`<li><strong>${p.name}.</strong> ${p.notes}</li>`).join('')}</ul><h2>Люди Вестерхольма</h2>${RESIDENTS.map(r=>`<h3>${r.name}</h3><p><strong>${r.role}.</strong> ${r.description}</p>`).join('')}`;

import {createHash} from 'node:crypto';

const MOD='bagrovoe-bleeding';
const id=value=>createHash('sha256').update(value).digest('hex').slice(0,16);
const rarities={common:'Обычные',uncommon:'Необычные',rare:'Редкие',veryRare:'Очень редкие',legendary:'Легендарные'};
export function category(pack,doc){
  if(pack==='key-npcs')return doc.flags[MOD].category;
  if(pack==='suigu-residents')return doc.flags[MOD].district;
  if(pack==='settlements')return doc.flags?.[MOD]?.village?'Шаблоны поселений':'Правила и помощь';
  if(pack==='actors'){
    if(doc.flags?.[MOD]?.namedNpc || ['edrik-valter','emili-yasati'].includes(doc.flags?.[MOD]?.sourceSlug))return 'Именные персонажи';
    return doc.system.details.type.value==='humanoid'?'Гуманоиды':'Звери и чудовища';
  }
  if(pack==='iron-hounds')return ['Родерик Варн','Марта Грейвс','Гаррет Хольм','Сайлас Вейн'].includes(doc.name)?'Командование':'Бойцы';
  if(pack==='blood-spells')return Number(doc.system.level)===0?'Заговоры':`${doc.system.level} уровень`;
  if(pack==='relics')return rarities[doc.system.rarities?.[0]]??'Прочие предметы';
  if(pack==='abilities'){
    if(doc.flags?.[MOD]?.spellKey)return 'Магия крови';
    const activities=Object.values(doc.system.activities??{});
    if(activities.some(a=>a.activation?.type==='reaction'))return 'Реакции';
    if(activities.some(a=>a.type==='attack')||/Мультиатака/i.test(doc.name))return 'Атаки';
    if(activities.length)return 'Особые действия';
    return 'Пассивные особенности';
  }
  throw Error(`No folder category for ${pack}`);
}

// Build-time only: preserve source document IDs and embedded item data.
export function organizePack(pack,source){
  const docs=structuredClone(source),folders=[];
  const groups=new Map();
  for(const doc of docs){
    const name=category(pack.name,doc);
    if(!groups.has(name)){
      const folder={_id:id(`${MOD}:${pack.name}:${name}`),name,type:pack.type,
        folder:null,sorting:'a',sort:folders.length*100000,color:'#782d38',flags:{}};
      groups.set(name,folder);folders.push(folder);
    }
    doc.folder=groups.get(name)._id;
  }
  return {docs,folders};
}

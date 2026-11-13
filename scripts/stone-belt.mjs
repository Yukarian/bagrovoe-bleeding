const MOD='bagrovoe-bleeding',LEGACY='7090427b794a4330',VERSION=1;
export const isStoneBelt=i=>i?.type==='equipment'&&(i.flags?.[MOD]?.stoneBelt||i.system?.identifier===LEGACY&&i.name==='Пояс каменной ярости');
const equipped=i=>isStoneBelt(i)&&i.system.equipped&&i.system.attuned&&Number(i.system.quantity??1)>0&&!i.areEffectsSuppressed;
const active=e=>!e.disabled&&!e.isSuppressed&&!e.duration?.expired;
const actorOf=x=>x.actor??x.item?.actor;
const error=e=>{console.error(MOD,e);ui.notifications.error('Пояс каменной ярости: '+e.message);};
export function hasRage(a){return a?.statuses?.has('raging')||a?.statuses?.has('rage')||[...(a?.appliedEffects??a?.effects??[])].some(e=>active(e)&&!e.flags?.[MOD]?.stoneRage&&(e.parent?.system?.identifier==='rage'||/^(?:ярость(?:\s*\[rage\])?|rage)$/i.test(e.name?.trim()??'')));}
export function stoneActive(a){return [...(a?.effects??[])].some(e=>active(e)&&e.flags?.[MOD]?.stoneRage&&Number(e.flags[MOD].expires)>Number(game.time.worldTime)&&a.items?.some(i=>i.id===e.flags[MOD].beltId&&equipped(i)));}
export function validateStoneUse(activity){
 if(!isStoneBelt(activity.item)||activity.id!=='7e762b185ff74f2a'&&activity._id!=='7e762b185ff74f2a')return;
 const a=actorOf(activity);let reason='';
 if(!a||!equipped(activity.item))reason='Наденьте пояс и настройтесь на него.';
 else if(!a.items.some(i=>i.type==='class'&&(i.system.identifier==='barbarian'||/^варвар$/i.test(i.name))))reason='Настройка требует класса варвара.';
 else if(!hasRage(a))reason='Сначала включите Ярость в листе, затем пробудите пояс при входе в неё.';
 else if(stoneActive(a))reason='Каменная ярость уже активна.';
 if(reason){ui.notifications.warn(reason);return false;}
}
const inFlight=new Map();
export async function activateStone(activity,config,results){
 if(!isStoneBelt(activity.item)||activity.id!=='7e762b185ff74f2a'&&activity._id!=='7e762b185ff74f2a'||!results?.message)return;
 const a=actorOf(activity);if(!a?.isOwner)return;
 if(inFlight.has(a.uuid))return inFlight.get(a.uuid);
 const operation=(async()=>{
  if(stoneActive(a))return;
  const key=results.message.id;if(a.effects.some(e=>e.flags?.[MOD]?.activation===key))return;
  const now=Number(game.time.worldTime);
  await a.createEmbeddedDocuments('ActiveEffect',[{name:'Каменная ярость',img:activity.item.img,type:'base',transfer:false,disabled:false,origin:activity.item.uuid,duration:{value:60,units:'seconds',expiry:'turnEnd'},statuses:[],changes:[],system:{magical:true,changes:[]},flags:{[MOD]:{stoneRage:true,beltId:activity.item.id,activation:key,expires:now+60}}}]);
 })();inFlight.set(a.uuid,operation);try{return await operation;}finally{inFlight.delete(a.uuid);}
}
export function stoneDamage(config){
 const x=config.subject,a=x&&actorOf(x);if(!x||x.type!=='attack'||x.item?.type!=='weapon'||!stoneActive(a))return;
 const mode=config.attackMode??'';
 const action=x.getActionType?.(mode)??(x.attack?.type?.value==='melee'&&x.attack?.type?.classification==='weapon'&&!mode.startsWith('thrown')&&mode!=='ranged'?'mwak':'');
 if(action!=='mwak'||x.item.system?.type?.baseItem==='unarmedstrike'||x.item.system?.identifier==='unarmed-strike')return;
 if(!config.rolls?.length||config.rolls.some(r=>r.options?.stoneBelt))return;
 const data={...config.rolls[0].data,roll:{...config.rolls[0].data?.roll,damageType:'bludgeoning'}};
 config.rolls.push({parts:['1d4'],data,options:{type:'bludgeoning',types:['bludgeoning'],properties:['mgc'],stoneBelt:true}});
}

// Upgrade only the identified legacy belt. Do not replace a character, its inventory, or custom items.
export async function repairStoneBelt(item,template){
 if(!isStoneBelt(item)||item.flags?.[MOD]?.stoneBeltVersion>=VERSION)return false;
 const backup=item.flags?.[MOD]?.stoneBeltBackup??item.toObject();
 const oldEffects=item.effects.map(e=>e.toObject());
 const effects=oldEffects.filter(e=>e._id!=='57281ba3a01d43e2'&&e.name!=='Пояс каменной ярости: Атлетика +1');effects.push(structuredClone(template.effects[0]));
 await item.update({[`flags.${MOD}.stoneBeltBackup`]:backup,[`flags.${MOD}.stoneBelt`]:true,
  'system.activities.7e762b185ff74f2a':structuredClone(template.system.activities['7e762b185ff74f2a']),
  'system.uses.max':'1','system.uses.recovery':structuredClone(template.system.uses.recovery),
  'system.description.value':template.system.description.value,img:template.img,effects});
 await item.setFlag(MOD,'stoneBeltVersion',VERSION);return true;
}
export async function repairWorldBelts(){
 if(!game.user?.isGM||game.users.activeGM?.id!==game.user.id)return;
 const template=await (await fetch(`modules/${MOD}/exports/stone-fury-belt.json`)).json();
 const actors=new Map();for(const a of game.actors??[])actors.set(a.uuid,a);
 for(const scene of game.scenes??[])for(const t of scene.tokens??[])if(!t.actorLink&&t.actor)actors.set(t.actor.uuid,t.actor);
 const items=[...(game.items??[]),...[...actors.values()].flatMap(a=>[...a.items])];let count=0;
 for(const i of items)if(await repairStoneBelt(i,template))count++;
 if(count)ui.notifications.info(`Мир Ортес: исправлен Пояс каменной ярости (${count}). Заряды, настройка и резервные копии сохранены.`);
}
Hooks.on('dnd5e.preUseActivity',validateStoneUse);
Hooks.on('dnd5e.postUseActivity',(a,c,r)=>{void activateStone(a,c,r).catch(error);});
Hooks.on('dnd5e.preRollDamageV2',stoneDamage);
Hooks.once('ready',()=>{const m=game.modules.get(MOD);m.api??={};m.api.repairStoneBelts=repairWorldBelts;void repairWorldBelts().catch(error);});

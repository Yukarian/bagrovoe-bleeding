const MOD='bagrovoe-bleeding';
const runeActions=new Set(['chains','veil','fracture']);
const action=a=>a?.flags?.[MOD]?.threeRuneAction;
const rifle=a=>a?.item?.flags?.[MOD]?.threeRuneRifle;
const actorOf=a=>a.actor??a.item?.actor;
const turn=()=>game.combat?.started?`${game.combat.id}:${game.combat.round}:${game.combat.turn}`:null;
const receipt=a=>actorOf(a)?.flags?.[MOD]?.rifleRune;
const warn=s=>{ui.notifications.warn('Винтовка трёх рун: '+s);return false;};
export function validateRifle(a){
 if(!rifle(a))return;const key=action(a),actor=actorOf(a);
 if(!actor||!a.item.system.equipped||!a.item.system.attuned)return warn('экипируйте оружие и настройтесь на него.');
 if(runeActions.has(key)){
  if(game.combat?.started&&game.combat.combatant?.actor?.uuid!==actor.uuid)return warn('руна применяется только в свой ход после попадания.');
  if(turn()&&receipt(a)?.turn===turn())return warn('руна уже использована в этот ход.');
 }
 if(key==='splash'){
  const last=receipt(a);if(!last||last.action!=='fracture'||last.item!==a.item.uuid||(turn()?last.turn!==turn():Number(game.time.worldTime)-last.time>60))return warn('сначала активируйте Руну Раскола после попадания.');
 }
}
export function rifleConsumption(a,config,message,updates){
 if(!rifle(a))return;if(validateRifle(a)===false)return false;
 const key=action(a);
 if(runeActions.has(key)){
  const next=updates.item?.find(i=>i._id===a.item.id)?.['system.uses.spent'];
  if(!(next>Number(a.item.system.uses.spent??0)))return warn('активация руны требует расхода одного заряда.');
  updates.actor[`flags.${MOD}.rifleRune`]={turn:turn(),time:Number(game.time.worldTime),item:a.item.uuid,action:key};
 }
 if(key==='reload-action'||key==='reload-bonus'){
  const shot=[...a.item.system.activities].find(x=>action(x)==='shot');if(!shot)return warn('не найдена активность выстрела.');
  let row=updates.item.find(i=>i._id===a.item.id);if(!row){row={_id:a.item.id};updates.item.push(row);}
  row[`system.activities.${shot.id}.uses.spent`]=0;
 }
}
Hooks.on('dnd5e.preUseActivity',validateRifle);
Hooks.on('dnd5e.activityConsumption',rifleConsumption);

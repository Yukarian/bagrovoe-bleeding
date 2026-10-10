const MOD = "bagrovoe-bleeding";
const num = (v, fallback=0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const clamp = (x, low, high) => Math.max(low,Math.min(high,x));

const owned = actor => actor?.isOwner || game.user?.isGM;
const isBloodNpc = actor => actor?.type === "npc" && (actor?.getFlag?.(MOD,"bloodMagic") === true || actor?.system?.details?.type?.subtype === "заражённый");
const bloodCast = activity => activity?.type === "cast" && (activity?.spell?.uuid?.startsWith("Compendium.bagrovoe-bleeding.blood-spells.") || activity?.item?.getFlag?.(MOD,"bloodMagic") === true);
function hdPools(actor) {
  const classes = actor.items.filter(item => item.type === "class");
  if (classes.length) return classes.map(cls => ({
    doc:cls, path:"system.hd.spent", size: Math.max(1,num(cls.system.hd?.denomination?.replace("d",""),8)),
    maximum:Math.max(0,num(cls.system.levels,0)),
    spent:Math.max(0,num(cls.system.hd?.spent))
  })).filter(p=>p.maximum);
  const hd=actor.system.attributes.hd??{};
  const formula=actor.system.attributes.hp?.formula??"";
  const match=String(formula).match(/(\d+)d(\d+)/i);
  return [{doc:actor,path:"flags.bagrovoe-bleeding.hitDiceSpent",size:Math.max(1,num(hd.denomination?.replace?.("d",""),num(match?.[2],8))),
    maximum:Math.max(0,num(hd.max,num(match?.[1],0))),spent:Math.max(0,num(actor.getFlag?.(MOD,"hitDiceSpent") ?? hd.spent))}];
}
function chooseDice(actor, count) {
 const pools=hdPools(actor).sort((a,b)=>a.size-b.size);
 const spent=[];let missing=count;
 for(const pool of pools){const use=Math.min(missing, Math.max(0,pool.maximum-pool.spent));if(use){spent.push({pool,count:use});missing-=use;}}
 return {spent,missing,die:pools[0]?.size??8};
}
async function costOf(activity,config) {
  const selected = config?.spellLevel ?? config?.slotLevel ?? (activity?.spell?.level > 0 ? activity.spell.level : null);
  if(selected !== null && selected !== undefined) return clamp(Math.trunc(num(selected)),0,9);
  const uuid=activity?.spell?.uuid;
  if(!uuid)return 0;
  const spell=await fromUuid(uuid);
  return clamp(Math.trunc(num(spell?.system?.level)),0,9);
}
async function pay(actor,cost) {
 if(!isBloodNpc(actor))throw Error("Кровавое колдовство пока доступно только заражённым NPC");
 if(!owned(actor))throw Error("Нет прав на изменение Костей Хитов");
 const {spent,missing,die}=chooseDice(actor,cost);
 for(const {pool,count} of spent)await pool.doc.update({[pool.path]:pool.spent+count});
 let total=0,expression="";
 if(missing){
   expression=`${missing}d${die}`;
   total=(await new Roll(expression).evaluate()).total;
   const hp=actor.system.attributes.hp;
   await actor.update({"system.attributes.hp.value":Math.max(0,hp.value-total)});
   if(hp.value-total<=0) await actor.toggleStatusEffect("unconscious",{active:true});
   if(hp.value-total<=0 && actor.type==="npc")await actor.toggleStatusEffect("dead",{active:true});
 }
 await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content:`<p><strong>Кровавое колдовство:</strong> ${actor.name} — стоимость ${cost} КХ, потрачено ${cost-missing}, нехватка ${missing}${missing?`, урон ${expression} = ${total} (без защит и временных хитов)`:""}.</p>`});
 return {missing,total,killed:total>0 && actor.system.attributes.hp.value<=0};
}
async function regain(actor,number=1){
 const spent=hdPools(actor).sort((a,b)=>b.size-a.size);
 let left=number,recovered=0;
 for(const p of spent){const n=Math.min(left,p.spent);if(n){await p.doc.update({[p.path]:p.spent-n});left-=n;recovered+=n;}}
 return recovered;
}
async function steal(caster,target,amount=1,heal=0){
 if(!owned(caster)||!owned(target))throw Error("Для похищения ведущий должен иметь доступ к обоим актёрам");
 if(target.statuses.has("dead")||target.system.details?.type?.value==="undead")return 0;
 const pools=hdPools(target);
 let remaining=amount,stolen=0;
 for(const p of pools){const n=Math.min(remaining,Math.max(0,p.maximum-p.spent));if(n){await p.doc.update({[p.path]:p.spent+n});stolen+=n;remaining-=n;}}
 const restored=await regain(caster,stolen);
 if(heal&&stolen){const hp=caster.system.attributes.hp;await caster.update({"system.attributes.hp.value":Math.min(hp.max,hp.value+heal*stolen)});}
 return restored;
}
// Intercept before activity use. A re-entrant call with a bypass flag is the only
// way to guarantee payment precedes the effect without pretending an async hook awaits.
const authorizedUses = new WeakSet();
const spending = new Set();
const pendingCast = new Map();
function guardedActivity(activity) {
 const actor=activity?.item?.actor;
 if(!actor || !owned(actor)) return null;
 if(isBloodNpc(actor) && bloodCast(activity)) return { actor, item:activity.item, spell:true };
 if(activity?.item?.getFlag?.(MOD,"itemBloodCost") && (actor.type==="npc" || actor.type==="character")) return { actor,item:activity.item,spell:false };
 return null;
}
Hooks.on("dnd5e.preUseActivity",(activity,usageConfig,dialogConfig,messageConfig)=>{
 const entry=guardedActivity(activity);
 if(!entry || authorizedUses.has(activity)) {
   authorizedUses.delete(activity);
   if(entry?.spell) {
     usageConfig.consume??={};
     usageConfig.consume.spellSlot=false;
   }
   return;
 }
 const key=entry.actor.uuid;
 // Reject concurrent activations instead of risking double-spend.
 if(spending.has(key)) {
   ui.notifications.warn("Багровое Причастие: дождитесь завершения предыдущей активации");
   return false;
 }
 spending.add(key);
 pendingCast.set(key,activity.uuid ?? activity.id);
 (async()=>{
   try {
     // Both spells and item powers pay before their action's roll/effect.
     const result=entry.spell
       ? await pay(entry.actor,await costOf(activity,usageConfig))
       : await activateItemBloodCost(entry.item);
     if(result?.killed || entry.actor.statuses?.has?.("dead"))return;
     authorizedUses.add(activity);
     const next=foundry.utils.deepClone(usageConfig);
     next.consume??={};
     if(entry.spell) next.consume.spellSlot=false;
     await activity.use(next,{...dialogConfig,configure:false},messageConfig);
   } catch(error) { console.error(MOD,error); ui.notifications.error("Багровое Причастие: "+error.message); }
   finally {
     authorizedUses.delete(activity);
     if(pendingCast.get(key)===(activity.uuid ?? activity.id)) pendingCast.delete(key);
     spending.delete(key);
   }
 })();
 return false;
});
/**
 * Player item powers only. Explicitly configured items may spend Hit Dice or HP.
 * Does not enable blood spellcasting or passive regeneration for player characters.
 * Configuration flag on item: flags["bagrovoe-bleeding"].itemBloodCost = {
 *   hitDice: 1, allowHealthSubstitution: false, healthDice: 1,
 *   healthDie: 8, requireSurvival: false
 * }
 * Call by a macro/on-use integration, not by ordinary character spell activity.
 */
async function activateItemBloodCost(item) {
 const actor=item?.actor;
 if(!actor||!owned(actor))throw new Error("Недостаточно прав на предмет");
 const config=item.getFlag?.(MOD,"itemBloodCost");
 if(!config)throw new Error("Предмет не требует кровавой оплаты");
 const cost=clamp(Math.trunc(num(config.hitDice,0)),0,20);
 const pools=chooseDice(actor,cost);
 if(pools.missing&&!config.allowHealthSubstitution)throw new Error("Недостаточно Костей Хитов");
 const hp=actor.system.attributes.hp;
 const rollCount= pools.missing+clamp(Math.trunc(num(config.healthDice,0)),0,20);
 const die=clamp(Math.trunc(num(config.healthDie,pools.die)),4,20);
 const harm=rollCount?(await new Roll(`${rollCount}d${die}`).evaluate()).total:0;
 if(config.requireSurvival&&hp.value<=harm)throw new Error("Для активации недостаточно здоровья");
 for(const {pool,count} of pools.spent)await pool.doc.update({[pool.path]:pool.spent+count});
 if(harm)await actor.update({"system.attributes.hp.value":Math.max(0,hp.value-harm)});
 await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content:
   `<p><strong>${item.name}:</strong> потрачено ${cost-pools.missing} Костей Хитов; жертва ${harm} HP.</p>`});
 return {spent:cost-pools.missing,harm,killed:harm>0 && actor.system.attributes.hp.value<=0};
}

function isBleeding(token){
 return Boolean(token?.actor?.effects?.some(e=>!e.disabled && e.getFlag?.(MOD,"bleeding") &&
   (!e.getFlag(MOD,"tokenUuid")||e.getFlag(MOD,"tokenUuid")===token.uuid)));
}
async function bloodAttackLifesteal(chat){
 if(!game.user?.isGM || game.users?.activeGM?.id!==game.user.id || chat.type!=="attack")return;
 const activity=chat.getAssociatedActivity?.();
 if(activity?.type!=="attack")return;
 const item=activity.item;
 if(!item?.getFlag?.(MOD,"bloodMagic") && !item?.getFlag?.(MOD,"abilities")?.bloodMagic)return;
 const caster=item.actor;
 if(!isBloodNpc(caster))return;
 const combat=game.combat;
 const turnKey=combat?.started?[combat.id,combat.round,combat.turn].join(":"):chat.id;
 const old=caster.getFlag(MOD,"lifestealTurn");
 if(old===turnKey)return;
 const targets=chat.system?.evaluatedTargets??[];
 for(const t of targets.filter(t=>!t.isMiss)){
   const token=await fromUuid(t.token);
   if(!isBleeding(token))continue;
   // Prevent double processing when chat hooks fire again.
   if(caster.getFlag(MOD,"lifestealTurn")===turnKey)return;
   await caster.setFlag(MOD,"lifestealTurn",turnKey);
   const roll=await new Roll("1d6").evaluate();
   const hp=caster.system.attributes.hp;
   await caster.update({"system.attributes.hp.value":Math.min(hp.max,hp.value+roll.total)});
   await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:caster}),
     content:`<p><strong>Кровавое поглощение:</strong> ${caster.name} восстанавливает ${roll.total} хитов.</p>`});
   const cr=num(caster.system.details?.cr,0);
   if(cr<7 || !owned(token.actor))return;
   const dc=8+num(caster.system.attributes.prof,Math.max(2,Math.ceil(cr/4)+1))+num(caster.system.abilities?.con?.mod,0);
   const saves=await token.actor.rollSavingThrow({ability:"con",target:dc},{configure:false});
   if((saves?.[0]?.total??99)<dc){
     const gained=await steal(caster,token.actor,1,0);
     if(gained)await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:caster}),
       content:`<p><strong>Похищение жизненной силы:</strong> ${caster.name} восстановил ${gained} Кость Хитов.</p>`});
   }
   return;
 }
}
Hooks.on("createChatMessage",chat=>{
 // Foundry can keep activity.use() pending after chat output. Once its actual
 // roll/activity card is created, release the input lock so the NPC can act again.
 const activity=chat.getAssociatedActivity?.();
 const actor=activity?.item?.actor;
 const key=actor?.uuid;
 if(key && pendingCast.get(key)===(activity.uuid ?? activity.id)){
   pendingCast.delete(key);
   spending.delete(key);
 }
 void bloodAttackLifesteal(chat).catch(error=>console.error(MOD,error));
});


function hitDiceSummary(actor) {
 const pools=hdPools(actor);
 const maximum=pools.reduce((n,p)=>n+p.maximum,0);
 const spent=pools.reduce((n,p)=>n+Math.min(p.maximum,p.spent),0);
 return { maximum, spent, available:Math.max(0,maximum-spent),
   dice:pools.map(p=>`${Math.max(0,p.maximum-p.spent)}/${p.maximum}к${p.size}`).join(", ") };
}
async function setAvailableHitDice(actor,available) {
 if(!game.user?.isGM)throw new Error("Изменять Кости Хитов NPC может только ведущий.");
 if(actor?.type!=="npc")throw new Error("Этот счётчик предназначен для NPC.");
 const pools=hdPools(actor);
 if(pools.length!==1)throw new Error("Для этого NPC используется несколько наборов Костей Хитов.");
 const p=pools[0];
 const left=clamp(Math.trunc(num(available)),0,p.maximum);
 await p.doc.update({[p.path]:p.maximum-left});
 return hitDiceSummary(actor);
}
function hitDiceRoot(html) {
 return html instanceof HTMLElement ? html : html?.[0] instanceof HTMLElement ? html[0] : null;
}
function drawHitDiceCounter(app,html) {
 const actor=app.actor ?? app.document ?? app.object;
 if(actor?.documentName!=="Actor" || actor?.type!=="npc" || !game.user?.isGM) return;
 const root=hitDiceRoot(html) ?? hitDiceRoot(app.element);
 if(!root)return;
 const data=hitDiceSummary(actor);
 if(!data.maximum)return;
 root.querySelector('[data-bagrovoe-hit-dice]')?.remove();
 const el=document.createElement("section");
 el.dataset.bagrovoeHitDice="true";
 el.style.cssText="box-sizing:border-box;width:100%;min-height:42px;padding:6px 10px;margin:0 0 8px;border:1px solid #803445;border-radius:6px;background:rgba(55,0,13,.55);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;position:relative;z-index:5;pointer-events:auto;";
 const title=document.createElement("strong");
 title.textContent="🩸 Кости Хитов";
 const stat=document.createElement("span");
 stat.textContent=data.dice;
 stat.title=`Доступно ${data.available}, потрачено ${data.spent}`;
 const actions=document.createElement("div");
 actions.style.cssText="display:flex;gap:4px;margin-left:auto;";
 const makeButton=(label,title,fn)=>{
   const button=document.createElement("button");
   button.type="button";button.textContent=label;button.title=title;
   button.style.cssText="display:inline-flex;align-items:center;justify-content:center;padding:3px 8px;min-width:30px;min-height:28px;cursor:pointer;pointer-events:auto;";
   for(const eventName of ["pointerdown","mousedown"]) button.addEventListener(eventName,event=>event.stopPropagation());
   button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();void fn().catch(error=>{
     console.error(MOD,error);ui.notifications.error("Багровое Причастие: "+error.message);
   });});
   actions.append(button);
 };
 makeButton("−","Потратить одну Кость Хитов",()=>setAvailableHitDice(actor,hitDiceSummary(actor).available-1));
 makeButton("+","Восстановить одну Кость Хитов",()=>setAvailableHitDice(actor,hitDiceSummary(actor).available+1));
 makeButton("✎","Задать точный остаток",async()=>{
   const state=hitDiceSummary(actor);
   const result=await foundry.applications.api.DialogV2.wait({
     window:{title:"Кости Хитов — "+actor.name},
     content:`<p>Доступно ${state.available} из ${state.maximum}. Размер: ${state.dice}</p><label>Осталось Костей Хитов<input name="available" type="number" min="0" max="${state.maximum}" step="1" value="${state.available}"></label>`,
     buttons:[
       {action:"save",label:"Сохранить",default:true,callback:(_event,button)=>Number(button.form.elements.available.value)},
       {action:"cancel",label:"Отмена",callback:()=>null}
     ],rejectClose:false
   });
   if(result!==null && result!==undefined)await setAvailableHitDice(actor,result);
 });
 el.append(title,stat,actions);
 // Attach to the right-side activity list, not to the sheet-body grid:
 // inserting as a grid child breaks the D&D5e 2024 two-column NPC layout.
 const list=root.querySelector(".items-list") ?? root.querySelector(".inventory-list") ??
   root.querySelector('[class*="items-section"]') ?? root.querySelector(".activities");
 const search=root.querySelector('input[placeholder*="Поиск особенностей"]') ??
   root.querySelector('input[placeholder*="Search"]');
 if(list?.parentElement) list.parentElement.insertBefore(el,list);
 else if(search?.parentElement?.parentElement) search.parentElement.parentElement.insertAdjacentElement("afterend",el);
 else return; // Never insert into .sheet-body or a grid root as fallback.

}
Hooks.on("renderActorSheet",drawHitDiceCounter);
Hooks.on("renderApplicationV2",drawHitDiceCounter);
Hooks.on("updateActor",actor=>{
 if(actor?.type!=="npc")return;
 for(const app of Object.values(actor.apps??{})) {
   if(app.rendered)app.render(false);
 }
});

Hooks.once("ready",()=>{
 const module=game.modules.get(MOD);
 if(!module)return;
 module.api??={};
 Object.assign(module.api,{bloodMagic:{hdPools,chooseDice,pay,regain,steal,activateItemBloodCost,hitDiceSummary,setAvailableHitDice}});
 globalThis.BagrovoeBloodMagic={hdPools,chooseDice,pay,regain,steal,activateItemBloodCost,hitDiceSummary,setAvailableHitDice};
});

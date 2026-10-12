const MOD = 'bagrovoe-bleeding';
const keyOf = item => item?.getFlag?.(MOD, 'spellKey');
const leader = () => game.user?.isGM && game.users?.activeGM?.id === game.user.id;
const shields = new Set(['blood-barrier', 'vessel-hardening']);
const controls = new Set(['muscle-constriction', 'blood-bonds']);
const work = new Map();
let defenseQueue=Promise.resolve();
function serial(key, fn) {
  if (work.has(key)) return work.get(key);
  const p = Promise.resolve().then(fn).finally(() => work.delete(key));
  work.set(key,p);return p;
}
const report = error => { console.error(MOD,error);ui.notifications.error(`Багровое Причастие: ${error.message}`); };
function validateUse(activity, usage, message) {
  const item=activity.item,key=keyOf(item),parry=item?.getFlag?.(MOD,'npcParry');if(!key&&!parry)return;
  if((shields.has(key)||parry) && !usage._bagrovoeReaction) {
    ui.notifications.info('Эта защита предлагается ведущему автоматически при попадании атаки по владельцу.');return false;
  }
  const uses=activity.uses;
  if(uses?.max && Number(uses.spent??0)>=Number(uses.max)) {
    ui.notifications.warn('Применения способности закончились.');return false;
  }
  const targets=message?.data?.system?.targets??[];
  const limit=Number(activity.target?.affects?.count || item.system.target?.affects?.count);
  if(!usage._bagrovoeReaction && (controls.has(key)||['vascular-pulse','forced-reconstruction'].includes(key))) {
    if(!targets.length || (limit>0 && targets.length>limit)) {
      ui.notifications.warn(`Выберите от 1 до ${limit||1} целей перед применением.`);return false;
    }
  }
}

// AC is changed only in this attack's target snapshot, never on the actor itself.
async function resolveAttack(chat) {
  if(!leader() || chat.type!=='attack')return;
  return serial(`defense:${chat.id}`,()=>{
    const task=defenseQueue.catch(()=>{}).then(()=>resolveDefense(chat));
    defenseQueue=task;return task;
  });
}
async function resolveDefense(chat) {
    if(chat.getFlag(MOD,'defenseResolved'))return;
    const roll=chat.rolls?.[0];if(!roll)return;
    for(const hit of chat.system?.evaluatedTargets??[]) {
      if(hit.isMiss!==false || roll.isCritical || hit.ac==null || roll.total>=hit.ac+3)continue;
      const token=await fromUuid(hit.token),actor=token?.actor;if(!actor)continue;
      if(globalThis.BagrovoeExpandedSpells?.reactionBlocked(actor))continue;
      if(actor.type!=='npc'||!(actor.getFlag(MOD,'bloodMagic')||actor.system.details?.type?.subtype==='заражённый'))continue;
      const combat=game.combat;
      const ownTurn=combat?.turns?.findIndex(c=>c.actor?.uuid===actor.uuid)??-1;
      // A reaction refreshes at the start of its owner's next turn.
      const reactionKey=combat?.started?`${combat.id}:${combat.round-(combat.turn<ownTurn?1:0)}`:chat.id;
      if(actor.getFlag(MOD,'shieldReaction')===reactionKey)continue;
      const options=[];
      for(const item of actor.items??[])if(shields.has(keyOf(item))||item.getFlag?.(MOD,'npcParry'))for(const a of item.system.activities??[]) {
        const parry=item.getFlag?.(MOD,'npcParry');
        if(parry&&chat.getAssociatedActivity?.()?.attack?.type?.value!=='melee')continue;
        const uses=parry?item.system.uses:a.uses;
        if(!uses?.max || Number(uses.spent??0)<Number(uses.max))options.push(a);
      }
      if(!options.length)continue;
      const esc=foundry.utils.escapeHTML;
      const choice=await foundry.applications.api.DialogV2.wait({
        window:{title:'Багровая защита'},
        content:`<p>${esc(actor.name)}: атака ${roll.total} против КД ${hit.ac}. Потратить реакцию и применение защиты, чтобы превратить попадание в промах? Магическая защита дополнительно стоит 1 Кость Хитов; парирование костей не расходует. Подтвердите, только если существо видит атакующего и ещё может реагировать.</p>`,
        buttons:[...options.map((a,n)=>({action:String(n),label:a.item.name,callback:()=>n})),{action:'skip',label:'Пропустить',default:true,callback:()=>null}],rejectClose:false
      });
      if(choice===null||choice===undefined)continue;
      const activity=options[choice];if(!activity)continue;
      if(!activity.item.getFlag?.(MOD,'npcParry')){
        const paid=await game.modules.get(MOD).api.bloodMagic.pay(actor,1);
        if(paid.killed)continue;
      }
      const result=await activity.use({_bagrovoePaid:true,_bagrovoeReaction:true,consume:{spellSlot:false}}, {configure:false});
      if(!result)continue;
      await actor.setFlag(MOD,'shieldReaction',reactionKey);
      const targets=chat.system.targets.map(t=>({...t,ac:t.token===hit.token?t.ac+3:t.ac}));
      await chat.update({'system.targets':targets});
    }
    await chat.setFlag(MOD,'defenseResolved',true);
}

function expiry(caster) {
  const c=game.combat;
  const turn=c?.turns?.findIndex(x=>x.actor?.uuid===caster.uuid)??-1;
  return c?.started && turn>=0
    ? {combat:c.id,combatant:c.turns[turn].id,round:c.round+(turn<=c.turn?1:0)}
    : {worldTime:game.time.worldTime+6};
}
async function applyControl(chat) {
  if(!leader()||chat.type!=='save')return;
  const activity=chat.getAssociatedActivity?.(),item=activity?.item,key=keyOf(item);
  if(!controls.has(key)||!chat.system.origin)return;
  const roll=chat.rolls?.[0];if(!Number.isFinite(roll?.total))return;
  const actor=chat.getAssociatedActor?.();if(!actor)return;
  const source=await fromUuid(`ChatMessage.${chat.system.origin}`);
  if(!source||source.getAssociatedActivity?.()?.item?.uuid!==item.uuid)return;
  const dc=Number(activity.save?.dc?.value);
  if(!Number.isFinite(dc))return;
  return serial(`control:${actor.uuid}`,async()=>{
    const success=chat.system.forceSuccess || chat.system.resisted || roll.total>=dc;
    const existing=actor.effects.filter(e=>e.getFlag(MOD,'controlSave')===chat.id);
    if(success){if(existing.length)await actor.deleteEmbeddedDocuments('ActiveEffect',existing.map(e=>e.id));return;}
    if(chat.getFlag(MOD,'controlDone')||existing.length)return;
    if(['undead','construct'].includes(actor.system.details?.type?.value) || actor.statuses?.has('dead'))return;
    if(key==='blood-bonds'&&Array.from(actor.system.traits?.ci?.value??[]).includes('restrained'))return;
    // Recasting the same spell refreshes duration instead of multiplying its penalty.
    const previous=actor.effects.filter(e=>e.getFlag(MOD,'controlKey')===key);
    if(previous.length)await actor.deleteEmbeddedDocuments('ActiveEffect',previous.map(e=>e.id));
    await actor.createEmbeddedDocuments('ActiveEffect',[{
      name:item.name,img:item.img,origin:item.uuid,disabled:false,transfer:false,
      statuses:key==='blood-bonds'?['restrained']:[],
      changes:key==='muscle-constriction'?[{key:'system.attributes.movement.multiplier',mode:1,value:'0.5',priority:20}]:[],
      flags:{[MOD]:{controlKey:key,controlSave:chat.id,expires:expiry(item.actor)}}
    }]);
    await chat.setFlag(MOD,'controlDone',true);
  });
}
async function autoSaves(chat) {
  if(!leader() || chat.type!=='usage')return;
  const activity=chat.getAssociatedActivity?.();
  if(activity?.type!=='save'||!keyOf(activity.item))return;
  return serial(`saves:${chat.id}`,async()=>{
    const ability=Array.from(activity.save.ability??[])[0],dc=Number(activity.save.dc.value);
    if(!ability||!Number.isFinite(dc))return;
    // Use persisted targets, never current GM selection or the rendered card's UI state.
    for(const target of chat.system.targets??[]) {
      const token=await fromUuid(target.token),actor=token?.actor;if(!actor)continue;
      if(controls.has(keyOf(activity.item))&&(['undead','construct'].includes(actor.system.details?.type?.value)||actor.statuses?.has('dead')))continue;
      const key=target.token.replaceAll('.','_');if(chat.getFlag(MOD,'spellSaves')?.[key])continue;
      const prior=game.messages?.contents?.some(m=>m.type==='save'&&m.system.origin===chat.id&&m.getAssociatedToken?.()?.uuid===target.token);
      if(!prior)await actor.rollSavingThrow({ability,target:dc},{configure:false},{data:{speaker:ChatMessage.getSpeaker({token}),system:{...activity.messageSources,origin:chat.id},whisper:[...(chat.whisper??[])],blind:chat.blind}});
      await chat.setFlag(MOD,`spellSaves.${key}`,true);
    }
  });
}
async function expireControls() {
  if(!leader())return;
  const actors=new Map();
  for(const a of game.actors??[])actors.set(a.uuid,a);
  for(const s of game.scenes??[])for(const t of s.tokens??[])if(t.actor)actors.set(t.actor.uuid,t.actor);
  for(const actor of actors.values()){
    const remove=[];
    for(const e of actor.effects){
      const x=e.getFlag(MOD,'expires');if(!x)continue;
      const c=x.combat?game.combats.get(x.combat):null;
      const turn=c?.turns?.findIndex(t=>t.id===x.combatant)??-1;
      const expired=x.combat?(!c?.started||turn<0||c.round>x.round||(c.round===x.round&&(x.start?c.turn>=turn:c.turn>turn))):game.time.worldTime>=x.worldTime;
      if(expired)remove.push(e.id);
    }
    if(remove.length)await actor.deleteEmbeddedDocuments('ActiveEffect',remove);
  }
}
globalThis.BagrovoeSpellRuntime={validateUse,resolveAttack,applyControl,autoSaves,expireControls,expiry};
for(const event of ['createChatMessage','updateChatMessage'])Hooks.on(event,chat=>{
  void resolveAttack(chat).catch(report);void autoSaves(chat).catch(report);void applyControl(chat).catch(report);
});
for(const event of ['updateCombat','deleteCombat','updateWorldTime'])Hooks.on(event,()=>{void expireControls().catch(report);});
Hooks.once('ready',()=>{void expireControls().catch(report);});

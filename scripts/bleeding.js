const MOD = 'bagrovoe-bleeding';
const LEVEL_DICE = [0, 4, 6, 8, 10, 12];
const ICON = 'icons/skills/wounds/blood-drip-droplet-red.webp';

function isLeadingGM() {
  return game.user?.isGM && game.users?.filter(u => u.active && u.isGM).sort((a,b) => a.id.localeCompare(b.id))[0]?.id === game.user.id;
}
function effectOf(actor) {
  return actor?.effects?.find(e => e.getFlag(MOD, 'bleeding') === true);
}
function getTokenActor(token) { return token?.actor ?? null; }
function activeTargets() {
  const targets = [...game.user.targets].map(t => t.actor).filter(Boolean);
  if (targets.length) return targets;
  return [...(canvas.tokens?.controlled ?? [])].map(getTokenActor).filter(Boolean);
}
function uniqueActors(actors) {
  return [...new Map(actors.filter(Boolean).map(a => [a.uuid, a])).values()];
}
async function message(body) {
  await ChatMessage.create({content: `<div class="dnd5e chat-card"><h3>🩸 Кровотечение</h3>${body}</div>`, speaker: {alias:'Багровое Причастие'}});
}
async function apply(actor, { levels = 1, count = null, dc = 11 } = {}) {
  if (!game.user.isGM) return ui.notifications.warn('Накладывать кровотечение должен ведущий.');
  if (!actor) return;
  levels = Math.max(1, Math.floor(Number(levels) || 1));
  dc = Math.max(1, Math.floor(Number(dc) || 11));
  const old = effectOf(actor);
  const prevLevel = Number(old?.getFlag(MOD,'level')) || 0;
  const level = Math.min(5, prevLevel + levels);
  const cubes = Math.min(10, Math.max(1, Number(count ?? old?.getFlag(MOD,'count') ?? 1) || 1));
  const maxDC = Math.max(dc, Number(old?.getFlag(MOD,'dc')) || 0);
  const desc = `<p>Уровень ${level} · ${cubes}к${LEVEL_DICE[level]} некротического урона в начале своего хода. Сл Медицины ${maxDC}. Любое фактическое восстановление хитов снимает эффект.</p>`;
  if (old) {
    await old.update({
      name:`Кровотечение ${level} (${cubes}к${LEVEL_DICE[level]})`,
      description:desc,
      [`flags.${MOD}.level`]:level,
      [`flags.${MOD}.count`]:cubes,
      [`flags.${MOD}.dc`]:maxDC
    });
  } else {
    await actor.createEmbeddedDocuments('ActiveEffect',[{
      name:`Кровотечение ${level} (${cubes}к${LEVEL_DICE[level]})`, img:ICON, type:'base',
      description:desc, disabled:false, transfer:false,
      duration:{seconds:null}, changes:[], statuses:[],
      flags:{[MOD]:{bleeding:true,level,count:cubes,dc:maxDC,lastTick:null}}
    }]);
  }
  await message(`<p><strong>${foundry.utils.escapeHTML(actor.name)}</strong>: уровень ${level}; урон в начале хода <strong>${cubes}к${LEVEL_DICE[level]}</strong> (Сл ${maxDC}).</p>`);
}
async function stop(actor, reason='кровотечение остановлено') {
  if (!game.user.isGM) return ui.notifications.warn('Снять кровотечение должен ведущий.');
  const eff = effectOf(actor);
  if (!eff) return false;
  await actor.deleteEmbeddedDocuments('ActiveEffect',[eff.id]);
  await message(`<p><strong>${foundry.utils.escapeHTML(actor.name)}</strong>: ${foundry.utils.escapeHTML(reason)}.</p>`);
  return true;
}
async function tick(combat, current) {
  if (!isLeadingGM()) return;
  if (!combat?.started) return;
  const combatant = combat.combatants.get(current?.combatantId) ?? combat.combatant;
  const actor = combatant?.token?.actor ?? combatant?.actor;
  if (!actor) return;
  const eff = effectOf(actor);
  if (!eff || eff.disabled) return;
  const marker = `${combat.id}:${current.round}:${combatant.id}`;
  if (eff.getFlag(MOD,'lastTick') === marker) return;
  const level = Math.min(5, Math.max(1, Number(eff.getFlag(MOD,'level')) || 1));
  const count = Math.min(10, Math.max(1, Number(eff.getFlag(MOD,'count')) || 1));
  // Record first, to avoid repeat damage if the turn event is replayed.
  await eff.setFlag(MOD,'lastTick',marker);
  const roll = await (new Roll(`${count}d${LEVEL_DICE[level]}`)).evaluate();
  await actor.applyDamage([{value:roll.total,type:'necrotic'}]);
  await message(`<p><strong>${foundry.utils.escapeHTML(actor.name)}</strong> получает <strong>${roll.total}</strong> некротического урона кровотечением (ур. ${level}, ${count}к${LEVEL_DICE[level]}).</p><p>${roll.result}</p>`);
  if ((actor.system.attributes.hp?.value ?? 1) <= 0) ui.notifications.warn(`${actor.name}: 0 хитов. Проверьте правила спасбросков от смерти вручную.`);
}


// Число уровней отображается над токеном; стандартный ActiveEffect рисует значок статуса.
function updateCounter(token) {
  if (!token?.actor || !token.renderable) return;
  const level = Number(effectOf(token.actor)?.getFlag(MOD, 'level')) || 0;
  let badge = token._bagrovoeCounter;
  if (!level) {
    if (badge) { badge.destroy(); token._bagrovoeCounter = null; }
    return;
  }
  if (!badge || badge.destroyed) {
    badge = new PIXI.Text({text:String(level),style:{fontFamily:'Arial',fontSize:34,fontWeight:'bold',fill:0xffffff,stroke:{color:0x710000,width:7},align:'center'}});
    badge.anchor.set(0.5,0);
    token.addChild(badge);
    token._bagrovoeCounter = badge;
  }
  badge.text = String(level);
  badge.position.set(token.w - 15, 3);
  badge.scale.set(Math.min(1, 125 / Math.max(token.w, 1)));
}
function refreshCounters(actor) {
  for (const t of canvas?.tokens?.placeables ?? []) if (t.actor?.id === actor?.id) updateCounter(t);
}
Hooks.on('refreshToken', token => updateCounter(token));
Hooks.on('drawToken', token => updateCounter(token));
Hooks.on('createActiveEffect', eff => { if(eff.getFlag(MOD,'bleeding')) refreshCounters(eff.parent); });
Hooks.on('updateActiveEffect', eff => { if(eff.getFlag(MOD,'bleeding')) refreshCounters(eff.parent); });
Hooks.on('deleteActiveEffect', eff => { if(eff.getFlag(MOD,'bleeding')) refreshCounters(eff.parent); });
Hooks.on('canvasReady',()=>{ for(const t of canvas.tokens?.placeables??[])updateCounter(t); });

// D&D5e 6.0.5 native Activities, WITHOUT Midi-QOL.
// Flag on an NPC Item: flags.bagrovoe-bleeding.inflict={levels:1,dc:11,count:1}
// Flag on its save Activity: flags.bagrovoe-bleeding.trigger=true.
// A GM uses the save activity after a successful attack; the module rolls Con saves
// for targeted tokens and applies stacks on failure. Prevents duplicate native saves.
function marked(activity) {
  return activity?.type === 'save' && activity?.item?.getFlag?.(MOD,'inflict')
    && (activity.getFlag?.(MOD,'trigger') || activity.flags?.[MOD]?.trigger);
}
Hooks.on('dnd5e.preUseActivity',(activity, usageConfig) => {
  if (!marked(activity) || !game.user.isGM) return;
  usageConfig.subsequentActions = false;
});
const busySaves = new Set();
Hooks.on('dnd5e.postUseActivity', (activity, usageConfig) => {
  if (!marked(activity) || !isLeadingGM()) return;
  const key=activity.uuid;
  if (busySaves.has(key)) return;
  busySaves.add(key);
  void (async()=>{
    try {
      const data=activity.item.getFlag(MOD,'inflict') || {};
      const targets=[...game.user.targets].filter(t=>t.actor);
      if (!targets.length) { ui.notifications.warn('Назначьте цель (T) перед спасброском кровотечения.'); return; }
      const dc=Math.max(1,Number(data.dc)||11);
      for (const token of targets) {
        const actor=token.actor;
        // A saving throw rolled by the native D&D5e 6.x Actor implementation.
        const rolls=await actor.rollSavingThrow({ability:'con',target:dc},{},{ });
        const roll=Array.isArray(rolls)?rolls[0]:rolls;
        if (!roll || !Number.isFinite(roll.total)) continue;
        if (roll.total < dc) {
          await apply(actor,{levels:Number(data.levels)||1,dc,count:Number(data.count)||1});
        } else {
          await message(`<p>${foundry.utils.escapeHTML(actor.name)} преуспевает в спасброске Телосложения против Сл ${dc}. Кровотечение не наложено.</p>`);
        }
      }
    } catch(e) { console.error(`${MOD}: ошибка обработки спасброска`,e); ui.notifications.error('Кровотечение: ошибка. Проверьте консоль F12.'); }
    finally {busySaves.delete(key);}
  })();
});

// HP лечится как с модулем автоматического урона, так и через изменение значения на листе.
// Контролируем изменение не временных, а настоящих хитов.
const beforeHP = new Map();
Hooks.on('preUpdateActor',(actor,change)=>{
  if (!isLeadingGM() || !effectOf(actor)) return;
  if (foundry.utils.getProperty(change,'system.attributes.hp.value') !== undefined)
    beforeHP.set(actor.uuid,Number(actor.system.attributes.hp.value));
});
Hooks.on('updateActor',async(actor,change)=>{
  if(!isLeadingGM() || !effectOf(actor))return;
  const next=foundry.utils.getProperty(change,'system.attributes.hp.value');
  if(next===undefined)return;
  const before=beforeHP.get(actor.uuid);
  beforeHP.delete(actor.uuid);
  if(Number.isFinite(before)&&Number(next)>before) await stop(actor,'восстановлены хиты');
});
Hooks.on('combatTurnChange',(combat,prior,current)=>{void tick(combat,current).catch(console.error);});

function selectedOrNotify(){
  const list=uniqueActors(activeTargets());
  if (!list.length) ui.notifications.warn('Выделите токен или назначьте цель.');
  return list;
}
async function promptApplication() {
  if(!game.user.isGM)return ui.notifications.warn('Только ведущий.');
  const actors=selectedOrNotify();if(!actors.length)return;
  const values=await foundry.applications.api.DialogV2.wait({
    window:{title:'Кровотечение'},
    content:'<label>Уровни <input name="levels" type="number" value="1" min="1" max="5"></label><label>Сл <input name="dc" type="number" value="11" min="1"></label><label>Кубики <input name="count" type="number" value="1" min="1"></label>',
    buttons:[{action:'ok',label:'Наложить',default:true,callback:(_e,b)=>({levels:Number(b.form.elements.levels.value),dc:Number(b.form.elements.dc.value),count:Number(b.form.elements.count.value)})},{action:'cancel',label:'Отмена',callback:()=>null}]
  });
  if(values)for(const a of actors)await apply(a,values);
}
async function medicine() {
  if(!game.user.isGM)return;
  for(const actor of selectedOrNotify()){
    const eff=effectOf(actor);if(!eff)continue;
    const dc=Number(eff.getFlag(MOD,'dc'))||11;
    const ok=await foundry.applications.api.DialogV2.confirm({window:{title:'Медицина'},content:`<p>${foundry.utils.escapeHTML(actor.name)}: Сл ${dc}. Проверка успешна?</p>`});
    if(ok)await stop(actor,'успешная проверка Медицины');
  }
}
Hooks.once('ready',()=>{
  globalThis.BagrovoeBleeding={apply,stop,medicine,promptApplication,get:effectOf};
  console.info(`${MOD}: v2.0, API готов`);
});

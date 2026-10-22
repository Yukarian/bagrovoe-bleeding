const MOD = 'bagrovoe-bleeding';
let queue = Promise.resolve();
const serial = fn => { const result = queue.catch(() => {}).then(fn); queue = result; return result; };
const flag = (doc, key) => doc?.getFlag?.(MOD, key) ?? doc?.flags?.[MOD]?.[key];
const report = error => { console.error(MOD, error); ui.notifications.error(`Ключевые персонажи: ${error.message}`); };

export function formUpdate(actor, form) {
  const data = flag(actor, 'forms')?.[form];
  if (!data || !['human', 'dragon'].includes(form)) throw Error('Неизвестный облик.');
  return {
    img: data.img, [`flags.${MOD}.guise`]: form,
    'system.traits.size': data.size,
    ...Object.fromEntries(Object.entries(data.abilities ?? {}).map(([key, value]) => [`system.abilities.${key}.value`, value])),
    ...Object.fromEntries(Object.entries(data.speeds).map(([key, value]) => [`system.attributes.movement.speeds.${key}`, value])),
    'prototypeToken.texture.src': data.token, 'prototypeToken.texture.scaleX': 1, 'prototypeToken.texture.scaleY': 1,
    'prototypeToken.width': data.width, 'prototypeToken.height': data.height,
    ...(flag(actor, 'archmage') ? {'prototypeToken.depth': data.width} : {}),
    'prototypeToken.ring.enabled': false
  };
}

export async function setForm(actor, form) {
  if (!game.user?.isGM || !actor?.isOwner || !flag(actor, 'keyNpc')) throw Error('Облик этого NPC меняет ведущий.');
  const update = formUpdate(actor, form), data = flag(actor, 'forms')[form];
  // Deliberately patch only appearance and mobility: HP, effects and all spent resources survive.
  await actor.update(update);
  for (const scene of game.scenes) {
    const tokens = [...scene.tokens].filter(t => actor.isToken ? t.uuid === actor.token?.uuid : t.actorLink && t.actorId === actor.id);
    if (tokens.length) await scene.updateEmbeddedDocuments('Token', tokens.map(t => ({
      _id: t.id, 'texture.src': data.token, 'texture.scaleX': 1, 'texture.scaleY': 1,
      width: data.width, height: data.height, 'ring.enabled': false,
      ...(flag(actor, 'archmage') ? {depth: data.width} : {})
    })));
  }
}

export function validateKeyUse(activity, usage, message) {
  const actor = activity.actor ?? activity.item?.actor, item = activity.item;
  if (!flag(actor, 'keyNpc')) return;
  const warn = text => { ui.notifications.warn(text); return false; };
  if (flag(item, 'dragonOnly') && flag(actor, 'guise') !== 'dragon') return warn('Эта способность доступна в истинном облике.');
  const form = flag(activity, 'guise'), dice = flag(activity, 'balmDice');
  if (!form && !dice) return;
  if (!game.user?.isGM) return warn('Эту способность ключевого NPC применяет ведущий.');
  if (form) return;
  const targets = message?.data?.system?.targets ?? [];
  if (targets.length !== 1) return warn('Бальзам: выберите одно видимое существо.');
  const target = fromUuidSync(targets[0].token);
  if (!target?.actor || target.actor.statuses?.has('dead')) return warn('Бальзам: нужна живая цель.');
  const speaker = message?.data?.speaker ?? ChatMessage.getSpeaker({actor});
  const self = actor.token ?? game.scenes.get(speaker.scene)?.tokens.get(speaker.token);
  if (!self || globalThis.BagrovoeNewSpells.distance(self, target) > 120) return warn('Бальзам: цель должна быть на той же сцене в пределах 120 футов.');
  const available = Number(item.system.uses.max) - Number(item.system.uses.spent ?? 0);
  if (available < dice) return warn('В запасе Бальзама недостаточно костей.');
}

export async function processKeyUse(chat) {
  if (!game.user?.isGM || game.users.activeGM?.id !== game.user.id || chat.type !== 'usage' || !chat.author?.isGM) return;
  return serial(async () => {
    if (flag(chat, 'keyNpcDone') || flag(chat, 'keyNpcStarted')) return;
    const activity = chat.getAssociatedActivity?.(), actor = activity?.actor ?? activity?.item?.actor;
    if (!flag(actor, 'keyNpc')) return;
    const form = flag(activity, 'guise'), dice = Number(flag(activity, 'balmDice') ?? 0);
    if (form) {
      // Safe to retry form selection: it cannot restore spent resources or cause damage.
      await setForm(actor, form); await chat.setFlag(MOD, 'keyNpcDone', true); return;
    }
    if (!Number.isInteger(dice) || dice < 1 || dice > 10) return;
    const targets = chat.system?.targets ?? [];
    if (targets.length !== 1) return;
    const target = (await fromUuid(targets[0].token))?.actor;
    if (!target || target.statuses?.has('dead')) return;
    // A durable receipt prevents a reconnect/replayed chat event from replenishing spent temporary HP.
    await chat.setFlag(MOD, 'keyNpcStarted', true);
    const current = Number(target.system.attributes.hp.temp ?? 0);
    if (current < dice) await target.update({'system.attributes.hp.temp': dice});
    await chat.setFlag(MOD, 'keyNpcDone', true);
  });
}

Hooks.on('dnd5e.preUseActivity', (activity, usage, _dialog, message) => validateKeyUse(activity, usage, message));
Hooks.on('createChatMessage', chat => { void processKeyUse(chat).catch(report); });
Hooks.once('ready', () => {
  const module = game.modules.get(MOD);
  module.api ??= {};
  module.api.keyNpcs = {setForm, processKeyUse};
});

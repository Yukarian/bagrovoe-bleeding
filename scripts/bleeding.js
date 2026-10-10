const MOD = "bagrovoe-bleeding";
const LEVEL_DICE = [0, 4, 6, 8, 10, 12];
const ICON = `modules/${MOD}/icons/blood.svg`;
const queues = new Map();
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const integer = (value, min, max, fallback) => Number.isFinite(Number(value))
  ? Math.min(max, Math.max(min, Math.trunc(Number(value)))) : fallback;

function isLeadingGM() {
  return game.user?.isGM && game.users.activeGM?.id === game.user.id;
}

// Serialize actor mutations, including mutations from different linked tokens.
function enqueue(key, task) {
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(task);
  queues.set(key, next);
  const clean = () => { if (queues.get(key) === next) queues.delete(key); };
  next.then(clean, clean);
  return next;
}
function report(error) {
  console.error(`${MOD}:`, error);
  ui.notifications.error(`Багровое Причастие: ${error.message ?? error}`);
}
function tokensFor(actor) {
  return [...game.scenes].flatMap(scene => [...scene.tokens]).filter(token => token.actor?.uuid === actor.uuid);
}
function tokenDocument(target) {
  const doc = target?.document ?? target;
  if (doc?.documentName === "Token") return doc;
  if (doc?.documentName === "Actor") {
    if (doc.isToken) return doc.token;
    const matches = tokensFor(doc);
    if (matches.length === 1) return matches[0];
    throw new Error("У актёра нет единственного токена. Передайте Token или TokenDocument.");
  }
  throw new Error("Выберите токен с актёром.");
}
function effectOf(target) {
  const token = tokenDocument(target);
  const effects = token.actor?.effects ?? [];
  return effects.find(e => e.getFlag(MOD, "bleeding") && e.getFlag(MOD, "tokenUuid") === token.uuid)
    ?? effects.find(e => e.getFlag(MOD, "bleeding") && !e.getFlag(MOD, "tokenUuid"));
}
function stateOf(effect) {
  return {
    level: integer(effect?.getFlag(MOD, "level") ?? 0, 0, 5, 0),
    count: integer(effect?.getFlag(MOD, "count") ?? 1, 1, 10, 1),
    dc: integer(effect?.getFlag(MOD, "dc") ?? 11, 1, 99, 11)
  };
}
function effectData(token, { level, count, dc }) {
  return {
    name: `Кровотечение ${level} (${count}к${LEVEL_DICE[level]}) — ${token.name}`,
    img: ICON, type: "base", disabled: false, transfer: false, changes: [], statuses: [],
    description: `<p>Уровень ${level}; ${count}к${LEVEL_DICE[level]} некротического урона в начале хода. Сл Медицины ${dc}. Восстановление настоящих хитов снимает кровотечение.</p>`,
    flags: { [MOD]: { bleeding: true, tokenUuid: token.uuid, level, count, dc } }
  };
}
// Convert actor-wide 3.0 effects to per-token effects. Linked tokens keep shared HP.
async function migrateActor(actor) {
  const legacy = actor.effects.filter(e => e.getFlag(MOD, "bleeding") && !e.getFlag(MOD, "tokenUuid"));
  if (!legacy.length) return;
  const tokens = tokensFor(actor);
  if (!tokens.length) return;
  for (const old of legacy) {
    for (const token of tokens) {
      if (actor.effects.some(e => e.getFlag(MOD, "bleeding") && e.getFlag(MOD, "tokenUuid") === token.uuid)) continue;
      const data = effectData(token, { ...stateOf(old), level: Math.max(1, stateOf(old).level) });
      data.disabled = old.disabled;
      data.flags[MOD].lastTick = old.getFlag(MOD, "lastTick") ?? null;
      await actor.createEmbeddedDocuments("ActiveEffect", [data]);
    }
    await old.delete();
  }
}
async function message(body, source) {
  const data = {
    content: `<div class="dnd5e chat-card"><h3>🩸 Кровотечение</h3>${body}</div>`,
    speaker: { alias: "Багровое Причастие" }
  };
  if (source) { data.whisper = [...source.whisper]; data.blind = source.blind; }
  else ChatMessage.applyRollMode(data, game.settings.get("core", "rollMode"));
  return ChatMessage.create(data);
}
async function changeEffect(token, values, { additive = false, source, receipt } = {}) {
  const actor = token.actor;
  await migrateActor(actor);
  const old = effectOf(token);
  const prior = stateOf(old);
  if (receipt && old?.getFlag(MOD, "receipts")?.includes(receipt)) return old;
  const level = integer((additive ? prior.level : 0) + Number(values.level ?? values.levels ?? 1), 0, 5, 1);
  if (!level) return removeEffect(token);
  const count = integer(values.count ?? prior.count, 1, 10, 1);
  const dc = integer(values.dc ?? prior.dc, 1, 99, 11);
  const data = effectData(token, { level, count, dc: additive ? Math.max(dc, prior.level ? prior.dc : 0) : dc });
  if (receipt) data.flags[MOD].receipts = [...(old?.getFlag(MOD, "receipts") ?? []), receipt].slice(-100);
  let result;
  if (old) result = await old.update(data);
  else [result] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  await message(`<p><strong>${escape(token.name)}</strong>: уровень ${level}, ${count}к${LEVEL_DICE[level]}.</p>`, source);
  return result;
}
async function removeEffect(token, reason = "кровотечение остановлено") {
  await migrateActor(token.actor);
  const effect = effectOf(token);
  if (!effect) return false;
  await effect.delete();
  await message(`<p><strong>${escape(token.name)}</strong>: ${escape(reason)}.</p>`);
  return true;
}
function gmOperation(target, task) {
  if (!game.user.isGM) throw new Error("Управлять кровотечением может только ведущий.");
  if (!isLeadingGM()) throw new Error("Изменение должен выполнить активный ведущий Foundry.");
  const token = tokenDocument(target);
  if (!token.actor?.system.attributes?.hp) throw new Error("У токена нет хитов.");
  return enqueue(token.actor.uuid, () => task(token));
}
function apply(target, values = {}) {
  return gmOperation(target, token => changeEffect(token, { ...values, level: values.levels ?? 1 }, { additive: true }));
}
function set(target, values = {}) { return gmOperation(target, token => changeEffect(token, values)); }
function stop(target, reason) { return gmOperation(target, token => removeEffect(token, reason)); }

// Native applyDamage calculates traits and temporary HP exactly once.
// Add death failures and the turn receipt to the SAME database update as HP.
function prepareDamage(actor, amount, updates, options) {
  const context = options[MOD];
  if (!context) return;
  context.amount = amount;
  updates[context.ledgerPath] = context.round;
  const hp = actor.system.attributes.hp;
  const death = actor.system.attributes.death;
  const important = actor.type === "character" || actor.system.traits?.important;
  if (!(amount > 0) || !death || !important || actor.statuses.has("dead")) return;
  const max = hp.effectiveMax ?? hp.max;
  const remainder = Math.max(0, amount - (hp.temp ?? 0) - hp.value);
  if (max > 0 && remainder >= max) {
    updates["system.attributes.death.failure"] = 3;
    updates["system.attributes.death.success"] = 0;
    context.instantDeath = true;
  } else if (hp.value <= 0) {
    updates["system.attributes.death.failure"] = Math.min(3, (death.failure ?? 0) + 1);
    if (actor.statuses.has("stable") || death.success >= 3) updates["system.attributes.death.success"] = 0;
    context.failedSave = true;
  }
  context.breakStable = hp.value <= 0 && actor.statuses.has("stable");
}
async function tick(combat, current) {
  if (!isLeadingGM() || !combat.started || !current?.combatantId || !(current.round > 0)) return;
  const combatant = combat.combatants.get(current.combatantId);
  const token = combatant?.token;
  const actor = token?.actor;
  if (!actor) return;
  return enqueue(actor.uuid, async () => {
    if (!isLeadingGM()) return;
    await migrateActor(actor);
    const effect = effectOf(token);
    if (!effect || effect.disabled || effect.isSuppressed || actor.statuses.has("dead")) return;
    const key = `${combat.id}_${token.id}`;
    const round = current.round;
    // High-water mark prevents re-damage on rewind/advance, including after reload.
    if ((actor.getFlag(MOD, "ticks")?.[key] ?? 0) >= round) return;
    if (effect.getFlag(MOD, "lastTick") === `${combat.id}:${round}:${combatant.id}`) return;
    const { level, count } = stateOf(effect);
    if (!level) return;
    const roll = await new Roll(`${count}d${LEVEL_DICE[level]}`).evaluate();
    const context = { round, ledgerPath: `flags.${MOD}.ticks.${key}` };
    const before = { ...actor.system.attributes.hp };
    await actor.applyDamage([{ value: roll.total, type: "necrotic", properties: new Set() }], { [MOD]: context });
    if (actor.getFlag(MOD, "ticks")?.[key] !== round) return;
    if (context.breakStable) await actor.toggleStatusEffect("stable", { active: false });
    if (context.instantDeath || actor.system.attributes.death?.failure >= 3) {
      await actor.toggleStatusEffect("dead", { active: true });
    }
    const after = actor.system.attributes.hp;
    const details = context.instantDeath ? " Мгновенная смерть." : context.failedSave ? " +1 провал спасброска от смерти." : "";
    await message(`<p><strong>${escape(token.name)}</strong>: ${count}к${LEVEL_DICE[level]} = ${roll.total}; после защит <strong>${context.amount}</strong> некротического урона. Потеря хитов: ${before.value - after.value}; временных: ${(before.temp ?? 0) - (after.temp ?? 0)}.${details}</p><p>${escape(roll.result)}</p>`);
  });
}
function biteConfig(item) {
  const flag = item?.getFlag(MOD, "inflict");
  const isHound = item?.getFlag(MOD, "houndBite") === true;
  const rend = item?.getFlag(MOD, "houndRend");
  if (flag === false || flag?.enabled === false) return null;
  const named = item?.name?.trim().toLocaleLowerCase("ru") === "багровый укус";
  if (!flag && !named && !isHound) return null;
  return {
    isHound,
    isRend: isHound && Boolean(rend),
    levels: integer(flag?.levels ?? 1, 1, 5, 1),
    count: integer(flag?.count ?? 1, 1, 10, 1),
    dc: integer(rend?.dc ?? flag?.dc ?? 11, 1, 99, 11)
  };
}
// This hook reaches all clients. Use native hit evaluation and saved target UUIDs,
// so player attacks never depend on the leading GM's current targets.
async function handleAttack(chat) {
  if (!isLeadingGM() || chat.type !== "attack" || !chat.rolls?.length) return;
  const activity = chat.getAssociatedActivity();
  if (activity?.type !== "attack") return;
  const config = biteConfig(activity.item);
  if (!config) return;
  return enqueue(`attack:${chat.id}`, async () => {
    const targets = chat.system.evaluatedTargets ?? [];
    if (!targets.length) {
      ui.notifications.warn("Багровый укус: перед броском атаки назначьте цель (T).");
      return;
    }
    for (const target of targets.filter(t => !t.isMiss)) {
      const token = await fromUuid(target.token);
      if (token?.documentName !== "Token" || !token.actor) continue;
      const key = `${token.parent.id}_${token.id}`;
      const receipt = `${chat.id}:${key}`;
      const saved = chat.getFlag(MOD, "saves")?.[key];
      const bleedingBefore = Boolean(effectOf(token));
      // The hound gains 3 temporary HP once per turn after biting a bleeding creature.
      if (config.isHound && bleedingBefore) {
        const attacker = activity.item.actor;
        if (attacker) {
          const combat = game.combat;
          const turnKey = combat?.started
            ? [combat.id, combat.round, combat.turn].join(":")
            : chat.id;
          if (attacker.getFlag(MOD, "houndTempTurn") !== turnKey) {
            await attacker.setFlag(MOD, "houndTempTurn", turnKey);
            const hp = Number(attacker.system?.attributes?.hp?.temp ?? 0);
            if (hp < 3) {
              await attacker.update({ "system.attributes.hp.temp": 3 });
              await message("<p><strong>" + escape(attacker.name) + "</strong> получает 3 временных хита («Живучесть заражённого»).</p>", chat);
            }
          }
        }
      }
      // A normal Hound bite grants temporary HP but causes no bleeding.
      if (config.isHound && !config.isRend) continue;
      if (saved?.done) continue;
      let total = saved?.total;
      if (!Number.isFinite(total)) {
        const rolls = await token.actor.rollSavingThrow(
          { ability: "con", target: config.dc }, { configure: false },
          { data: { speaker: ChatMessage.getSpeaker({ token }), whisper: [...chat.whisper], blind: chat.blind },
            rollMode: chat.blind ? "blindroll" : chat.whisper.length ? "gmroll" : "publicroll" }
        );
        total = rolls?.[0]?.total;
        if (!Number.isFinite(total)) continue;
        await chat.setFlag(MOD, `saves.${key}`, { total, done: false });
      }
      if (total < config.dc) {
        await enqueue(token.actor.uuid, () => changeEffect(token, { ...config, level: config.isRend && bleedingBefore ? 2 : config.levels },
          { additive: true, source: chat, receipt }));
      } else await message(`<p>${escape(token.name)}: Телосложение ${total} против Сл ${config.dc}, кровотечение не наложено.</p>`, chat);
      await chat.setFlag(MOD, `saves.${key}.done`, true);
    }
  });
}
function updateCounter(token) {
  if (!token?.actor || token.destroyed) return;
  const effect = effectOf(token.document);
  const level = effect && !effect.disabled && !effect.isSuppressed ? stateOf(effect).level : 0;
  let badge = token._bagrovoeCounter;
  if (!level) {
    badge?.destroy({ children: true });
    token._bagrovoeCounter = null;
    return;
  }
  if (!badge || badge.destroyed) {
    badge = new PIXI.Container();
    const drop = new PIXI.Graphics();
    drop.lineStyle(2, 0xffffff, 0.95).beginFill(0xa30722)
      .moveTo(18, 1).bezierCurveTo(13, 12, 3, 19, 3, 28)
      .bezierCurveTo(3, 46, 33, 46, 33, 28).bezierCurveTo(33, 19, 23, 12, 18, 1).endFill();
    badge.addChild(drop);
    badge.counter = new foundry.canvas.containers.PreciseText(String(level), {
      fontFamily: "Arial", fontSize: 22, fontWeight: "bold", fill: 0xffffff, stroke: 0x36000c, strokeThickness: 3
    });
    badge.counter.anchor.set(0.5);
    badge.counter.position.set(18, 28);
    badge.addChild(badge.counter);
    badge.eventMode = "none";
    token.addChild(badge);
    token._bagrovoeCounter = badge;
  }
  badge.counter.text = String(level);
  const scale = Math.min(token.w, token.h) / 100;
  badge.scale.set(scale);
  badge.position.set(token.w - 38 * scale, token.h - 45 * scale);
  badge.visible = !token.document.hidden || game.user.isGM;
}
function refreshCounters(actor) {
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (!actor || token.actor?.uuid === actor.uuid) updateCounter(token);
  }
}
function selectedTokens() {
  const targets = [...game.user.targets];
  const selected = targets.length ? targets : canvas.tokens?.controlled ?? [];
  return [...new Map(selected.filter(t => t.actor).map(t => [t.document.uuid, t.document])).values()];
}
async function promptApplication(target) {
  if (!isLeadingGM()) return ui.notifications.warn("Откройте управление у активного ведущего Foundry.");
  const tokens = target ? [tokenDocument(target)] : selectedTokens();
  if (!tokens.length) return ui.notifications.warn("Выделите токен или назначьте цель (T).");
  const state = stateOf(effectOf(tokens[0]));
  const values = await foundry.applications.api.DialogV2.wait({
    window: { title: "Багровое Причастие — управление" },
    content: `<p>${tokens.map(t => escape(t.name)).join(", ")}</p><p>«Задать» заменяет уровень; «Добавить» прибавляет его. «Снять» удаляет эффект.</p>
      <label>Уровень (0–5)<input name="level" type="number" min="0" max="5" step="1" value="${state.level || 1}"></label>
      <label>Число кубиков (1–10)<input name="count" type="number" min="1" max="10" step="1" value="${state.count}"></label>
      <label>Сл Медицины<input name="dc" type="number" min="1" max="99" step="1" value="${state.dc}"></label>`,
    buttons: [
      ...["set", "add"].map(action => ({ action, label: action === "set" ? "Задать" : "Добавить", default: action === "set",
        callback: (_event, button) => ({ action, level: Number(button.form.elements.level.value),
          count: Number(button.form.elements.count.value), dc: Number(button.form.elements.dc.value) }) })),
      { action: "remove", label: "Снять", callback: () => ({ action: "set", level: 0 }) },
      { action: "cancel", label: "Отмена", callback: () => null }
    ], rejectClose: false
  });
  if (!values) return;
  for (const token of tokens) {
    if (values.action === "add") await apply(token, { ...values, levels: values.level });
    else await set(token, values);
  }
}
async function medicine() {
  if (!isLeadingGM()) return;
  for (const token of selectedTokens()) {
    const effect = effectOf(token);
    if (!effect) continue;
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Медицина" },
      content: `<p>${escape(token.name)}: Сл ${stateOf(effect).dc}. Проверка успешна?</p>` });
    if (ok) await stop(token, "успешная проверка Медицины");
  }
}
Hooks.on("dnd5e.preApplyDamage", prepareDamage);
Hooks.on("createChatMessage", chat => { void handleAttack(chat).catch(report); });
Hooks.on("combatTurnChange", (combat, _prior, current) => { void tick(combat, { ...current }).catch(report); });
// Previous HP comes from D&D5e's update options on every client, even player healing.
Hooks.on("updateActor", (actor, changes, options) => {
  if (!isLeadingGM()) return;
  const next = foundry.utils.getProperty(changes, "system.attributes.hp.value");
  const previous = options.dnd5e?.hp?.value;
  if (!Number.isFinite(previous) || !Number.isFinite(next) || next <= previous) return;
  void enqueue(actor.uuid, async () => {
    const ids = actor.effects.filter(e => e.getFlag(MOD, "bleeding")).map(e => e.id);
    if (ids.length) {
      await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
      await message(`<p>${escape(actor.name)}: восстановлены хиты, кровотечение остановлено.</p>`);
    }
  }).catch(report);
});
for (const event of ["refreshToken", "drawToken"]) Hooks.on(event, updateCounter);
for (const event of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
  Hooks.on(event, effect => { if (effect.getFlag(MOD, "bleeding")) refreshCounters(effect.parent); });
}
Hooks.on("canvasReady", () => refreshCounters());
Hooks.on("destroyToken", token => { token._bagrovoeCounter = null; });
Hooks.on("renderTokenHUD", (hud, html) => {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html[0];
  if (root.querySelector("[data-action='bagrovoe']")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "control-icon";
  button.dataset.action = "bagrovoe";
  button.title = "Багровое Причастие: уровень и кубики";
  button.setAttribute("aria-label", button.title);
  button.innerHTML = '<i class="fas fa-droplet"></i>';
  button.addEventListener("click", event => { event.preventDefault(); void promptApplication(hud.object).catch(report); });
  root.querySelector(".col.right")?.append(button);
});
Hooks.once("ready", () => {
  if (game.system.id !== "dnd5e") return;
  globalThis.BagrovoeBleeding = { apply, set, stop, medicine, promptApplication, get: effectOf };
  game.modules.get(MOD).api = globalThis.BagrovoeBleeding;
  if (isLeadingGM()) {
    const actors = new Map([...game.scenes].flatMap(s => [...s.tokens]).filter(t => t.actor).map(t => [t.actor.uuid, t.actor]));
    for (const actor of actors.values()) void enqueue(actor.uuid, () => migrateActor(actor)).catch(report);
  }
  refreshCounters();
  console.info(`${MOD}: v3.1.1, API готов`);
});

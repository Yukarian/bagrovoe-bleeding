import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reference = process.env.DND5E_SOURCE ?? path.resolve(root, '../dnd5e');
const system = JSON.parse(fs.readFileSync(path.join(reference, 'system.json'), 'utf8'));
assert.equal(system.version, '6.0.5', 'Tests require the actual D&D5e 6.0.5 source checkout');
const nativeSource = fs.readFileSync(path.join(reference, 'module/documents/actor/actor.mjs'), 'utf8');
const damageMethods = nativeSource.slice(nativeSource.indexOf('  async applyDamage('), nativeSource.indexOf('  async applyTempHP('));
assert.ok(damageMethods.includes('#changeHasEffect'));
const attackSource = fs.readFileSync(path.join(reference, 'module/data/chat-message/attack-message-data.mjs'), 'utf8');
const targetsGetter = attackSource.slice(attackSource.indexOf('  get evaluatedTargets()'), attackSource.indexOf('  /* -------------------------------------------- */', attackSource.indexOf('  get evaluatedTargets()')));
const source = fs.readFileSync(path.join(root, 'scripts/bleeding.js'), 'utf8');
const MOD = 'bagrovoe-bleeding';
const get = (obj, key) => obj?.[key] ?? key.split('.').reduce((v, k) => v?.[k], obj);
function put(obj, key, value) {
  const parts = key.split('.');
  const last = parts.pop();
  let parent = obj;
  for (const part of parts) parent = parent[part] ??= {};
  parent[last] = value;
}
function merge(target, data) {
  for (const [key, value] of Object.entries(data)) {
    if (key.includes('.')) put(target, key, value);
    else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Set)) merge(target[key] ??= {}, value);
    else target[key] = value;
  }
}
function harness() {
  const listeners = new Map(), messages = [], docs = new Map(), warnings = [], errors = [];
  const on = (name, fn) => { const list = listeners.get(name) ?? []; list.push(fn); listeners.set(name, list); return fn; };
  const Hooks = { on, once: on, call: (name, ...args) => {
    let result = true;
    for (const fn of listeners.get(name) ?? []) if (fn(...args) === false) result = false;
    return result;
  }, callAll: (name, ...args) => { for (const fn of listeners.get(name) ?? []) fn(...args); } };
  class Container {
    children = []; destroyed = false; anchor = { set() {} }; position = { set() {} }; scale = { set() {} };
    addChild(c) { this.children.push(c); c.parent = this; return c; }
    destroy() { this.destroyed = true; if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  }
  class Graphics extends Container {}
  for (const key of ['lineStyle', 'beginFill', 'moveTo', 'bezierCurveTo', 'endFill']) Graphics.prototype[key] = function() { return this; };
  class Text extends Container { constructor(text, style) { super(); assert.equal(typeof text, 'string'); this.text = text; this.style = style; } }
  class D20Roll { constructor(total, { critical = false, fumble = false } = {}) { this.total = total; this.isCritical = critical; this.isFumble = fumble; } }
  const scene = { id: 'scene1', tokens: [] };
  const gm = { id: 'gm1', isGM: true, targets: new Set() };
  const context = vm.createContext({
    console, structuredClone, setTimeout,
    Hooks, game: { user: gm, users: { activeGM: gm }, scenes: [scene], settings: { get: () => 'publicroll' }, system: { id: 'dnd5e' }, modules: new Map([[MOD, {}]]) },
    foundry: { utils: { escapeHTML: String, getProperty: get, deepClone: structuredClone }, canvas: { containers: { PreciseText: Text } } },
    canvas: { tokens: { placeables: [], controlled: [] } },
    PIXI: { Container, Graphics },
    CONFIG: { Dice: { D20Roll }, DND5E: { damageTypes: { necrotic: {} }, healingTypes: { healing: {}, temphp: {}, maximum: {} } } },
    simplifyBonus: value => Number(value),
    ui: { notifications: { warn: t => warnings.push(t), error: t => errors.push(t) } },
    ChatMessage: { create: async data => { messages.push(data); return data; }, getSpeaker: () => ({}), applyRollMode() {} },
    fromUuid: async uuid => docs.get(uuid),
    Roll: class { constructor(formula) { this.formula = formula; } async evaluate() { this.total = context.damage; this.result = String(this.total); return this; } },
    damage: 7
  });
  vm.runInContext('Math.clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n)); Number.isNumeric = n => typeof n === "number";', context);
  vm.runInContext(`globalThis.NativeActor = class { ${damageMethods} }; globalThis.NativeAttack = class { ${targetsGetter} };`, context);
  vm.runInContext(source + '\nglobalThis.api = {apply, set, stop, tick, handleAttack, effectOf, updateCounter, refreshCounters, migrateActor, queues, biteConfig};', context);
  let effectId = 0;
  function actor(id = 'actor1', opts = {}) {
    const a = new context.NativeActor();
    const hp = { value: 20, max: 20, effectiveMax: 20, temp: 0, tempmax: 0, ...opts.hp };
    Object.defineProperty(hp, 'damage', { get: () => hp.effectiveMax - hp.value, enumerable: true });
    Object.assign(a, { id, uuid: opts.uuid ?? `Actor.${id}`, name: id, documentName: 'Actor', type: opts.type ?? 'character', effects: [], flags: {}, statuses: new Set(opts.statuses), updates: [], saves: [] });
    a.system = { attributes: { hp, death: { failure: 0, success: 0, ...opts.death } }, traits: { important: opts.important ?? false,
      di: { value: new Set(opts.immune ? ['necrotic'] : []) }, dr: { value: new Set(opts.resist ? ['necrotic'] : []) }, dv: { value: new Set(opts.vulnerable ? ['necrotic'] : []) }, dm: { amount: opts.modifiers ?? {} } } };
    a.system._source = { attributes: { hp: { tempmax: 0 } } };
    a.getRollData = () => ({});
    a.getFlag = (scope, key) => get(a.flags[scope], key);
    a.update = async (data, options = {}) => {
      const previous = { ...a.system.attributes.hp };
      await new Promise(resolve => setTimeout(resolve, 1));
      if (a.failNextUpdate) { a.failNextUpdate = false; throw new Error('Simulated persistence failure'); }
      merge(a, data); a.updates.push(structuredClone(data));
      Hooks.callAll('updateActor', a, data, { ...options, dnd5e: { hp: previous } });
      return a;
    };
    a.createEmbeddedDocuments = async (type, data) => {
      assert.equal(type, 'ActiveEffect');
      await new Promise(resolve => setTimeout(resolve, 1));
      return data.map(d => {
        const e = { id: `e${++effectId}`, ...structuredClone(d), parent: a,
          getFlag(scope, key) { return get(this.flags[scope], key); },
          async update(changes) { merge(this, changes); Hooks.callAll('updateActiveEffect', this); return this; },
          async delete() { a.effects = a.effects.filter(x => x !== this); Hooks.callAll('deleteActiveEffect', this); }
        };
        a.effects.push(e); Hooks.callAll('createActiveEffect', e); return e;
      });
    };
    a.deleteEmbeddedDocuments = async (_type, ids) => { for (const e of [...a.effects]) if (ids.includes(e.id)) await e.delete(); };
    a.toggleStatusEffect = async (status, { active }) => { if (active) a.statuses.add(status); else a.statuses.delete(status); };
    a.rollSavingThrow = async (...args) => { a.saves.push(args); return [{ total: a.saveTotal ?? 5 }]; };
    return a;
  }
  function token(a, id = `t${scene.tokens.length + 1}`) {
    const t = { id, uuid: `Scene.${scene.id}.Token.${id}`, documentName: 'Token', name: id, actor: a, parent: scene };
    scene.tokens.push(t); docs.set(t.uuid, t);
    const placeable = new Container(); Object.assign(placeable, { document: t, actor: a, w: 100, h: 100 });
    t.object = placeable; context.canvas.tokens.placeables.push(placeable);
    return t;
  }
  function combat(t, round = 1) {
    const c = { id: 'combat1', started: true, combatants: new Map([['c1', { id: 'c1', token: t }]]) };
    return [c, { round, combatantId: 'c1' }];
  }
  function attack(targets, opts = {}) {
    const item = { name: opts.name ?? 'Багровый укус', getFlag: () => opts.flag };
    const roll = new D20Roll(opts.total ?? 15, opts);
    const chat = { id: opts.id ?? 'chat1', type: 'attack', rolls: [roll], flags: {}, whisper: [], blind: false,
      getAssociatedActivity: () => ({ type: 'attack', item }), getFlag(scope, key) { return get(this.flags[scope], key); },
      async setFlag(scope, key, value) { put(this.flags, `${scope}.${key}`, value); }
    };
    chat.system = new context.NativeAttack(); chat.system.parent = chat;
    chat.system.targets = targets.map(t => ({ token: t.uuid, ac: opts.ac === undefined ? 12 : opts.ac }));
    return chat;
  }
  async function flush() {
    while (context.api.queues.size) await Promise.all([...context.api.queues.values()]);
    assert.deepEqual(errors, []);
  }
  return { c: context, api: context.api, actor, token, combat, attack, Hooks, messages, warnings, flush };
}

test('successful attack rolls one automatic CON save using stored targets, not GM selection', async () => {
  const h = harness(), a = h.actor(), t = h.token(a), other = h.token(h.actor('other'));
  h.c.game.user.targets.add(other.object);
  const chat = h.attack([t]);
  await Promise.all([h.api.handleAttack(chat), h.api.handleAttack(chat)]);
  assert.equal(a.saves.length, 1); assert.equal(a.saves[0][0].ability, 'con'); assert.equal(a.saves[0][0].target, 11);
  assert.equal(a.saves[0][1].configure, false); assert.equal(h.api.effectOf(t).getFlag(MOD, 'level'), 1);
  assert.equal(other.actor.effects.length, 0);
});
for (const [label, opts] of [ ['miss', {total: 5}], ['natural 1', {total: 30, fumble: true}], ['total cover', {ac: null, critical: true}] ]) {
  test(`${label}: no saving throw or bleeding`, async () => {
    const h = harness(), a = h.actor(), t = h.token(a);
    await h.api.handleAttack(h.attack([t], opts)); assert.equal(a.saves.length, 0); assert.equal(a.effects.length, 0);
  });
}
test('natural 20 hits high AC, but saving throw meeting DC succeeds', async () => {
  const h = harness(), a = h.actor(), t = h.token(a); a.saveTotal = 11;
  await h.api.handleAttack(h.attack([t], {ac: 99, critical: true}));
  assert.equal(a.saves.length, 1); assert.equal(a.effects.length, 0);
});
test('legacy item flag works after rename; unrelated and disabled items are ignored', async () => {
  const h = harness(), a = h.actor(), t = h.token(a);
  await h.api.handleAttack(h.attack([t], {name: 'Renamed Bite', flag: {dc: 14, levels: 2, count: 3}}));
  assert.equal(h.api.effectOf(t).getFlag(MOD, 'level'), 2); assert.equal(h.api.effectOf(t).getFlag(MOD, 'count'), 3);
  await h.api.handleAttack(h.attack([t], {id: 'chat2', flag: false}));
  await h.api.handleAttack(h.attack([t], {id: 'chat3', name: 'Longsword'})); assert.equal(a.saves.length, 1);
});
test('multiple hits and different attack messages each resolve once', async () => {
  const h = harness(), a = h.actor(), b = h.actor('b'), t = h.token(a), u = h.token(b);
  await Promise.all([h.api.handleAttack(h.attack([t, u])), h.api.handleAttack(h.attack([t], {id: 'chat2'}))]);
  assert.equal(h.api.effectOf(t).getFlag(MOD, 'level'), 2); assert.equal(h.api.effectOf(u).getFlag(MOD, 'level'), 1);
});
for (const [label, options, expectedHP, expectedTemp] of [
  ['ordinary', {}, 13, 0], ['resistance rounds down once', {resist:true}, 17, 0],
  ['immunity', {immune:true}, 20, 0], ['vulnerability', {vulnerable:true}, 6, 0],
  ['resistance and vulnerability', {resist:true,vulnerable:true}, 14, 0],
  ['temporary HP', {hp:{temp:5}}, 18, 0], ['temp HP absorbs all', {hp:{temp:10}}, 20, 3],
  ['resistance then temp HP', {resist:true,hp:{temp:5}}, 20, 2],
  ['damage threshold', {hp:{dt:8}}, 20, 0], ['flat reduction', {modifiers:{necrotic:-2}}, 15, 0]
]) test(`native 6.0.5 damage: ${label}`, async () => {
  const h = harness(), a = h.actor('a', options), t = h.token(a);
  await h.api.apply(t); await h.api.tick(...h.combat(t));
  assert.equal(a.system.attributes.hp.value, expectedHP); assert.equal(a.system.attributes.hp.temp, expectedTemp);
  assert.equal(a.updates.length, 1); assert.equal(a.updates[0][`flags.${MOD}.ticks.combat1_${t.id}`], 1);
});
test('simultaneous tick events, replays, reload, rewind and duplicate combatants do not double damage', async () => {
  const h = harness(), a = h.actor(), t = h.token(a), args = h.combat(t);
  await h.api.apply(t); await Promise.all(Array.from({length: 8}, () => h.api.tick(...args)));
  assert.equal(a.system.attributes.hp.value, 13);
  await h.api.tick(...h.combat(t, 2)); assert.equal(a.system.attributes.hp.value, 6);
  await h.api.tick(...args); await h.api.tick(...h.combat(t, 2)); assert.equal(a.system.attributes.hp.value, 6);
  args[0].combatants.set('c2', {id: 'c2', token:t});
  await h.api.tick(args[0], {round:2, combatantId:'c2'}); assert.equal(a.updates.length, 2);
  const reloaded = harness(); a.applyDamage = a.applyDamage.bind(a);
  await reloaded.api.tick(...h.combat(t, 2)); assert.equal(a.updates.length, 2);
});
test('failed HP persistence can retry without consuming turn; native cancellation leaves no marker', async () => {
  const h = harness(), a = h.actor(), t = h.token(a); await h.api.apply(t);
  a.failNextUpdate = true; await assert.rejects(h.api.tick(...h.combat(t)), /persistence/);
  assert.equal(a.system.attributes.hp.value, 20);
  await h.api.tick(...h.combat(t)); assert.equal(a.system.attributes.hp.value, 13);
  h.Hooks.on('dnd5e.preApplyDamage', () => false);
  await h.api.tick(...h.combat(t, 2)); assert.equal(a.getFlag(MOD, 'ticks')[`combat1_${t.id}`], 1);
});
test('at 0 HP damage adds one failure, including damage absorbed by temp HP', async () => {
  for (const temp of [0, 10]) {
    const h = harness(), a = h.actor('a', {hp:{value:0,temp}, death:{success:1}}), t = h.token(a);
    await h.api.apply(t); await h.api.tick(...h.combat(t));
    assert.equal(a.system.attributes.death.failure, 1); assert.equal(a.system.attributes.death.success, 1);
  }
});
test('immunity at 0 HP does not fail a death save or break stabilization', async () => {
  const h = harness(), a = h.actor('a', {hp:{value:0}, immune:true, statuses:['stable']}), t = h.token(a);
  await h.api.apply(t); await h.api.tick(...h.combat(t));
  assert.equal(a.system.attributes.death.failure, 0); assert.ok(a.statuses.has('stable'));
});
test('damage breaks stabilization, third failure applies dead, dead creatures do not tick again', async () => {
  const h = harness(), a = h.actor('a', {hp:{value:0}, death:{failure:2,success:3}, statuses:['stable']}), t = h.token(a);
  await h.api.apply(t); await h.api.tick(...h.combat(t));
  assert.equal(a.system.attributes.death.failure, 3); assert.equal(a.system.attributes.death.success, 0);
  assert.ok(!a.statuses.has('stable')); assert.ok(a.statuses.has('dead'));
  await h.api.tick(...h.combat(t, 2)); assert.equal(a.updates.length, 1);
});
test('falling from positive HP to zero is not a failed save', async () => {
  const h = harness(), a = h.actor('a', {hp:{value:3}}), t = h.token(a);
  await h.api.apply(t); await h.api.tick(...h.combat(t)); assert.equal(a.system.attributes.death.failure, 0);
});
test('massive damage instant death accounts for temporary HP and remaining HP', async () => {
  for (const [damage, failure] of [[24,0],[25,3]]) {
    const h = harness(), a = h.actor('a', {hp:{value:3,temp:2}}), t = h.token(a); h.c.damage = damage;
    await h.api.apply(t); await h.api.tick(...h.combat(t)); assert.equal(a.system.attributes.death.failure, failure);
  }
});
test('only important NPCs receive death failures', async () => {
  for (const important of [false,true]) {
    const h = harness(), a = h.actor('a', {type:'npc',important,hp:{value:0}}), t = h.token(a);
    await h.api.apply(t); await h.api.tick(...h.combat(t)); assert.equal(a.system.attributes.death.failure, Number(important));
  }
});
test('unlinked actors with identical IDs remain independent', async () => {
  const h = harness(), a = h.actor('same', {uuid:'Scene.s.Token.a.Actor.same'}), b = h.actor('same', {uuid:'Scene.s.Token.b.Actor.same'}), t = h.token(a), u = h.token(b);
  await Promise.all([h.api.apply(t), h.api.set(u, {level:4,count:3})]);
  await h.api.tick(...h.combat(t)); assert.equal(b.system.attributes.hp.value, 20);
  assert.equal(t.object._bagrovoeCounter.counter.text, '1'); assert.equal(u.object._bagrovoeCounter.counter.text, '4');
  await h.api.stop(t); assert.equal(t.object._bagrovoeCounter, null); assert.equal(u.object._bagrovoeCounter.counter.text, '4');
});
test('linked tokens have independent effects, counters and turn markers but shared HP', async () => {
  const h = harness(), a = h.actor(), t = h.token(a), u = h.token(a);
  await h.api.apply(t); assert.equal(h.api.effectOf(u), undefined);
  await h.api.set(u, {level:3,count:2}); assert.equal(a.effects.length, 2);
  await Promise.all([h.api.tick(...h.combat(t)),h.api.tick(...h.combat(u))]); assert.equal(a.system.attributes.hp.value, 6);
  await h.api.stop(t); assert.equal(h.api.effectOf(u).getFlag(MOD, 'level'), 3);
  assert.throws(() => h.api.apply(a), /единственного/);
});
test('GM can replace, lower, clamp and remove; stack counts are whole numbers', async () => {
  const h = harness(), a = h.actor(), t = h.token(a);
  await h.api.apply(t, {levels:5,count:2}); await h.api.apply(t); assert.equal(h.api.effectOf(t).getFlag(MOD,'level'), 5);
  await h.api.set(t, {level:2,count:3.9}); assert.equal(h.api.effectOf(t).getFlag(MOD,'count'), 3);
  await h.api.set(t, {level:0}); assert.equal(a.effects.length, 0);
});
test('player healing clears bleeding via D&D5e previous HP metadata; temp HP does not', async () => {
  const h = harness(), a = h.actor('a', {hp:{value:10}}), t = h.token(a);
  await h.api.apply(t); await a.update({'system.attributes.hp.temp':5}); await h.flush(); assert.equal(a.effects.length, 1);
  await a.update({'system.attributes.hp.value':11}); await h.flush(); assert.equal(a.effects.length, 0);
});
test('non-leading GMs and players do not roll or tick', async () => {
  const h = harness(), a = h.actor(), t = h.token(a); await h.api.apply(t);
  h.c.game.user = {id:'gm2',isGM:true}; await h.api.tick(...h.combat(t)); await h.api.handleAttack(h.attack([t]));
  assert.equal(a.updates.length, 0); assert.equal(a.saves.length, 0); assert.throws(() => h.api.apply(t), /активный/);
  h.c.game.user = {id:'player',isGM:false}; assert.throws(() => h.api.apply(t), /ведущий/);
});
test('disabled effects have no counter or damage', async () => {
  const h = harness(), a = h.actor(), t = h.token(a); await h.api.apply(t);
  await h.api.effectOf(t).update({disabled:true}); await h.api.tick(...h.combat(t));
  assert.equal(a.updates.length, 0); assert.equal(t.object._bagrovoeCounter, null);
});
test('3.0 migration preserves levels, dice, disabled state and last turn marker on both linked tokens', async () => {
  const h = harness(), a = h.actor(), t = h.token(a), u = h.token(a);
  await a.createEmbeddedDocuments('ActiveEffect', [{disabled:false,flags:{[MOD]:{bleeding:true,level:4,count:2,dc:13,lastTick:'combat1:1:c1'}}}]);
  await h.api.migrateActor(a); assert.equal(a.effects.length, 2);
  assert.equal(h.api.effectOf(t).getFlag(MOD,'level'), 4); assert.equal(h.api.effectOf(u).getFlag(MOD,'count'), 2);
  await h.api.tick(...h.combat(t)); assert.equal(a.updates.length, 0);
  await h.api.migrateActor(a); assert.equal(a.effects.length, 2);
});
test('attack receipt prevents re-stacking if final chat flag write fails', async () => {
  const h = harness(), a = h.actor(), t = h.token(a), chat = h.attack([t]);
  const original = chat.setFlag; let fail = true;
  chat.setFlag = async function(scope,key,value) { if (fail && key.endsWith('.done')) { fail = false; throw new Error('chat update'); } return original.call(this,scope,key,value); };
  await assert.rejects(h.api.handleAttack(chat), /chat update/); await h.api.handleAttack(chat);
  assert.equal(a.saves.length, 1); assert.equal(h.api.effectOf(t).getFlag(MOD,'level'), 1);
});
test('registered creation and combat hooks reach automation', async () => {
  const h = harness(), a = h.actor(), t = h.token(a);
  h.Hooks.callAll('createChatMessage', h.attack([t])); await h.flush();
  assert.equal(a.effects.length, 1);
  const [combat,current] = h.combat(t); h.Hooks.callAll('combatTurnChange',combat,{},current); await h.flush();
  assert.equal(a.system.attributes.hp.value, 13);
});

const MOD = 'bagrovoe-bleeding';
const names = new Map([
  ['edrik-valter', ['Эдрик Вальтер — Алый Отступник', 'Эдрик Вальтер']],
  ['severin-velt', ['Северин Вельт — Алый Архитектор', 'Северин Вельт']],
  ['agata-morn', ['Агата Морн — Глас Причастия', 'Агата Морн']],
  ['laerin-tal-mir', ['Лаэрин Таль’Мир — Архидруид Суйгу', 'Лаэрин Таль’Мир']],
  ['nazir-khan', ['Назир’Хан — Собиратель историй', 'Назир’Хан']]
]);

// Exact old labels only: preserve custom names, actor IDs and all gameplay data.
Hooks.once('ready', async () => {
  if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
  try {
    for (const actor of game.actors) {
      const pair = names.get(actor.getFlag(MOD, 'sourceSlug'));
      if (!pair) continue;
      const patch = {};
      if (actor.name === pair[0]) patch.name = pair[1];
      if (actor.prototypeToken.name === pair[0]) patch['prototypeToken.name'] = pair[1];
      if (Object.keys(patch).length) await actor.update(patch);
    }
    for (const scene of game.scenes) {
      const updates = [];
      for (const token of scene.tokens) {
        const pair = names.get(token.actor?.getFlag(MOD, 'sourceSlug'));
        if (!pair) continue;
        if (!token.actorLink && token.actor.name === pair[0]) await token.actor.update({name: pair[1]});
        if (token.name === pair[0]) updates.push({_id: token.id, name: pair[1]});
      }
      if (updates.length) await scene.updateEmbeddedDocuments('Token', updates);
    }
  } catch (error) {
    console.error(MOD, 'NPC name update', error);
    ui.notifications.warn('Мир Ортес: не все имена NPC удалось обновить. Повторите вход ведущим.');
  }
});

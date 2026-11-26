const MOD = 'bagrovoe-bleeding';
// Entries replace the published base dice only. Bespoke damage on a world copy is preserved.
const changes = {
  'blood-barrier': ['+3', '+6'], 'vessel-hardening': ['+3', '+6'],
  'crimson-needle': ['2к6', '4к6'], 'scarlet-thread': ['2к6', '4к6'],
  'cutting-wave': ['3к6', '6к6'], 'blood-explosion': ['5к6', '10к6'],
  'artery-rupture': ['4к8', '7к8'], 'crimson-harvest': ['4к6', '9к6'],
  'pulse-disruption': ['3к6', '5к6'], 'vital-theft': ['3к8', '6к8'],
  'crimson-thorns': ['2к4', '3к4'], 'cathedral-of-wounds': ['3к8', '5к8'],
  'executioners-pulse': ['4к8', '7к8'],
  'vascular-pulse': ['7 временных', '14 временных'],
  'forced-reconstruction': ['10 временных', '20 временных']
};
export function bloodBalancePatch(item) {
  const key = item.flags?.[MOD]?.spellKey;
  if (!Object.hasOwn(changes, key)) return {};
  const [before, after] = changes[key], patch = {};
  for (const field of ['value', 'chat']) {
    const text = item.system.description?.[field];
    if (!text) continue;
    let revised = text.replaceAll(before, after);
    if (key === 'executioners-pulse') revised = revised.replaceAll('9к8', '12к8');
    if (revised !== text) patch['system.description.' + field] = revised;
  }
  for (const [id, activity] of Object.entries(item.system.activities ?? {})) {
    const path = 'system.activities.' + id;
    const part = activity.damage?.parts?.[0];
    if (part && before === part.number + 'к' + part.denomination) {
      const parts = structuredClone(activity.damage.parts);
      parts[0].number = parseInt(after);
      patch[path + '.damage.parts'] = parts;
    }
    if (activity.healing && before.startsWith(activity.healing.bonus + ' временных')) {
      patch[path + '.healing.bonus'] = String(parseInt(after));
    }
  }
  return patch;
}
export async function upgradeBloodItems() {
  if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
  const update = item => {
    const patch = bloodBalancePatch(item._source);
    return Object.keys(patch).length ? {_id:item.id, ...patch} : null;
  };
  const actors = new Map([...game.actors].map(a => [a.uuid,a]));
  for (const scene of game.scenes) for (const token of scene.tokens) {
    if (!token.actorLink && token.actor) actors.set(token.actor.uuid,token.actor);
  }
  for (const actor of actors.values()) {
    const patches = actor.items.map(update).filter(Boolean);
    if (patches.length) await actor.updateEmbeddedDocuments('Item', patches);
  }
  const patches = game.items.map(update).filter(Boolean);
  if (patches.length) await Item.updateDocuments(patches);
}
if (globalThis.Hooks) Hooks.once('ready', () => upgradeBloodItems().catch(e => {
  console.error(MOD, e); ui.notifications.error('Магия крови: ошибка обновления листов. ' + e.message);
}));

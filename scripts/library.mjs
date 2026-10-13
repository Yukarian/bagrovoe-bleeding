const MOD = 'bagrovoe-bleeding';
const parentId = folder => folder.folder?.id ?? folder.folder ?? null;

export async function configureLibrary() {
  if (!game.user?.isGM || game.users.activeGM?.id !== game.user.id) return;
  const module = game.modules.get(MOD);
  const packs = module.packs.map(p => game.packs.get(`${MOD}.${p.name}`)).filter(Boolean);
  // Persist actual server-side pack permissions, including existing world overrides.
  for (const pack of packs) {
    if (pack.ownership.PLAYER !== 'NONE' || pack.ownership.TRUSTED !== 'NONE') {
      await pack.configure({ownership: {...pack.ownership, PLAYER:'NONE', TRUSTED:'NONE', ASSISTANT:'OWNER', GAMEMASTER:'OWNER'}});
    }
  }
  if (game.settings.get(MOD, 'libraryLayoutVersion') >= 2) return;
  const own = new Set(packs.map(p => p.collection));
  const beneath = (folder, ancestor) => {
    const seen = new Set();
    while (folder && !seen.has(folder.id)) {
      if (folder.id === ancestor.id) return true;
      seen.add(folder.id); folder = game.folders.get(parentId(folder));
    }
    return false;
  };
  async function arrange(nodes, parent = null) {
    for (const node of nodes) {
      let folder = game.folders.find(f => f.type === 'Compendium' && f.name === node.name && parentId(f) === (parent?.id ?? null));
      if (node.name === 'Багровое Причастие') {
        const old = game.folders.find(f => f.type === 'Compendium' && f.name === node.name && !parentId(f));
        if (old) {
          const contents = game.packs.filter(p => beneath(p.folder, old));
          if (contents.length && contents.every(p => own.has(p.collection))) {
            await old.update({folder:parent.id}); folder = old;
          }
        }
      }
      folder ??= await Folder.create({name:node.name, type:'Compendium', folder:parent?.id ?? null, sorting:node.sorting ?? 'a', color:node.color ?? null});
      for (const name of node.packs ?? []) {
        const pack = game.packs.get(`${MOD}.${name}`);
        if (pack && pack.folder?.id !== folder.id) await pack.setFolder(folder);
      }
      await arrange(node.folders ?? [], folder);
    }
  }
  await arrange(module.packFolders);
  await game.settings.set(MOD, 'libraryLayoutVersion', 2);
}

Hooks.once('init', () => game.settings.register(MOD, 'libraryLayoutVersion', {scope:'world', config:false, type:Number, default:0}));
Hooks.once('ready', () => configureLibrary().catch(error => {
  console.error(MOD, error);
  ui.notifications.error('Мир Ортес: не удалось обновить доступ или папки библиотек. Подробности в консоли.');
}));

// One-time migration of this module's Actor libraries in the compendium sidebar.
// Uses the V14 public CompendiumCollection.setFolder API; source UUIDs stay unchanged.
const MOD='bagrovoe-bleeding',VERSION=1;
export async function organizeNpcDirectory(){
 if(!game.user.isGM||game.users.activeGM?.id!==game.user.id||game.settings.get(MOD,'npcDirectoryVersion')>=VERSION)return;
 let root=game.folders.find(f=>f.type==='Compendium'&&f.name==='Мир Ортес'&&!f.folder);
 root??=await Folder.create({name:'Мир Ортес',type:'Compendium',sorting:'m',color:'#35564a'});
 let folder=game.folders.find(f=>f.type==='Compendium'&&f.name==='NPC'&&(f.folder?.id??f.folder)===root.id);
 folder??=await Folder.create({name:'NPC',type:'Compendium',folder:root.id,sorting:'m',color:'#35564a'});
 const packs=[...game.modules.get(MOD).packs].filter(p=>p.type==='Actor');
 for(const metadata of packs){const pack=game.packs.get(`${MOD}.${metadata.name}`);if(!pack)throw Error('Не найдена библиотека NPC: '+metadata.name);await pack.setFolder(folder);}
 await game.settings.set(MOD,'npcDirectoryVersion',VERSION);
}
Hooks.once('init',()=>game.settings.register(MOD,'npcDirectoryVersion',{scope:'world',config:false,type:Number,default:0}));
Hooks.once('ready',()=>organizeNpcDirectory().catch(e=>{console.error('Ortes NPC folders',e);ui.notifications.warn('Мир Ортес: не удалось собрать раздел NPC. '+e.message);}));

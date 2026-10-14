// Secret state lives in a GM-only world compendium. World flags alone are not a secrecy boundary.
const MOD='bagrovoe-bleeding',PACK='world.ortes-private-state';
let cache=null,initializing;
const storageClass=()=>globalThis.foundry?.documents?.collections?.CompendiumCollection??globalThis.CompendiumCollection;
export const storageReady=()=>cache!==null||!storageClass();
export const privateEntries=()=>cache?[...cache.values()]:storageClass()?[]:(game.journal??[]);
export const settlementEntries=()=>privateEntries().filter(d=>d.getFlag(MOD,'village'));
export const settlementById=id=>privateEntries().find(d=>d.id===id);
export async function createPrivateEntry(data){const pack=game.packs?.get(PACK);if(!pack){if(cache||storageClass())throw Error('Закрытое хранилище недоступно.');return JournalEntry.create(data);}const doc=await JournalEntry.create({...data,folder:null},{pack:PACK,keepId:true});cache?.set(doc.id,doc);return doc;}
export function ensurePrivateStorage(){return initializing??=(initialize().finally(()=>{initializing=null;}));}
async function initialize(){if(!game.user.isGM)return;const cls=storageClass();if(!cls)return;const writer=game.users.activeGM?.id===game.user.id;let pack=game.packs.get(PACK);if(!pack){if(!writer)return;pack=await cls.createCompendium({name:'ortes-private-state',label:'Ортес — закрытые данные ведущего',type:'JournalEntry',ownership:{PLAYER:'NONE',TRUSTED:'NONE',ASSISTANT:'OWNER',GAMEMASTER:'OWNER'}});}if(writer)await pack.configure({locked:false,ownership:{PLAYER:'NONE',TRUSTED:'NONE',ASSISTANT:'OWNER',GAMEMASTER:'OWNER'}});cache=new Map((await pack.getDocuments()).map(d=>[d.id,d]));if(!writer)return;
 for(const source of game.journal.filter(d=>d.getFlag(MOD,'village')||d.getFlag(MOD,'ortesClockState'))){const flag=source.getFlag(MOD,'village')?'village':'ortesClockState';let target=cache.get(source.id);if(!target){target=await createPrivateEntry({_id:source.id,name:flag==='village'?source.name:'Ортес — календарь (служебный)',ownership:{default:0},pages:[],flags:{[MOD]:{[flag]:structuredClone(source.getFlag(MOD,flag)),settlementSeed:source.getFlag(MOD,'settlementSeed')}}});}if(JSON.stringify(target.getFlag(MOD,flag))!==JSON.stringify(source.getFlag(MOD,flag)))throw Error('Архив не подтверждён; перенос остановлен.');await source.update({[`flags.${MOD}.-=${flag}`]:null,[`flags.${MOD}.privateStateReference`]:target.id});}
}
Hooks.on('updateJournalEntry',d=>{if(cache&&d.pack===PACK)cache.set(d.id,d);});
Hooks.on('deleteJournalEntry',d=>{if(cache&&d.pack===PACK)cache.delete(d.id);});

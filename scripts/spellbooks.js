// Upgrade only identified module NPCs. Preserve a complete pre-upgrade snapshot on each actor.
(() => {
 const MOD='bagrovoe-bleeding',VERSION='4.3.0';
 // getFlag rejects inactive legacy package scopes in Foundry V14. Read stored metadata directly.
 const slug=a=>a?.flags?.[MOD]?.sourceSlug??a?.flags?.['bagrovoe-content']?.sourceSlug;
 const BOOKS=new Set(['mag-krovi-uron','mag-krovi-support','krovotvorec','alyj-providec','severin-velt','bagrovyj-ispovednik','agata-morn']);
 function plan(actor,source){
  const spells=source.items.filter(i=>i.type==='spell'),create=[],remove=[],prepare=[];
  for(const spell of spells){
   const key=spell.getFlag(MOD,'spellKey');
   const current=actor.items.find(i=>key?i.getFlag(MOD,'spellKey')===key:i.id===spell.id&&i.getFlag(MOD,'communionFeature'));
   if(current?.type==='spell'){
    if(!current.system.prepared)prepare.push({_id:current.id,'system.prepared':1});
    continue; // Preserve a user's existing spell text and activities.
   }
   const data=spell.toObject();delete data._id;delete data.folder;
   if(current){
    remove.push(current.id);data._id=current.id;
    if(key){
     const spent=Math.max(Number(current.system.uses?.spent??0),...[...current.system.activities].map(a=>Number(a.uses?.spent??0)));
     for(const a of Object.values(data.system.activities))if(a.uses?.max)a.uses.spent=Math.min(Number(a.uses.max),spent);
    }
   }
   create.push(data);
  }
  const update={};
  if(source.getFlag(MOD,'divineCaster')){
   if(!actor.system.attributes.spellcasting)update['system.attributes.spellcasting']='wis';
   if(!actor.system.attributes.spell?.level)update['system.attributes.spell.level']=source.system.attributes.spell.level;
   for(let n=1;n<=4;n++){
    const old=actor.system.spells[`spell${n}`],fresh=source.system.spells[`spell${n}`];
    if(fresh?.override>0&&!old?.override&&!old?.value&&!old?.max){update[`system.spells.spell${n}.override`]=fresh.override;update[`system.spells.spell${n}.value`]=fresh.value;}
   }
   update[`flags.${MOD}.divineCaster`]=true;
  }else update[`flags.${MOD}.bloodMagic`]=true;
  return {create,remove,prepare,update};
 }
 let running;
 function updateSpellbooks(){return running??=(runSpellbooks().finally(()=>{running=null;}));}
 async function runSpellbooks(){
  if(!game.user.isGM||game.users.activeGM?.id!==game.user.id)return 0;
  const pack=game.packs.get(`${MOD}.actors`);if(!pack)return 0;
  let phase='поиск NPC',target='',backedUp=false;
  try{
   const all=new Map([...game.actors].filter(a=>BOOKS.has(slug(a))).map(a=>[a.uuid,a]));
   // Do not instantiate unrelated or orphaned synthetic actors on every scene at startup.
   for(const scene of game.scenes)for(const token of scene.tokens){
    const base=game.actors.get?.(token.actorId)??game.actors.find(a=>a.id===token.actorId);
    if(!BOOKS.has(slug(base))&&!BOOKS.has(slug(token.delta)))continue;
    target=token.name??token.id;const actor=token.actor;if(actor)all.set(actor.uuid,actor);
   }
   const candidates=[...all.values()].filter(a=>a.type==='npc'&&a.getFlag(MOD,'spellbookVersion')!==VERSION&&!a.getFlag(MOD,'spellbookBackup430'));
   if(!candidates.length)return 0;
   phase='чтение бестиария';target='';
   const sources=(await pack.getDocuments()).filter(a=>a.getFlag(MOD,'spellbookVersion')===VERSION),bySlug=new Map(sources.map(a=>[slug(a),a]));
   let count=0;
   for(const actor of candidates){
    const source=bySlug.get(slug(actor));if(!source)continue;
    target=actor.name??actor.uuid;phase='подготовка обновления';backedUp=false;
    const p=plan(actor,source);
    phase='сохранение резервной записи';
    await actor.setFlag(MOD,'spellbookBackup430',{items:actor.items.map(i=>i.toObject()),spells:foundry.utils.deepClone(actor.system.spells),spell:foundry.utils.deepClone(actor.system.attributes.spell??{}),spellcasting:actor.system.attributes.spellcasting});
    backedUp=true;phase='обновление листа';
    // The backup flag is also an interruption receipt; never replay a partially completed upgrade.
    if(p.remove.length)await actor.deleteEmbeddedDocuments('Item',p.remove);
    if(p.create.length)await actor.createEmbeddedDocuments('Item',p.create,{keepId:true});
    if(p.prepare.length)await actor.updateEmbeddedDocuments('Item',p.prepare);
    await actor.update({...p.update,[`flags.${MOD}.spellbookVersion`]:VERSION});count++;
   }
   if(count)ui.notifications.info(`Мир Ортес: книги заклинаний обновлены у ${count} NPC. Исходные предметы сохранены в резервной записи актёров.`);
   return count;
  }catch(error){throw new Error(`Мир Ортес: ${phase}${target?' — '+target:''}. ${error.message}. ${backedUp?'Резервная запись сохранена; проверьте лист перед повторным обновлением.':'Предметы и параметры листа на этом шаге не изменялись.'}`,{cause:error});}
 }
 const errorText=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 globalThis.BagrovoeSpellbooks={plan,updateSpellbooks};
 Hooks.once('ready',()=>{const module=game.modules.get(MOD);module.api??={};module.api.updateSpellbooks=updateSpellbooks;void updateSpellbooks().catch(e=>{console.error(MOD,e);ui.notifications.error(errorText(e.message));});});
})();

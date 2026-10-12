// Upgrade only identified module NPCs. Preserve a complete pre-upgrade snapshot on each actor.
(() => {
 const MOD='bagrovoe-bleeding',VERSION='4.3.0';
 const slug=a=>a.getFlag(MOD,'sourceSlug')??a.getFlag('bagrovoe-content','sourceSlug');
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
 async function updateSpellbooks(){
  if(!game.user.isGM||game.users.activeGM?.id!==game.user.id)return 0;
  const pack=game.packs.get(`${MOD}.actors`);if(!pack)return 0;
  const sources=(await pack.getDocuments()).filter(a=>a.getFlag(MOD,'spellbookVersion')===VERSION),bySlug=new Map(sources.map(a=>[slug(a),a]));
  const all=[...new Map([...game.actors,...[...game.scenes].flatMap(s=>[...s.tokens].map(t=>t.actor))].filter(Boolean).map(a=>[a.uuid,a])).values()];let count=0;
  for(const actor of all){
   const source=bySlug.get(slug(actor));
   if(!source||actor.type!=='npc'||actor.getFlag(MOD,'spellbookVersion')===VERSION||actor.getFlag(MOD,'spellbookBackup430'))continue;
   const p=plan(actor,source);
   await actor.setFlag(MOD,'spellbookBackup430',{items:actor.items.map(i=>i.toObject()),spells:foundry.utils.deepClone(actor.system.spells),spell:foundry.utils.deepClone(actor.system.attributes.spell??{}),spellcasting:actor.system.attributes.spellcasting});
   // The backup flag is also an interruption receipt; never replay a partially completed upgrade.
   if(p.remove.length)await actor.deleteEmbeddedDocuments('Item',p.remove);
   if(p.create.length)await actor.createEmbeddedDocuments('Item',p.create,{keepId:true});
   if(p.prepare.length)await actor.updateEmbeddedDocuments('Item',p.prepare);
   await actor.update({...p.update,[`flags.${MOD}.spellbookVersion`]:VERSION});count++;
  }
  if(count)ui.notifications.info(`Мир Ортес: книги заклинаний обновлены у ${count} NPC. Исходные предметы сохранены в резервной записи актёров.`);
  return count;
 }
 globalThis.BagrovoeSpellbooks={plan,updateSpellbooks};
 Hooks.once('ready',()=>{game.modules.get(MOD).api.updateSpellbooks=updateSpellbooks;void updateSpellbooks().catch(e=>{console.error(MOD,e);ui.notifications.error('Мир Ортес: обновление книги NPC прервано. Резервная запись сохранена; проверьте лист перед повторным обновлением.');});});
})();

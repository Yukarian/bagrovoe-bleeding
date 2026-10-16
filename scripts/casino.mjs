import {installCasinoAnimations} from './casino-animation.mjs';
import {casinoHTML} from './casino-view.mjs';
import {activeCasinoGM,bootCasino,casinoSnapshot,requestCasino,recoverCasino,pendingCasino} from './casino-runtime.mjs';
installCasinoAnimations();
const MOD='bagrovoe-bleeding';const {ApplicationV2,DialogV2}=foundry.applications.api;
export class CasinoApp extends ApplicationV2{
 static DEFAULT_OPTIONS={id:'ortes-casino',classes:['ortes-casino'],window:{title:'Мир Ортес — Колесо фортуны',resizable:true},position:{width:900,height:800}};
 selected=null;request=null;sending=false;
 async _renderHTML(){const actors=game.actors.filter(a=>a.type==='character'&&(game.user.isGM||a.testUserPermission(game.user,'OWNER')));if(!actors.some(a=>a.id===this.selected))this.selected=actors[0]?.id??'';return casinoHTML(casinoSnapshot(),{actors,actor:this.selected,gm:game.user.isGM,busy:this.sending||this.waiting(),now:game.time.worldTime,pending:pendingCasino()});}
 waiting(){return !!this.request&&!game.messages.get(this.request)?.getFlag(MOD,'casinoHandled');}
 _replaceHTML(html,content){const s=casinoSnapshot(),key=[this.selected,s.table?.id,s.wallets[this.selected]?.slot?.id].join(':'),values=this.formKey===key?[...content.querySelectorAll('input[name],select[name]:not([data-actor])')].map(e=>({name:e.name,value:e.value,checked:e.checked})):[];const scroll=content.scrollTop;content.innerHTML=html;this.formKey=key;for(const v of values)for(const e of content.querySelectorAll(`[name="${v.name}"]`)){if(e.type==='checkbox'){if(e.value===v.value)e.checked=v.checked;}else e.value=v.value;}content.scrollTop=scroll;content.querySelector('[data-actor]')?.addEventListener('change',e=>{this.selected=e.target.value;void this.render({force:true});});content.addEventListener('click',this.handler??=e=>{const b=e.target.closest('[data-casino]');if(b&&!b.disabled){e.preventDefault();void this.command(b.dataset.casino,b.dataset.claim);}});}
 async command(action,claim){if(this.sending||(this.waiting()&&action!=='recover'))return;this.sending=true;try{
  if(action==='recover'){await recoverCasino();return;}
  const root=this.element,val=n=>root.querySelector(`[name="${n}"]`)?.value,num=n=>Number(val(n)),s=casinoSnapshot(),w=s.wallets[this.selected];
  const c={action,actor:this.selected};
  if(action==='enable'||action==='close'){c.action='enable';c.value=action==='enable';delete c.actor;}
  if(action==='buy'||action==='sell'){c.amount=num('exchange');if(!await DialogV2.confirm({window:{title:'Касса казино'},content:`<p>${action==='buy'?'Купить':'Продать'} ${c.amount} фишек за ${c.amount*10} зм?</p>`,defaultYes:false}))return;}
  if(action==='grant')c.amount=num('grant');
  if(action==='openTable'){c.game=val('game');c.stake=num('stake');c.dice=num('dealerDice');delete c.actor;}
  if(['join','resolveTable','cancelTable'].includes(action))c.round=s.table?.id;
  if(action==='join'){if(s.table?.game==='hand')c.dice=num('handDice');else{c.bets={};for(let i=1;i<=20;i++)if(num('bet'+i))c.bets[i]=num('bet'+i);}}
  if(action==='reroll'){c.round=w?.slot?.id;c.indices=[...root.querySelectorAll('[name="reel"]:checked')].map(e=>+e.value);}
  if(action==='delivered')c.claim=claim;
  const m=await requestCasino(c);this.request=m.id;
 }catch(e){ui.notifications.error(e.message);}finally{this.sending=false;await this.render({force:true});}}
}
let app;
export function openCasino(){app??=new CasinoApp();return app.render({force:true});}
function refresh(){if(app?.rendered&&!app.sending)void app.render({force:true});}
Hooks.once('ready',async()=>{globalThis.OrtesWorld={...(globalThis.OrtesWorld??{}),openCasino};const m=game.modules.get(MOD);m.api??={};m.api.casino={open:openCasino};if(activeCasinoGM())try{await bootCasino();}catch(e){ui.notifications.error('Казино: '+e.message);}});
Hooks.on('getSceneControlButtons',controls=>{if(controls.tokens)controls.tokens.tools.ortesCasino={name:'ortesCasino',title:'Мир Ортес — Казино',icon:'fa-solid fa-dice',order:102,button:true,visible:true,onChange:openCasino};});
for(const h of ['updateJournalEntry','createJournalEntry','updateActor','updateChatMessage','updateWorldTime'])Hooks.on(h,refresh);

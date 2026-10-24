// Reproducible, deliberately limited duel model; not a Foundry combat simulator.
import fs from 'node:fs';
const MOD='bagrovoe-bleeding',all=JSON.parse(fs.readFileSync(new URL('../packs-src/key-npcs.json',import.meta.url)));
const dragon=all.find(a=>a.flags[MOD].archmage&&a.flags[MOD].guise==='dragon');
const pair=['nimrael','ezrakil'].map(k=>all.find(a=>a.flags[MOD].sourceSlug===k));
let seed=20261024;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const roll=(n,d)=>Array.from({length:n},()=>1+Math.floor(random()*d)).reduce((a,b)=>a+b,0);
const mod=n=>Math.floor((n-10)/2);
const feature=(a,k)=>a.items.find(i=>i.system.identifier===k);
const first=i=>Object.values(i.system.activities)[0];
const pb=6;
function duel(opening){
 const p=pair.map(a=>({a,hp:a.system.attributes.hp.max,heal:100,channels:3,slots:[0,4,3,3,3,2]}));let dhp=dragon.system.attributes.hp.max,shield=4;
 let rounds=0,guardUsed=false;
 const attack=(bonus,ac)=>{const die=roll(1,20);return {hit:die===20||(die!==1&&die+bonus>=ac),crit:die===20};};
 const save=(who,ability,dc)=>roll(1,20)+mod(who.a.system.abilities[ability].value)+(who.a.system.abilities[ability].proficient?pb:0)+mod(who.a.system.abilities.cha.value)>=dc;
 const hitPaladin=(who,damage,isAttack=false)=>{if(isAttack&&who===p[1]&&p[0].hp>0&&!guardUsed){damage=Math.max(0,damage-roll(3,8)-6);guardUsed=true;}who.hp-=damage;};
 const bolt=()=>{const who=p[1].hp>0?p[1]:p[0];if(who.hp<=0)return;const b=first(feature(dragon,'archmage-legend-bolt'));const h=attack(Number(b.attack.bonus),who.a.system.attributes.ac.flat);if(h.hit)hitPaladin(who,roll(h.crit?8:4,10),true);};
 for(rounds=1;rounds<=12;rounds++){
  guardUsed=false;
  if(rounds===1&&opening==='maze'){
   // Boss acts first and removes one paladin without a save. The other spends its entire
   // first action plus a level-5 slot to free the target; no attack this round for rescuer.
   p[0].slots[5]--;
  }else if(rounds===(opening==='maze'?2:1)){
   // Four spheres can hit both. Apply Meteor Swarm once per target, separately by type.
   for(const who of p.filter(x=>x.hp>0)){const passed=save(who,'dex',21),fire=roll(20,6),bludgeon=roll(20,6);hitPaladin(who,Math.floor((passed?Math.floor(fire/2):fire)/2)+(passed?Math.floor(bludgeon/2):bludgeon));}
  }else{
   // Disintegrate is preferred over resisted breath, two casts at level 6; afterwards breath.
   if(rounds<=(opening==='maze'?4:3)){const who=p[1].hp>0?p[1]:p[0];if(!save(who,'dex',21))hitPaladin(who,roll(10,6)+40);}
   else for(const who of p.filter(x=>x.hp>0)){const damage=roll(17,6);hitPaladin(who,Math.floor((save(who,'dex',21)?Math.floor(damage/2):damage)/2));}
  }
  if(p.every(x=>x.hp<=0))return {win:false,rounds};
  const ac=dragon.system.attributes.ac.flat+(shield-->0?5:0);
  for(const [index,who]of p.entries()){
   if(who.hp<=0)continue;
   let bonusUsed=false;
   if(who.hp<65&&who.heal){const heal=Math.min(who.heal,who.a.system.attributes.hp.max-who.hp);who.hp+=heal;who.heal-=heal;bonusUsed=true;}
   if(!(opening==='maze'&&rounds===1&&index===0)){
    const weapon=first(feature(who.a,'midnight-weapon'));
    for(let n=0;n<2;n++){
     const hit=attack(Number(weapon.attack.bonus),ac);if(!hit.hit)continue;
     dhp-=roll(hit.crit?2:1,8)+Number(weapon.damage.parts[0].bonus)+roll(hit.crit?2:1,8);
     if(!bonusUsed){
      // Keep the last level-5 slot for the bespoke escape spell; use the next best slot.
      let level=[5,4,3,2,1].find(level=>who.slots[level]>(level===5?1:0));
      if(level){who.slots[level]--;bonusUsed=true;const channel=who.channels>0;if(channel)who.channels--;dhp-=roll((2+level+(channel?6:0))*(hit.crit?2:1),8);}
     }
     if(dhp<=0)return {win:true,rounds};
    }
   }
   // One legendary action at the end of each opposing turn, at most two per round.
   bolt();
  }
 }
 return {win:false,rounds:12};
}
const report={seed:20261024,trialsPerScenario:10000,scenarios:[]};
for(const opening of ['meteor','maze']){let wins=0,totalRounds=0;for(let n=0;n<10000;n++){const r=duel(opening);wins+=Number(r.win);totalRounds+=r.rounds;}report.scenarios.push({opening,winRate:wins/10000,meanRounds:totalRounds/10000});}
console.log(JSON.stringify(report,null,2));

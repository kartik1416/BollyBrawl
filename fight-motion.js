import {attackTiming} from './combat.js?v=pages16';

const smooth=(start,end,value)=>{
 const t=Math.max(0,Math.min(1,(value-start)/(end-start)));
 return t*t*(3-2*t);
};

export function strikePhases(attack){
 const {startup,active,recovery}=attackTiming(attack);
 const frame=attack.frame;
 const kick=attack.name!=='punch';
 const snap=smooth(startup*(attack.signature?.66:kick?.55:.43),startup,frame);
 const recoil=smooth(startup+(attack.signature?3:1),startup+active+(kick?5:3),frame);
 return {
  load:smooth(0,startup*.55,frame)*(1-snap),
  strike:snap*(1-recoil),
  chamber:Math.max(smooth(0,startup*.58,frame)*(1-snap),
   recoil*(1-smooth(startup+active+4,startup+active+recovery*.76,frame))),
  weight:smooth(0,startup,frame)*(1-smooth(startup+active,startup+active+recovery,frame)),
 };
}

// Original lines for BollyBrawl's fictional fighters.
export const signatureMoves={
 safari:{name:'Bhai ka Clinch',line:'Bhai ka haath hai, sambhal ke!',left:[.13,1.36,.38],right:[.035,1.38,.37],chest:[.12,-.14,.06],head:[.22,0,0]},
 blast:{name:'Flying Stunt Kick',line:'Stunt double ko chhutti de, bhai!',left:[.32,1.51,.25],right:[-.28,1.62,.28],chest:[-.13,.24,.18],head:[-.07,0,0],kick:true},
 spin:{name:'Don ka Shoulder Throw',line:'Don se panga? Ab landing sambhaal!',left:[.68,1.39,.24],right:[-.68,1.39,.24],chest:[-.16,0,.11],head:[-.12,.12,0]},
 slap:{name:'Dhobi Pachad',line:'Arre baba, kiraya baad mein. Pehle dhobi pachad!',left:[.23,1.43,.23],right:[-.10,1.78,.21],chest:[.12,.08,0],head:[.10,-.15,0]},
 burst:{name:'Bawa ka Bhala',line:'Chain meri, action bhi mera, samjha?',left:[.11,1.50,.25],right:[-.23,1.38,.29],chest:[-.12,-.22,0],head:[.21,0,0]},
 spit:{name:'Challan Takedown',line:'Challan katega. Seedha hawa mein!',left:[.24,1.33,.24],right:[-.12,1.72,.52],chest:[.06,.17,0],head:[-.06,-.16,0]},
};

export const signatureAmount=ticks=>Math.sin(Math.PI*Math.max(0,Math.min(1,ticks/54)))**.8;


export function warmupPose(progress,side){
 const t=Math.max(0,Math.min(1,progress));
 const sign=side===0?1:-1;
 const pulse=(a,b,c)=>smooth(a,b,t)*(1-smooth(b,c,t));
 const stretch=smooth(0,.14,t)*(1-smooth(.28,.46,t));
 const neck=pulse(.23,.43,.64);
 const firstStep=pulse(.48,.63,.78);
 const secondStep=pulse(.65,.80,.95);
 const roll=(t-.23)/.41*Math.PI*2;
 return {
  stretch,
  chest:[-.13*stretch,.16*sign*stretch,.06*neck],
  head:[Math.cos(roll)*.25*neck,Math.sin(roll)*.47*neck,Math.sin(roll)*.32*neck],
  legL:side===0?firstStep:secondStep,
  legR:side===0?secondStep:firstStep,
  weight:firstStep+secondStep,
 };
}





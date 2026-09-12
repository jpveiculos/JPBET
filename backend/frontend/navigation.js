(()=>{
'use strict';
window.__MYBETS_DEPLOY_SYNC__='2026-09-11';

const voltar=()=>window.history.length>1?window.history.back():location.assign('/');
window.voltarPaginaMyBets=voltar;

function geometriaMyBets(){
 const g=new Array(16);
 const grupos=[
  {prize:2,start:11.25},
  {prize:6,start:101.25},
  {prize:10,start:191.25},
  {prize:14,start:281.25}
 ];
 grupos.forEach(({prize,start})=>{
  g[prize]={startDeg:start,endDeg:start+67.5,centerDeg:start+33.75};
  for(let p=1;p<=3;p++){
   const i=(prize+p)%16;
   const s=start+67.5+(p-1)*7.5;
   g[i]={startDeg:s,endDeg:s+7.5,centerDeg:s+3.75};
  }
 });
 return g;
}

function criarRodaMyBets(){
 const wheel=document.getElementById('wheel');
 const svg=document.getElementById('rouletteSvg');
 if(!wheel||!svg)return;
 const r=(typeof ROLETAS!=='undefined'&&(ROLETAS[roletaAtual]||ROLETAS.sorte))||null;
 const seg=Array.isArray(r?.segments)?r.segments:[];
 if(seg.length!==16)return;
 const ns='http://www.w3.org/2000/svg',cx=250,cy=250,rad=238,g=geometriaMyBets();
 svg.innerHTML='';
 const lossColor='#c99724';
 const prizeColor='#050505';
 const textColor='#25e66b';
 const base=document.createElementNS(ns,'circle');
 base.setAttribute('cx',cx);base.setAttribute('cy',cy);base.setAttribute('r',rad);base.setAttribute('fill',lossColor);
 svg.appendChild(base);
 for(let i=0;i<16;i++){
  const label=String(seg[i]||'').trim();
  if(!label)continue;
  const s=g[i];
  const path=document.createElementNS(ns,'path');
  path.setAttribute('d',sectorPath(cx,cy,rad,s.startDeg,s.endDeg));
  path.setAttribute('fill',prizeColor);
  path.setAttribute('stroke','#d6a321');
  path.setAttribute('stroke-width','2');
  svg.appendChild(path);
  const p=polar(cx,cy,150,s.centerDeg);
  const text=document.createElementNS(ns,'text');
  text.textContent=label.toUpperCase();
  text.setAttribute('x',p.x);text.setAttribute('y',p.y);
  text.setAttribute('class','roulette-label multiplier');
  text.setAttribute('font-size',label.length>2?'52':'58');
  text.setAttribute('fill',textColor);
  text.style.fill=textColor;
  text.dataset.x=p.x;text.dataset.y=p.y;
  svg.appendChild(text);
 }
 const ring=document.createElementNS(ns,'circle');
 ring.setAttribute('cx',cx);ring.setAttribute('cy',cy);ring.setAttribute('r',rad);
 ring.setAttribute('fill','none');ring.setAttribute('stroke','#b97808');ring.setAttribute('stroke-width','12');
 svg.appendChild(ring);
 const hi=document.createElementNS(ns,'circle');
 hi.setAttribute('cx',cx);hi.setAttribute('cy',cy);hi.setAttribute('r',rad-8);
 hi.setAttribute('fill','none');hi.setAttribute('stroke','#f8d766');hi.setAttribute('stroke-width','2');
 svg.appendChild(hi);
 wheel.style.transition='none';
 wheel.style.transform='rotate(0deg)';
 roletaRotacaoAtual=0;
}

window.__MYBETS_ROULETTE_GEOMETRY__=geometriaMyBets;
window.__MYBETS_CREATE_ROULETTE__=criarRodaMyBets;
criarRoda=criarRodaMyBets;

animarRoleta=function(indice){
 return new Promise(resolve=>{
  const wheel=document.getElementById('wheel'),i=Number(indice),g=geometriaMyBets();
  if(!wheel||!Number.isInteger(i)||i<0||i>=16||!g[i])return resolve();
  const alvo=-g[i].centerDeg;
  const atual=Number(roletaRotacaoAtual)||0;
  const ma=((alvo%360)+360)%360;
  const mc=((atual%360)+360)%360;
  let ajuste=ma-mc;if(ajuste<0)ajuste+=360;
  const destino=atual+4*360+ajuste;
  const duracao=Math.max(1400,Number(configuracoes?.roulette_animation_ms)||1800);
  wheel.style.transform=`rotate(${atual}deg)`;
  if(typeof manterNumerosRetos==='function')manterNumerosRetos(atual);
  requestAnimationFrame(()=>{
   const inicio=performance.now();
   function frame(now){
    const p=Math.min(1,(now-inicio)/duracao);
    const e=1-Math.pow(1-p,3);
    const rot=atual+(destino-atual)*e;
    wheel.style.transform=`rotate(${rot}deg)`;
    if(typeof manterNumerosRetos==='function')manterNumerosRetos(rot);
    if(p<1)return requestAnimationFrame(frame);
    roletaRotacaoAtual=destino;
    wheel.style.transform=`rotate(${destino}deg)`;
    if(typeof manterNumerosRetos==='function')manterNumerosRetos(destino);
    resolve();
   }
   requestAnimationFrame(frame);
  });
  if(typeof tocarSom==='function')tocarSom('click');
 });
};

function aplicarLayoutMyBets(){
 if(document.getElementById('mybets-roulette-layout'))return;
 const style=document.createElement('style');
 style.id='mybets-roulette-layout';
 style.textContent=`
:root{--gold:#f5c542;--gold2:#ffdf75;--green:#25e66b;--bg:#05070b;}
html,body{background:#05070b!important;color:#fff!important;overflow-x:hidden!important;}
body{padding-bottom:100px!important;}
.header{height:84px!important;padding:0 18px!important;background:rgba(3,6,10,.96)!important;border-bottom:1px solid rgba(255,215,95,.14)!important;}
.logo{font-size:0!important;min-width:145px!important;line-height:1!important;}
.logo::before{content:'My';font-size:42px;font-style:italic;font-weight:900;color:#fff;letter-spacing:-3px;}
.logo::after{content:'Bets';font-size:42px;font-style:italic;font-weight:900;color:#f5c542;letter-spacing:-3px;}
.header-right{gap:12px!important;}
.header-balance{min-width:210px!important;text-align:center!important;padding:10px 16px!important;border:1px solid rgba(245,197,66,.55)!important;border-radius:18px!important;background:rgba(5,8,13,.92)!important;color:#ffdf75!important;font-size:18px!important;box-shadow:0 0 18px rgba(245,197,66,.07)!important;}
.menu-button{width:54px!important;height:54px!important;border:1px solid rgba(255,255,255,.16)!important;border-radius:16px!important;background:#080c13!important;color:#fff!important;font-size:30px!important;}
.container{width:min(1024px,100%)!important;padding:0 28px 130px!important;margin:0 auto!important;}
.welcome,.balance-card,.info{display:none!important;}
.section-title{display:none!important;}
.roulette-section-heading{display:none!important;}
.roulette-feature-card{background:transparent!important;border:0!important;padding:0!important;box-shadow:none!important;}
.roulette-feature-card h3{display:none!important;}
.roulette-area{width:min(760px,calc(100vw - 74px))!important;aspect-ratio:1!important;margin:10px auto 14px!important;filter:drop-shadow(0 18px 34px rgba(0,0,0,.8))!important;}
#rouletteSvg{overflow:visible!important;}
.roulette-label{font-weight:1000!important;paint-order:stroke fill!important;stroke:#06150a!important;stroke-width:4px!important;fill:#25e66b!important;}
.roulette-center-cover{width:39%!important;border-width:7px!important;box-shadow:0 0 0 3px #704508,0 0 28px rgba(255,193,32,.55),inset 0 0 24px rgba(255,193,32,.18)!important;}
.roulette-center-button{width:31%!important;min-width:150px!important;max-width:220px!important;border-width:7px!important;font-size:25px!important;}
.roulette-center-button::before{font-size:25px!important;}
.pointer{z-index:70!important;}
.roulette-balance{position:absolute!important;top:14px!important;left:16px!important;z-index:80!important;display:flex!important;align-items:center!important;gap:8px!important;padding:10px 16px!important;border:1px solid rgba(245,197,66,.52)!important;border-radius:14px!important;background:rgba(7,9,14,.96)!important;box-shadow:0 7px 22px rgba(0,0,0,.5)!important;color:#9ca4b2!important;font-size:15px!important;}
.roulette-balance strong{color:#ffdf75!important;font-size:18px!important;}
.roulette-explanation,.modal-subtitle,.rules,#rouletteResult{display:none!important;}
.roulette-bet-area{max-width:920px!important;margin:0 auto!important;}
.roulette-bet-area label{font-size:18px!important;color:#aeb5c2!important;}
.roulette-bet-area input{height:78px!important;border:1px solid #2d3544!important;border-radius:18px!important;background:#05070b!important;color:#fff!important;font-size:28px!important;padding:0 62px 0 24px!important;}
.mybets-bet-wrap{position:relative!important;}
.mybets-bet-wrap::after{content:'R$';position:absolute;right:22px;top:50%;transform:translateY(-50%);color:#a7afbe;font-size:25px;pointer-events:none;}
.quick-bets,.bet-buttons{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:12px!important;margin-top:12px!important;}
.quick-bets button,.bet-buttons button{height:64px!important;border:1px solid #f5c542!important;border-radius:15px!important;background:linear-gradient(180deg,#131b25,#0a0e15)!important;color:#fff!important;font-size:21px!important;font-weight:900!important;box-shadow:0 0 15px rgba(245,197,66,.11)!important;}
.quick-bets button:active,.bet-buttons button:active{transform:scale(.98)!important;background:#1a2028!important;}
.mybets-spin-main{display:block!important;width:100%!important;height:74px!important;margin:18px auto 0!important;border:1px solid #f5c542!important;border-radius:16px!important;background:linear-gradient(180deg,#ffd95a,#e8ad18)!important;color:#080808!important;font-size:30px!important;font-weight:1000!important;box-shadow:0 8px 26px rgba(245,197,66,.2)!important;}
.bottom-nav,.mobile-bottom-nav,nav.bottom-nav{position:fixed!important;left:0!important;right:0!important;bottom:0!important;z-index:1000!important;height:94px!important;background:rgba(4,7,12,.97)!important;border-top:1px solid rgba(255,255,255,.12)!important;backdrop-filter:blur(16px)!important;}
.bottom-nav *,.mobile-bottom-nav *{font-size:15px!important;}
@media(max-width:600px){
 .header{height:76px!important;padding:0 14px!important;}
 .logo{min-width:115px!important;}
 .logo::before{font-size:31px!important;}
 .logo::after{font-size:31px!important;}
 .header-balance{min-width:0!important;padding:9px 13px!important;font-size:15px!important;border-radius:15px!important;}
 .menu-button{width:48px!important;height:48px!important;font-size:27px!important;}
 .container{padding:0 15px 112px!important;}
 .roulette-area{width:min(600px,calc(100vw - 42px))!important;margin-top:8px!important;margin-bottom:12px!important;}
 .roulette-center-button{min-width:124px!important;max-width:155px!important;font-size:20px!important;}
 .roulette-center-button::before{font-size:20px!important;}
 .roulette-balance{top:10px!important;left:12px!important;padding:8px 11px!important;font-size:13px!important;}
 .roulette-balance strong{font-size:15px!important;}
 .roulette-bet-area input{height:72px!important;font-size:25px!important;}
 .quick-bets,.bet-buttons{gap:10px!important;}
 .quick-bets button,.bet-buttons button{height:58px!important;font-size:18px!important;}
 .mybets-spin-main{height:68px!important;font-size:27px!important;}
 .bottom-nav,.mobile-bottom-nav,nav.bottom-nav{height:86px!important;}
}
`;
 document.head.appendChild(style);

 const header=document.querySelector('.header');
 if(header){
  if(!header.querySelector('.mybets-menu-extra')){
   const menu=document.createElement('button');
   menu.type='button';menu.className='menu-button mybets-menu-extra';menu.textContent='☰';menu.setAttribute('aria-label','Menu');
   menu.onclick=()=>{const d=document.querySelector('.drawer-backdrop');if(d)d.style.display='block';};
   header.prepend(menu);
  }
  const hr=header.querySelector('.header-right')||header;
  if(!hr.querySelector('.mybets-profile-extra')){
   const profile=document.createElement('button');
   profile.type='button';profile.className='menu-button mybets-profile-extra';profile.textContent='●';profile.setAttribute('aria-label','Perfil');
   profile.style.borderRadius='50%';profile.style.fontSize='26px';
   profile.onclick=()=>{const a=document.querySelector('[data-action="account"],#accountButton,.account-button');if(a)a.click();};
   hr.appendChild(profile);
  }
 }

 const modal=document.getElementById('rouletteModal');
 if(modal){
  const mc=modal.querySelector('.modal-content');
  if(mc){mc.style.background='transparent';mc.style.border='0';mc.style.boxShadow='none';mc.style.maxWidth='1024px';}
  const close=modal.querySelector('.close');if(close)close.style.display='none';
  if(!modal.querySelector('.roulette-balance')){
   const b=document.createElement('div');b.className='roulette-balance';b.innerHTML='Saldo <strong id="rouletteBalance">R$ 0,00</strong>';
   mc?.prepend(b);
  }
 }

 const input=document.querySelector('#rouletteModal input[type="number"],#rouletteModal input[type="text"],input[name="rouletteBet"],input[name="betAmount"]');
 if(input&&!input.parentElement.classList.contains('mybets-bet-wrap')){
  const wrap=document.createElement('div');wrap.className='mybets-bet-wrap';
  input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
 }

 document.querySelectorAll('button').forEach(btn=>{
  const t=(btn.textContent||'').trim().replace(/\s+/g,' ');
  if(t==='GIRAR' && !btn.closest('.roulette-area'))btn.classList.add('mybets-spin-main');
 });

 document.querySelectorAll('.roulette-section-heading').forEach((h,i)=>{if(i>0)h.remove();});
 document.querySelectorAll('.roulette-promo').forEach(e=>e.remove());
 document.querySelectorAll('.roulette-explanation').forEach(e=>e.remove());

 const sync=()=>{
  const el=document.getElementById('rouletteBalance');if(!el)return;
  let v=0;
  try{v=typeof obterSaldo==='function'?obterSaldo():(window.usuarioAtual?.balance||0);}catch(_){v=0;}
  el.textContent='R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
 };
 sync();
 if(typeof window.atualizarSaldo==='function'&&!window.__MYBETS_BALANCE_WRAPPED__){
  const old=window.atualizarSaldo;
  window.atualizarSaldo=function(){const r=old.apply(this,arguments);sync();return r;};
  window.__MYBETS_BALANCE_WRAPPED__=true;
 }
}

document.addEventListener('DOMContentLoaded',()=>{
 aplicarLayoutMyBets();
 try{if(typeof criarRoda==='function')criarRoda();}catch(_){ }
});

if(document.readyState!=='loading')setTimeout(aplicarLayoutMyBets,0);
})();
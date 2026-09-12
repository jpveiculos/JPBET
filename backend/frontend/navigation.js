(()=>{
'use strict';
window.__MYBETS_DEPLOY_SYNC__='2026-09-11-roulette-screen-fix';

const voltar=()=>window.history.length>1?window.history.back():location.assign('/');
window.voltarPaginaMyBets=voltar;

function geometriaMyBets(){
 const g=new Array(16);
 const grupos=[{prize:2,start:11.25},{prize:6,start:101.25},{prize:10,start:191.25},{prize:14,start:281.25}];
 grupos.forEach(({prize,start})=>{
  g[prize]={startDeg:start,endDeg:start+67.5,centerDeg:start+33.75};
  for(let p=1;p<=3;p++){
   const i=(prize+p)%16,s=start+67.5+(p-1)*7.5;
   g[i]={startDeg:s,endDeg:s+7.5,centerDeg:s+3.75};
  }
 });
 return g;
}

function criarRodaMyBets(){
 const wheel=document.getElementById('wheel'),svg=document.getElementById('rouletteSvg');
 if(!wheel||!svg)return;
 const r=(typeof ROLETAS!=='undefined'&&(ROLETAS[roletaAtual]||ROLETAS.sorte))||null;
 const seg=Array.isArray(r?.segments)?r.segments:[];
 if(seg.length!==16)return;
 const ns='http://www.w3.org/2000/svg',cx=250,cy=250,rad=238,g=geometriaMyBets();
 svg.innerHTML='';
 const base=document.createElementNS(ns,'circle');
 base.setAttribute('cx',cx);base.setAttribute('cy',cy);base.setAttribute('r',rad);base.setAttribute('fill','#d39b21');
 svg.appendChild(base);
 for(let i=0;i<16;i++){
  const label=String(seg[i]||'').trim();
  if(!label)continue;
  const s=g[i];
  const path=document.createElementNS(ns,'path');
  path.setAttribute('d',sectorPath(cx,cy,rad,s.startDeg,s.endDeg));
  path.setAttribute('fill','#050505');path.setAttribute('stroke','#050505');path.setAttribute('stroke-width','0');
  svg.appendChild(path);
  const p=polar(cx,cy,150,s.centerDeg);
  const text=document.createElementNS(ns,'text');
  text.textContent=label.toUpperCase();
  text.setAttribute('x',p.x);text.setAttribute('y',p.y);
  text.setAttribute('class','roulette-label multiplier');
  text.setAttribute('font-size','58');text.setAttribute('fill','#25e66b');text.style.fill='#25e66b';
  text.dataset.x=p.x;text.dataset.y=p.y;
  svg.appendChild(text);
 }
 const ring=document.createElementNS(ns,'circle');
 ring.setAttribute('cx',cx);ring.setAttribute('cy',cy);ring.setAttribute('r',rad);ring.setAttribute('fill','none');ring.setAttribute('stroke','#b97808');ring.setAttribute('stroke-width','12');
 svg.appendChild(ring);
 const hi=document.createElementNS(ns,'circle');
 hi.setAttribute('cx',cx);hi.setAttribute('cy',cy);hi.setAttribute('r',rad-8);hi.setAttribute('fill','none');hi.setAttribute('stroke','#f8d766');hi.setAttribute('stroke-width','2');
 svg.appendChild(hi);
 wheel.style.transition='none';wheel.style.transform='rotate(0deg)';
 roletaRotacaoAtual=0;
}

window.__MYBETS_ROULETTE_GEOMETRY__=geometriaMyBets;
window.__MYBETS_CREATE_ROULETTE__=criarRodaMyBets;
criarRoda=criarRodaMyBets;

animarRoleta=function(indice){return new Promise(resolve=>{
 const wheel=document.getElementById('wheel'),i=Number(indice),g=geometriaMyBets();
 if(!wheel||!Number.isInteger(i)||i<0||i>=16||!g[i])return resolve();
 const alvo=-g[i].centerDeg,atual=Number(roletaRotacaoAtual)||0;
 const ma=((alvo%360)+360)%360,mc=((atual%360)+360)%360;
 let ajuste=ma-mc;if(ajuste<0)ajuste+=360;
 const destino=atual+4*360+ajuste;
 const duracao=Math.max(1400,Number(configuracoes?.roulette_animation_ms)||1800);
 wheel.style.transform=`rotate(${atual}deg)`;
 if(typeof manterNumerosRetos==='function')manterNumerosRetos(atual);
 requestAnimationFrame(()=>{
  const inicio=performance.now();
  function frame(now){
   const p=Math.min(1,(now-inicio)/duracao),e=1-Math.pow(1-p,3),rot=atual+(destino-atual)*e;
   wheel.style.transform=`rotate(${rot}deg)`;
   if(typeof manterNumerosRetos==='function')manterNumerosRetos(rot);
   if(p<1)return requestAnimationFrame(frame);
   roletaRotacaoAtual=destino;wheel.style.transform=`rotate(${destino}deg)`;
   if(typeof manterNumerosRetos==='function')manterNumerosRetos(destino);
   resolve();
  }
  requestAnimationFrame(frame);
 });
 if(typeof tocarSom==='function')tocarSom('click');
});};

function aplicarLayoutMyBets(){
 if(document.getElementById('mybets-roulette-layout'))return;
 const style=document.createElement('style');
 style.id='mybets-roulette-layout';
 style.textContent=`
:root{--gold:#f5c542;--gold2:#ffdf75;--green:#25e66b;--bg:#04070b;}
html,body{margin:0!important;background:#04070b!important;color:#fff!important;overflow-x:hidden!important;}
body{padding-bottom:0!important;background-image:radial-gradient(circle at 50% 42%,rgba(245,197,66,.08),transparent 38%),repeating-linear-gradient(125deg,transparent 0 120px,rgba(245,197,66,.025) 121px 124px,transparent 125px 245px)!important;}
body.mybets-roulette-open{overflow:hidden!important;}
.header{height:76px!important;padding:0 14px!important;background:rgba(3,6,10,.97)!important;border-bottom:1px solid rgba(255,215,95,.16)!important;display:flex!important;align-items:center!important;gap:10px!important;position:sticky!important;top:0!important;z-index:700!important;}
.logo{font-size:0!important;min-width:112px!important;line-height:1!important;order:2!important;}
.logo span,.logo b{display:none!important;}
.logo::before{content:'My';font-size:32px;font-style:italic;font-weight:900;color:#fff;letter-spacing:-3px;}
.logo::after{content:'Bets';font-size:32px;font-style:italic;font-weight:900;color:#f5c542;letter-spacing:-3px;}
.player-back-button{display:none!important;}
.header-right{margin-left:auto!important;display:flex!important;align-items:center!important;gap:7px!important;order:3!important;}
.header-balance{min-width:190px!important;text-align:center!important;padding:8px 10px!important;border:1px solid rgba(245,197,66,.55)!important;border-radius:15px!important;background:rgba(5,8,13,.96)!important;color:#ffdf75!important;font-size:15px!important;box-shadow:0 0 18px rgba(245,197,66,.08)!important;}
.menu-button{width:54px!important;height:54px!important;border:1px solid rgba(255,255,255,.16)!important;border-radius:16px!important;background:#080c13!important;color:#fff!important;font-size:30px!important;}
.mybets-profile-extra{width:46px!important;min-width:46px!important;height:46px!important;border-radius:50%!important;font-size:23px!important;color:#fff!important;}
.container{width:min(1024px,100%)!important;margin:0 auto!important;padding:0 15px 100px!important;}
.welcome,.balance-card,.info,.roulette-section-heading,.roulette-promo,.roulette-explanation{display:none!important;}
.games{display:block!important;margin:0!important;}
.game-card.roulette-feature-card{display:block!important;padding:0!important;min-height:0!important;background:transparent!important;border:0!important;box-shadow:none!important;}
.roulette-feature-card h3,.roulette-feature-card>.game-button{display:none!important;}
.modal{position:fixed!important;inset:0!important;z-index:800!important;display:none!important;align-items:center!important;justify-content:center!important;padding:0!important;background:rgba(0,0,0,.88)!important;}
.modal[style*="display: flex"],.modal[style*="display:flex"],.modal[style*="display: block"],.modal[style*="display:block"]{display:flex!important;}
body.mybets-roulette-open #rouletteModal{display:flex!important;}
body.mybets-roulette-open .history-list,body.mybets-roulette-open .history,body.mybets-roulette-open .section-title{display:none!important;}
.modal-content{position:relative!important;width:100%!important;max-width:none!important;height:100%!important;max-height:none!important;overflow-x:hidden!important;overflow-y:auto!important;padding:92px 18px 120px!important;margin:0!important;border:0!important;border-radius:0!important;background:radial-gradient(circle at 50% 35%,rgba(245,197,66,.08),transparent 32%),#04070b!important;box-shadow:none!important;}
#rouletteModal .modal-content{padding-top:92px!important;}
.modal-content>.close,.modal-title,.modal-subtitle,.rules{display:none!important;}
.roulette-area{width:min(88vw,520px)!important;aspect-ratio:1!important;margin:10px auto 22px!important;filter:drop-shadow(0 18px 35px rgba(0,0,0,.82))!important;}
#wheel,#rouletteSvg{width:100%!important;height:100%!important;}
.pointer{top:-7px!important;width:70px!important;height:88px!important;z-index:80!important;}
.roulette-center-cover{width:39%!important;border-width:7px!important;}
.roulette-center-button{width:31%!important;min-width:116px!important;max-width:150px!important;border-width:7px!important;font-size:19px!important;}
.roulette-center-button::before{font-size:19px!important;}
.roulette-label{fill:#25e66b!important;stroke:#06150a!important;stroke-width:4px!important;font-weight:1000!important;}
.roulette-label.multiplier{font-size:50px!important;}
.bet-area{width:min(920px,100%)!important;margin:0 auto!important;}
.input-label{font-size:17px!important;color:#aeb5c2!important;margin-bottom:8px!important;}
.mybets-bet-wrap{position:relative!important;width:100%!important;}
.input{width:100%!important;height:72px!important;padding:0 65px 0 24px!important;border:1px solid #2d3544!important;border-radius:18px!important;background:#05070b!important;color:#fff!important;font-size:25px!important;}
.mybets-bet-wrap::after{content:'R$';position:absolute;right:22px;top:50%;transform:translateY(-50%);color:#a7afbe;font-size:23px;pointer-events:none;}
.quick-values{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:10px!important;margin-top:12px!important;}
.quick-button{height:58px!important;padding:0!important;border:1px solid #f5c542!important;border-radius:15px!important;background:linear-gradient(180deg,#131b25,#0a0e15)!important;color:#fff!important;font-size:18px!important;font-weight:900!important;box-shadow:0 0 15px rgba(245,197,66,.12)!important;}
.mybets-spin-main{display:block!important;width:100%!important;height:68px!important;margin:16px 0 0!important;border:1px solid #f5c542!important;border-radius:18px!important;background:linear-gradient(180deg,#ffd95a,#e8ad18)!important;color:#080808!important;font-size:29px!important;font-weight:1000!important;box-shadow:0 8px 26px rgba(245,197,66,.2)!important;}
.roulette-result{display:none!important;height:0!important;margin:0!important;padding:0!important;}
#mybetsBottomNav{position:fixed;left:0;right:0;bottom:0;height:86px;z-index:1000;display:grid;grid-template-columns:repeat(5,1fr);background:rgba(3,6,10,.98);border-top:1px solid rgba(255,255,255,.14);padding-bottom:env(safe-area-inset-bottom);}
#mybetsBottomNav button{border:0;background:transparent;color:#aeb5c2;font-size:12px;font-weight:800;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;}
#mybetsBottomNav button.active{color:#ffda4f;}
#mybetsBottomNav .nav-icon{font-size:25px;line-height:1;}
@media(min-width:700px){.roulette-area{width:min(58vw,560px)!important;}}
@media(max-width:430px){.header-balance{min-width:0!important;flex:1!important;font-size:14px!important;padding-left:7px!important;padding-right:7px!important;}.logo{min-width:105px!important;}.logo::before,.logo::after{font-size:29px!important;}.mybets-profile-extra{width:44px!important;min-width:44px!important;}.menu-button{width:52px!important;height:52px!important;}}
`;
 document.head.appendChild(style);

 const header=document.querySelector('.header');
 if(header){
  const menu=header.querySelector('.header-right .menu-button');
  if(menu)header.insertBefore(menu,header.firstChild);
  const hr=header.querySelector('.header-right')||header;
  let hb=hr.querySelector('.header-balance');
  if(!hb){hb=document.createElement('div');hb.className='header-balance';hr.insertBefore(hb,hr.firstChild);}
  if(!hr.querySelector('.mybets-profile-extra')){
   const profile=document.createElement('button');profile.type='button';profile.className='menu-button mybets-profile-extra';profile.textContent='👤';profile.setAttribute('aria-label','Perfil');hr.appendChild(profile);
  }
 }

 const input=document.getElementById('betAmount');
 if(input&&input.parentElement&&!input.parentElement.classList.contains('mybets-bet-wrap')){
  const wrap=document.createElement('div');wrap.className='mybets-bet-wrap';input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
 }
 const spin=document.getElementById('spinButton');
 const betArea=spin?.closest('.modal-content')?.querySelector('.bet-area');
 if(betArea&&!betArea.querySelector('.mybets-spin-main')){
  const b=document.createElement('button');b.type='button';b.className='mybets-spin-main';b.textContent='GIRAR';b.onclick=()=>girarRoleta();betArea.appendChild(b);
 }

 const nav=document.getElementById('mybetsBottomNav')||document.createElement('nav');
 nav.id='mybetsBottomNav';
 nav.innerHTML=`<button type="button" data-nav="home"><span class="nav-icon">⌂</span><span>Início</span></button><button type="button" class="active" data-nav="roulette"><span class="nav-icon">◉</span><span>Roleta</span></button><button type="button" data-nav="games"><span class="nav-icon">🎮</span><span>Jogos</span></button><button type="button" data-nav="deposit"><span class="nav-icon">▣</span><span>Depósito</span></button><button type="button" data-nav="history"><span class="nav-icon">◷</span><span>Histórico</span></button>`;
 if(!nav.parentNode)document.body.appendChild(nav);

 const abrirMyBets=()=>{
  document.body.classList.add('mybets-roulette-open');
  const modal=document.getElementById('rouletteModal');
  if(modal)modal.style.display='flex';
  try{criarRodaMyBets();}catch(_){try{if(typeof criarRoda==='function')criarRoda();}catch(__){}}
  window.scrollTo({top:0,behavior:'instant'});
 };
 const fecharMyBets=()=>{
  document.body.classList.remove('mybets-roulette-open');
  const modal=document.getElementById('rouletteModal');
  if(modal)modal.style.display='none';
 };
 window.mybetsAbrirRoleta=abrirMyBets;
 window.mybetsFecharRoleta=fecharMyBets;

 nav.querySelector('[data-nav="home"]').onclick=()=>{fecharMyBets();window.scrollTo({top:0,behavior:'smooth'});};
 nav.querySelector('[data-nav="roulette"]').onclick=()=>abrirMyBets();
 nav.querySelector('[data-nav="games"]').onclick=()=>{fecharMyBets();document.querySelector('.games')?.scrollIntoView({behavior:'smooth'});};
 nav.querySelector('[data-nav="deposit"]').onclick=()=>{fecharMyBets();if(typeof abrirDeposito==='function')abrirDeposito();};
 nav.querySelector('[data-nav="history"]').onclick=()=>{fecharMyBets();if(typeof carregarHistorico==='function')carregarHistorico();};

 document.querySelectorAll('.roulette-section-heading').forEach((e,i)=>{if(i>0)e.remove();});
 document.querySelectorAll('.roulette-promo,.roulette-explanation').forEach(e=>e.remove());

 const sync=()=>{
  const hb=document.querySelector('.header-balance');
  let v=0;
  try{v=typeof obterSaldo==='function'?obterSaldo():(window.usuarioAtual?.balance||0);}catch(_){v=0;}
  const txt='R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  if(hb)hb.textContent='Saldo  '+txt;
 };
 sync();
 if(typeof window.atualizarSaldo==='function'&&!window.__MYBETS_BALANCE_WRAPPED__){
  const old=window.atualizarSaldo;
  window.atualizarSaldo=function(){const r=old.apply(this,arguments);sync();return r;};
  window.__MYBETS_BALANCE_WRAPPED__=true;
 }

 abrirMyBets();
}

document.addEventListener('DOMContentLoaded',()=>{
 aplicarLayoutMyBets();
 try{criarRodaMyBets();}catch(_){try{if(typeof criarRoda==='function')criarRoda();}catch(__){}}
});
if(document.readyState!=='loading')setTimeout(aplicarLayoutMyBets,0);
})();

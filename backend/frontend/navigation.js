(()=>{
'use strict';
window.__MYBETS_DEPLOY_SYNC__='2026-09-11';
const voltar=()=>window.history.length>1?window.history.back():location.assign('/');
window.voltarPaginaMyBets=voltar;

function geometriaMyBets(){
 const g=new Array(16);
 const grupos=[{prize:2,start:11.25},{prize:6,start:101.25},{prize:10,start:191.25},{prize:14,start:281.25}];
 grupos.forEach(({prize,start})=>{
  g[prize]={startDeg:start,endDeg:start+67.5,centerDeg:start+33.75};
  for(let p=1;p<=3;p++){const i=(prize+p)%16,s=start+67.5+(p-1)*7.5;g[i]={startDeg:s,endDeg:s+7.5,centerDeg:s+3.75};}
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
 const base=document.createElementNS(ns,'circle');base.setAttribute('cx',cx);base.setAttribute('cy',cy);base.setAttribute('r',rad);base.setAttribute('fill','#c99724');svg.appendChild(base);
 for(let i=0;i<16;i++){
  const label=String(seg[i]||'').trim();if(!label)continue;const s=g[i];
  const path=document.createElementNS(ns,'path');path.setAttribute('d',sectorPath(cx,cy,rad,s.startDeg,s.endDeg));path.setAttribute('fill','#050505');path.setAttribute('stroke','#d6a321');path.setAttribute('stroke-width','2');svg.appendChild(path);
  const p=polar(cx,cy,150,s.centerDeg),text=document.createElementNS(ns,'text');text.textContent=label.toUpperCase();text.setAttribute('x',p.x);text.setAttribute('y',p.y);text.setAttribute('class','roulette-label multiplier');text.setAttribute('font-size',label.length>2?'52':'58');text.setAttribute('fill','#25e66b');text.style.fill='#25e66b';text.dataset.x=p.x;text.dataset.y=p.y;svg.appendChild(text);
 }
 const ring=document.createElementNS(ns,'circle');ring.setAttribute('cx',cx);ring.setAttribute('cy',cy);ring.setAttribute('r',rad);ring.setAttribute('fill','none');ring.setAttribute('stroke','#b97808');ring.setAttribute('stroke-width','12');svg.appendChild(ring);
 const hi=document.createElementNS(ns,'circle');hi.setAttribute('cx',cx);hi.setAttribute('cy',cy);hi.setAttribute('r',rad-8);hi.setAttribute('fill','none');hi.setAttribute('stroke','#f8d766');hi.setAttribute('stroke-width','2');svg.appendChild(hi);
 wheel.style.transition='none';wheel.style.transform='rotate(0deg)';roletaRotacaoAtual=0;
}
window.__MYBETS_ROULETTE_GEOMETRY__=geometriaMyBets;
window.__MYBETS_CREATE_ROULETTE__=criarRodaMyBets;
criarRoda=criarRodaMyBets;

animarRoleta=function(indice){return new Promise(resolve=>{
 const wheel=document.getElementById('wheel'),i=Number(indice),g=geometriaMyBets();if(!wheel||!Number.isInteger(i)||i<0||i>=16||!g[i])return resolve();
 const alvo=-g[i].centerDeg,atual=Number(roletaRotacaoAtual)||0,ma=((alvo%360)+360)%360,mc=((atual%360)+360)%360;let ajuste=ma-mc;if(ajuste<0)ajuste+=360;
 const destino=atual+4*360+ajuste,duracao=Math.max(1400,Number(configuracoes?.roulette_animation_ms)||1800);
 wheel.style.transform=`rotate(${atual}deg)`;if(typeof manterNumerosRetos==='function')manterNumerosRetos(atual);
 requestAnimationFrame(()=>{const inicio=performance.now();function frame(now){const p=Math.min(1,(now-inicio)/duracao),e=1-Math.pow(1-p,3),rot=atual+(destino-atual)*e;wheel.style.transform=`rotate(${rot}deg)`;if(typeof manterNumerosRetos==='function')manterNumerosRetos(rot);if(p<1)return requestAnimationFrame(frame);roletaRotacaoAtual=destino;wheel.style.transform=`rotate(${destino}deg)`;if(typeof manterNumerosRetos==='function')manterNumerosRetos(destino);resolve();}requestAnimationFrame(frame);});
 if(typeof tocarSom==='function')tocarSom('click');
});};

function aplicarLayoutMyBets(){
 if(document.getElementById('mybets-roulette-layout'))return;
 const style=document.createElement('style');style.id='mybets-roulette-layout';style.textContent=`
:root{--gold:#f5c542;--gold2:#ffdf75;--green:#25e66b;--bg:#04070b;}
html,body{margin:0!important;background:#04070b!important;color:#fff!important;overflow-x:hidden!important;}
body{padding-bottom:96px!important;background-image:radial-gradient(circle at 50% 42%,rgba(245,197,66,.10),transparent 38%),repeating-linear-gradient(125deg,transparent 0 120px,rgba(245,197,66,.035) 121px 124px,transparent 125px 245px)!important;}
.header{height:84px!important;padding:0 18px!important;background:rgba(3,6,10,.97)!important;border-bottom:1px solid rgba(255,215,95,.18)!important;display:flex!important;align-items:center!important;gap:14px!important;}
.logo{font-size:0!important;min-width:150px!important;line-height:1!important;order:2!important;}
.logo span,.logo b{display:none!important;}
.logo::before{content:'My';font-size:42px;font-style:italic;font-weight:900;color:#fff;letter-spacing:-3px;}
.logo::after{content:'Bets';font-size:42px;font-style:italic;font-weight:900;color:#f5c542;letter-spacing:-3px;}
.player-back-button{display:none!important;}
.header-right{margin-left:auto!important;display:flex!important;align-items:center!important;gap:12px!important;order:3!important;}
.header-right .menu-button{order:-1!important;}
.header-balance{min-width:205px!important;text-align:center!important;padding:10px 16px!important;border:1px solid rgba(245,197,66,.55)!important;border-radius:18px!important;background:rgba(5,8,13,.94)!important;color:#ffdf75!important;font-size:18px!important;box-shadow:0 0 18px rgba(245,197,66,.08)!important;}
.menu-button{width:54px!important;height:54px!important;border:1px solid rgba(255,255,255,.16)!important;border-radius:16px!important;background:#080c13!important;color:#fff!important;font-size:30px!important;}
.mybets-profile-extra{border-radius:50%!important;font-size:25px!important;color:#fff!important;}
.container{width:min(1024px,100%)!important;margin:0 auto!important;padding:0 28px 125px!important;}
.welcome,.balance-card,.info,.roulette-section-heading,.roulette-promo,.roulette-explanation{display:none!important;}
.games{display:block!important;margin:0!important;}
.game-card.roulette-feature-card{display:block!important;padding:0!important;min-height:0!important;background:transparent!important;border:0!important;box-shadow:none!important;}
.roulette-feature-card h3,.roulette-feature-card>.game-button{display:none!important;}
.modal{position:relative!important;inset:auto!important;z-index:1!important;display:block!important;padding:0!important;background:transparent!important;}
.modal-content{position:relative!important;width:100%!important;max-width:1024px!important;max-height:none!important;overflow:visible!important;padding:16px 0 20px!important;margin:0 auto!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;}
.modal-content>.close,.modal-title,.modal-subtitle,.rules{display:none!important;}
.roulette-area{width:min(760px,calc(100vw - 140px))!important;aspect-ratio:1!important;margin:16px auto 22px!important;filter:drop-shadow(0 18px 35px rgba(0,0,0,.82))!important;}
#wheel,#rouletteSvg{width:100%!important;height:100%!important;}
.pointer{top:-32px!important;width:76px!important;height:92px!important;z-index:80!important;}
.roulette-center-cover{width:39%!important;border-width:7px!important;}
.roulette-center-button{width:31%!important;min-width:145px!important;max-width:210px!important;border-width:7px!important;font-size:25px!important;}
.roulette-center-button::before{font-size:25px!important;}
.roulette-label{fill:#25e66b!important;stroke:#06150a!important;stroke-width:4px!important;font-weight:1000!important;}
.roulette-balance{position:absolute!important;top:8px!important;left:0!important;z-index:90!important;display:flex!important;align-items:center!important;gap:8px!important;padding:9px 15px!important;border:1px solid rgba(245,197,66,.55)!important;border-radius:14px!important;background:rgba(7,9,14,.96)!important;color:#a5adbb!important;font:800 15px Arial!important;}
.roulette-balance strong{color:#ffdf75!important;font-size:18px!important;}
.bet-area{width:min(920px,100%)!important;margin:0 auto!important;}
.input-label{font-size:18px!important;color:#aeb5c2!important;margin-bottom:9px!important;}
.mybets-bet-wrap{position:relative!important;width:100%!important;}
.input{width:100%!important;height:78px!important;padding:0 65px 0 24px!important;border:1px solid #2d3544!important;border-radius:18px!important;background:#05070b!important;color:#fff!important;font-size:28px!important;}
.mybets-bet-wrap::after{content:'R$';position:absolute;right:22px;top:50%;transform:translateY(-50%);color:#a7afbe;font-size:25px;pointer-events:none;}
.quick-values{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:12px!important;margin-top:12px!important;}
.quick-button{height:64px!important;padding:0!important;border:1px solid #f5c542!important;border-radius:15px!important;background:linear-gradient(180deg,#131b25,#0a0e15)!important;color:#fff!important;font-size:21px!important;font-weight:900!important;box-shadow:0 0 15px rgba(245,197,66,.12)!important;}
.mybets-spin-main{display:block!important;width:100%!important;height:74px!important;margin:18px 0 0!important;border:1px solid #f5c542!important;border-radius:16px!important;background:linear-gradient(180deg,#ffd95a,#e8ad18)!important;color:#080808!important;font-size:30px!important;font-weight:1000!important;box-shadow:0 8px 26px rgba(245,197,66,.2)!important;}
.roulette-result{display:none!important;height:0!important;margin:0!important;padding:0!important;}
.bottom-nav,.mobile-bottom-nav,nav.bottom-nav{position:fixed!important;left:0!important;right:0!important;bottom:0!important;z-index:1000!important;height:94px!important;background:rgba(3,6,10,.98)!important;border-top:1px solid rgba(255,255,255,.14)!important;backdrop-filter:blur(16px)!important;}
@media(max-width:600px){
 .header{height:76px!important;padding:0 14px!important;gap:8px!important;}
 .logo{min-width:112px!important;order:2!important;}
 .logo::before{font-size:30px!important;}
 .logo::after{font-size:30px!important;}
 .header-right{gap:7px!important;}
 .header-balance{min-width:0!important;padding:8px 10px!important;border-radius:14px!important;font-size:15px!important;}
 .header-right .menu-button{width:0!important;min-width:0!important;height:0!important;padding:0!important;border:0!important;overflow:hidden!important;}
 .mybets-profile-extra{width:46px!important;min-width:46px!important;height:46px!important;border:1px solid rgba(255,255,255,.18)!important;}
 .container{padding:0 15px 108px!important;}
 .roulette-area{width:min(540px,calc(100vw - 150px))!important;margin:18px auto 20px!important;}
 .roulette-balance{top:2px!important;left:0!important;padding:8px 11px!important;font-size:13px!important;}
 .roulette-balance strong{font-size:15px!important;}
 .pointer{top:-28px!important;width:64px!important;height:78px!important;}
 .pointer::before{width:50px!important;height:61px!important;top:6px!important;}
 .pointer::after{width:40px!important;height:51px!important;top:11px!important;}
 .roulette-center-button{min-width:116px!important;max-width:145px!important;font-size:19px!important;}
 .roulette-center-button::before{font-size:19px!important;}
 .roulette-label.multiplier{font-size:50px!important;}
 .input{height:72px!important;font-size:25px!important;}
 .quick-values{gap:10px!important;}
 .quick-button{height:58px!important;font-size:18px!important;}
 .mybets-spin-main{height:68px!important;font-size:27px!important;}
 .bottom-nav,.mobile-bottom-nav,nav.bottom-nav{height:86px!important;}
}
`;
 document.head.appendChild(style);

 const header=document.querySelector('.header');
 if(header){
  const menu=header.querySelector('.header-right .menu-button');
  if(menu){header.insertBefore(menu,header.firstChild);}
  const hr=header.querySelector('.header-right')||header;
  let hb=hr.querySelector('.header-balance');
  if(!hb){hb=document.createElement('div');hb.className='header-balance';hb.textContent='Saldo  R$ 0,00';hr.insertBefore(hb,hr.firstChild);}
  if(!hr.querySelector('.mybets-profile-extra')){
   const profile=document.createElement('button');profile.type='button';profile.className='menu-button mybets-profile-extra';profile.textContent='●';profile.setAttribute('aria-label','Perfil');hr.appendChild(profile);
  }
 }

 const modal=document.getElementById('rouletteModal');
 if(modal){
  const mc=modal.querySelector('.modal-content');
  if(mc){mc.style.background='transparent';mc.style.border='0';mc.style.boxShadow='none';}
  const close=modal.querySelector('.close');if(close)close.style.display='none';
  if(mc&&!mc.querySelector('.roulette-balance')){const b=document.createElement('div');b.className='roulette-balance';b.innerHTML='Saldo <strong id="rouletteBalance">R$ 0,00</strong>';mc.prepend(b);}
 }

 const input=document.getElementById('betAmount');
 if(input&&!input.parentElement.classList.contains('mybets-bet-wrap')){const wrap=document.createElement('div');wrap.className='mybets-bet-wrap';input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);}

 const spin=document.getElementById('spinButton');
 const betArea=spin?.closest('.modal-content')?.querySelector('.bet-area');
 if(betArea&&!betArea.querySelector('.mybets-spin-main')){const b=document.createElement('button');b.type='button';b.className='mybets-spin-main';b.textContent='GIRAR';b.onclick=()=>girarRoleta();betArea.appendChild(b);}

 document.querySelectorAll('.roulette-section-heading').forEach((e,i)=>{if(i>0)e.remove();});
 document.querySelectorAll('.roulette-promo,.roulette-explanation').forEach(e=>e.remove());

 const sync=()=>{
  const el=document.getElementById('rouletteBalance');
  const hb=document.querySelector('.header-balance');
  let v=0;try{v=typeof obterSaldo==='function'?obterSaldo():(window.usuarioAtual?.balance||0);}catch(_){v=0;}
  const txt='R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  if(el)el.textContent=txt;
  if(hb)hb.textContent='Saldo  '+txt;
 };
 sync();
 if(typeof window.atualizarSaldo==='function'&&!window.__MYBETS_BALANCE_WRAPPED__){const old=window.atualizarSaldo;window.atualizarSaldo=function(){const r=old.apply(this,arguments);sync();return r;};window.__MYBETS_BALANCE_WRAPPED__=true;}
}

document.addEventListener('DOMContentLoaded',()=>{aplicarLayoutMyBets();try{if(typeof criarRoda==='function')criarRoda();}catch(_){}});
if(document.readyState!=='loading')setTimeout(aplicarLayoutMyBets,0);
})();
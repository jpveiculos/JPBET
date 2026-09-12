(()=>{
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
 const ns='http://www.w3.org/2000/svg',cx=250,cy=250,rad=238,g=geometriaMyBets();svg.innerHTML='';
 const lossColor=(typeof configuracoes!=='undefined'&&configuracoes.roulette_loss_color)||'#c99724';
 const prizeColor=(typeof configuracoes!=='undefined'&&configuracoes.roulette_prize_color)||'#050505';
 const textColor=(typeof configuracoes!=='undefined'&&configuracoes.roulette_text_color)||'#25e66b';
 const base=document.createElementNS(ns,'circle');base.setAttribute('cx',cx);base.setAttribute('cy',cy);base.setAttribute('r',rad);base.setAttribute('fill',lossColor);svg.appendChild(base);
 for(let i=0;i<16;i++){
  const label=String(seg[i]||'').trim();if(!label)continue;const s=g[i];
  const path=document.createElementNS(ns,'path');path.setAttribute('d',sectorPath(cx,cy,rad,s.startDeg,s.endDeg));path.setAttribute('fill',prizeColor);path.setAttribute('stroke','#d6a321');path.setAttribute('stroke-width','2');svg.appendChild(path);
  const p=polar(cx,cy,150,s.centerDeg),text=document.createElementNS(ns,'text');text.textContent=label.toUpperCase();text.setAttribute('x',p.x);text.setAttribute('y',p.y);text.setAttribute('class','roulette-label multiplier');text.setAttribute('font-size',label.length>2?'52':'58');text.setAttribute('fill',textColor);text.style.fill=textColor;text.dataset.x=p.x;text.dataset.y=p.y;svg.appendChild(text);
 }
 const ring=document.createElementNS(ns,'circle');ring.setAttribute('cx',cx);ring.setAttribute('cy',cy);ring.setAttribute('r',rad);ring.setAttribute('fill','none');ring.setAttribute('stroke','#a66f08');ring.setAttribute('stroke-width','11');svg.appendChild(ring);
 const hi=document.createElementNS(ns,'circle');hi.setAttribute('cx',cx);hi.setAttribute('cy',cy);hi.setAttribute('r',rad-7);hi.setAttribute('fill','none');hi.setAttribute('stroke','#f5d66a');hi.setAttribute('stroke-width','2');svg.appendChild(hi);
 wheel.style.transition='none';wheel.style.transform='rotate(0deg)';roletaRotacaoAtual=0;
}
window.__MYBETS_ROULETTE_GEOMETRY__=geometriaMyBets;
criarRoda=criarRodaMyBets;

animarRoleta=function(indice){return new Promise(resolve=>{
 const wheel=document.getElementById('wheel'),i=Number(indice),g=geometriaMyBets();if(!wheel||!Number.isInteger(i)||i<0||i>=16||!g[i])return resolve();
 const alvo=-g[i].centerDeg,atual=Number(roletaRotacaoAtual)||0,ma=((alvo%360)+360)%360,mc=((atual%360)+360)%360;let ajuste=ma-mc;if(ajuste<0)ajuste+=360;
 const destino=atual+4*360+ajuste,duracao=Math.max(1400,Number(configuracoes.roulette_animation_ms)||1800);
 wheel.style.transform=`rotate(${atual}deg)`;if(typeof manterNumerosRetos==='function')manterNumerosRetos(atual);
 requestAnimationFrame(()=>{const inicio=performance.now();function frame(now){const p=Math.min(1,(now-inicio)/duracao),e=1-Math.pow(1-p,3),rot=atual+(destino-atual)*e;wheel.style.transform=`rotate(${rot}deg)`;if(typeof manterNumerosRetos==='function')manterNumerosRetos(rot);if(p<1)return requestAnimationFrame(frame);roletaRotacaoAtual=destino;wheel.style.transform=`rotate(${destino}deg)`;if(typeof manterNumerosRetos==='function')manterNumerosRetos(destino);resolve();}requestAnimationFrame(frame);});if(typeof tocarSom==='function')tocarSom('click');
});};

document.addEventListener('DOMContentLoaded',()=>{
 const style=document.createElement('style');style.id='mybets-approved-roulette-layout';style.textContent=`
  .roulette-section-heading{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;margin:22px 0 14px!important;}
  .roulette-section-heading .roulette-section-heading{display:none!important;}
  .roulette-section-heading h2{margin:0!important;}
  .roulette-section-heading>span{font-size:12px!important;color:#9299a6!important;font-weight:800!important;}
  .roulette-promo{display:none!important;}
  .roulette-feature-card{padding:22px!important;min-height:0!important;}
  .roulette-feature-card h3{font-size:21px!important;margin:0 0 14px!important;}
  .roulette-feature-card .game-button{margin-top:0!important;}
  #rouletteModal{padding:0!important;background:#05070b!important;align-items:stretch!important;justify-content:stretch!important;}
  #rouletteModal .modal-content{width:100%!important;max-width:none!important;height:100dvh!important;max-height:none!important;margin:0!important;border:0!important;border-radius:0!important;background:radial-gradient(circle at 50% 45%,#17130a 0,#07090e 38%,#030406 100%)!important;padding:92px 22px 92px!important;overflow-x:hidden!important;overflow-y:auto!important;box-sizing:border-box!important;position:relative!important;}
  #rouletteModal .close,#rouletteModal #rouletteTitle,#rouletteModal #rouletteSubtitle,#rouletteModal #rouletteRules,#rouletteModal .roulette-explanation{display:none!important;}
  #rouletteModal .roulette-area{width:min(560px,calc(100vw - 36px))!important;margin:0 auto 22px!important;filter:drop-shadow(0 15px 30px rgba(0,0,0,.75))!important;}
  #rouletteModal #wheel{width:100%!important;height:auto!important;aspect-ratio:1!important;}
  #rouletteModal .pointer{z-index:90!important;top:-8px!important;}
  #rouletteModal .roulette-center-button{z-index:80!important;}
  #rouletteModal .roulette-center-button::before{content:'MyBets'!important;}
  #rouletteModal .bet-area{width:min(900px,calc(100vw - 48px))!important;margin:8px auto 0!important;}
  #rouletteModal .input-label{font-size:17px!important;color:#aeb5c5!important;}
  #rouletteModal #betAmount{height:68px!important;font-size:28px!important;border:1px solid #303745!important;background:#07090d!important;border-radius:16px!important;padding:0 22px!important;box-sizing:border-box!important;}
  #rouletteModal .quick-values{gap:10px!important;margin-top:12px!important;}
  #rouletteModal .quick-button{height:58px!important;border:1px solid #f1c72f!important;border-radius:12px!important;background:linear-gradient(180deg,#17202b,#0d131b)!important;color:#fff!important;font-size:20px!important;font-weight:900!important;box-shadow:0 0 14px rgba(242,198,44,.12)!important;}
  #rouletteModal .roulette-balance-header{position:absolute!important;top:18px!important;right:18px!important;left:auto!important;transform:none!important;z-index:100!important;display:flex!important;align-items:center!important;gap:10px!important;padding:10px 18px!important;border:1px solid #80661b!important;border-radius:14px!important;background:rgba(7,9,13,.96)!important;box-shadow:0 5px 20px rgba(0,0,0,.5)!important;color:#aeb5c5!important;font-size:16px!important;font-weight:800!important;white-space:nowrap!important;}
  #rouletteModal .roulette-balance-header strong{color:#ffd84d!important;font-size:21px!important;}
  #rouletteModal .roulette-top-logo{position:absolute!important;top:20px!important;left:18px!important;z-index:100!important;color:#fff!important;font-size:25px!important;font-weight:900!important;font-style:italic!important;letter-spacing:-1px!important;}
  #rouletteModal .roulette-top-logo b{color:#f5c62f!important;}
  #rouletteModal .roulette-bottom-spin{width:min(900px,calc(100vw - 48px))!important;height:66px!important;margin:18px auto 18px!important;display:block!important;border:1px solid #ffd43b!important;border-radius:14px!important;background:linear-gradient(180deg,#ffd75a,#e9ad16)!important;color:#08090b!important;font-size:30px!important;font-weight:1000!important;box-shadow:0 7px 25px rgba(235,179,25,.24)!important;}
  #rouletteModal .roulette-bottom-nav{position:fixed!important;left:0!important;right:0!important;bottom:0!important;height:78px!important;z-index:110!important;display:grid!important;grid-template-columns:repeat(5,1fr)!important;background:rgba(3,5,9,.98)!important;border-top:1px solid #252b35!important;}
  #rouletteModal .roulette-bottom-nav button{border:0!important;background:transparent!important;color:#aeb5c5!important;font-size:11px!important;font-weight:800!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;}
  #rouletteModal .roulette-bottom-nav button.active{color:#ffdc42!important;}
  #rouletteModal .roulette-bottom-nav .nav-icon{font-size:25px!important;line-height:1!important;}
  #rouletteModal .roulette-result{display:none!important;height:0!important;margin:0!important;padding:0!important;}
  @media(max-width:600px){
   #rouletteModal .modal-content{padding:76px 16px 92px!important;}
   #rouletteModal .roulette-area{width:min(430px,calc(100vw - 28px))!important;margin-bottom:12px!important;}
   #rouletteModal .pointer{top:-10px!important;}
   #rouletteModal .roulette-balance-header{top:12px!important;right:14px!important;left:auto!important;font-size:13px!important;padding:8px 11px!important;gap:7px!important;}
   #rouletteModal .roulette-balance-header strong{font-size:16px!important;}
   #rouletteModal .roulette-top-logo{top:14px!important;left:14px!important;font-size:20px!important;}
   #rouletteModal .roulette-bottom-spin{height:60px!important;font-size:26px!important;margin-top:14px!important;}
   #rouletteModal .bet-area{width:calc(100vw - 28px)!important;}
   #rouletteModal #betAmount{height:62px!important;font-size:25px!important;}
   #rouletteModal .quick-button{height:54px!important;font-size:18px!important;}
   #rouletteModal .roulette-bottom-nav{height:72px!important;}
  }
 `;document.head.appendChild(style);
 const heads=document.querySelectorAll('.roulette-section-heading');if(heads.length){const first=heads[0];first.innerHTML='<h2 class="section-title">🎰 Roletas</h2><span>GIRE E MULTIPLIQUE</span>';for(let i=1;i<heads.length;i++)heads[i].remove();}
 const modal=document.getElementById('rouletteModal');
 if(modal){const content=modal.querySelector('.modal-content');
  if(content&&!content.querySelector('.roulette-top-logo')){const logo=document.createElement('div');logo.className='roulette-top-logo';logo.innerHTML='My<b>Bets</b>';content.prepend(logo);}
  if(content&&!content.querySelector('.roulette-balance-header')){const b=document.createElement('div');b.className='roulette-balance-header';b.innerHTML='Saldo <strong id="rouletteBalance">R$ 0,00</strong>';content.prepend(b);}
  if(content&&!content.querySelector('.roulette-bottom-spin')){const spin=document.createElement('button');spin.type='button';spin.className='roulette-bottom-spin';spin.textContent='GIRAR';spin.onclick=()=>{if(typeof girarRoleta==='function')girarRoleta();};content.appendChild(spin);}
  if(!modal.querySelector('.roulette-bottom-nav')){const nav=document.createElement('nav');nav.className='roulette-bottom-nav';nav.innerHTML='<button type="button" onclick="voltarPaginaMyBets()"><span class="nav-icon">⌂</span><span>Início</span></button><button type="button" class="active"><span class="nav-icon">◉</span><span>Roleta</span></button><button type="button"><span class="nav-icon">🎮</span><span>Jogos</span></button><button type="button" onclick="abrirDeposito();fecharRoleta()"><span class="nav-icon">▣</span><span>Depósito</span></button><button type="button" onclick="carregarHistorico();fecharRoleta()"><span class="nav-icon">◷</span><span>Histórico</span></button>';modal.appendChild(nav);}
 }
 const sync=()=>{const el=document.getElementById('rouletteBalance');if(!el)return;let v=0;try{v=typeof obterSaldo==='function'?obterSaldo():(typeof usuarioAtual!=='undefined'?(usuarioAtual?.balance||0):0);}catch(_){}el.textContent='R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});};sync();
 const oldAtualizar=window.atualizarSaldo;if(typeof oldAtualizar==='function'&&!oldAtualizar.__mybetsWrapped){const wrapped=function(v){const r=oldAtualizar.apply(this,arguments);sync();return r;};wrapped.__mybetsWrapped=true;window.atualizarSaldo=wrapped;}
 const result=document.getElementById('rouletteResult');if(result)result.style.display='none';
 const e=document.querySelector('.roulette-explanation small');if(e)e.textContent='Aposte de R$ 0,50 a R$ 100 • Prêmios: 2×, 3×, 5× e 10×';
});
})();

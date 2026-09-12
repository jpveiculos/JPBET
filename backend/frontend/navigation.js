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
 const ns='http://www.w3.org/2000/svg',cx=250,cy=250,rad=238,g=geometriaMyBets();
 svg.innerHTML='';
 const lossColor=(typeof configuracoes!=='undefined'&&configuracoes.roulette_loss_color)||'#c99724';
 const prizeColor=(typeof configuracoes!=='undefined'&&configuracoes.roulette_prize_color)||'#050505';
 const textColor=(typeof configuracoes!=='undefined'&&configuracoes.roulette_text_color)||'#25e66b';
 const base=document.createElementNS(ns,'circle');
 base.setAttribute('cx',cx);base.setAttribute('cy',cy);base.setAttribute('r',rad);base.setAttribute('fill',lossColor);
 svg.appendChild(base);
 for(let i=0;i<16;i++){
  const label=String(seg[i]||'').trim(); if(!label)continue; const s=g[i];
  const path=document.createElementNS(ns,'path');
  path.setAttribute('d',sectorPath(cx,cy,rad,s.startDeg,s.endDeg));path.setAttribute('fill',prizeColor);path.setAttribute('stroke','#d6a321');path.setAttribute('stroke-width','2');
  svg.appendChild(path);
  const p=polar(cx,cy,150,s.centerDeg),text=document.createElementNS(ns,'text');
  text.textContent=label.toUpperCase();text.setAttribute('x',p.x);text.setAttribute('y',p.y);text.setAttribute('class','roulette-label multiplier');text.setAttribute('font-size',label.length>2?'52':'58');text.setAttribute('fill',textColor);text.style.fill=textColor;text.dataset.x=p.x;text.dataset.y=p.y;svg.appendChild(text);
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
 wheel.style.transform=`rotate(${atual}deg)`;manterNumerosRetos(atual);requestAnimationFrame(()=>{const inicio=performance.now();function frame(now){const p=Math.min(1,(now-inicio)/duracao),e=1-Math.pow(1-p,3),rot=atual+(destino-atual)*e;wheel.style.transform=`rotate(${rot}deg)`;manterNumerosRetos(rot);if(p<1)return requestAnimationFrame(frame);roletaRotacaoAtual=destino;wheel.style.transform=`rotate(${destino}deg)`;manterNumerosRetos(destino);resolve();}requestAnimationFrame(frame);});if(typeof tocarSom==='function')tocarSom('click');
});};

document.addEventListener('DOMContentLoaded',()=>{
 const style=document.createElement('style');style.textContent=`
  .roulette-section-heading{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;margin:22px 0 14px!important;}
  .roulette-section-heading .roulette-section-heading{display:none!important;}
  .roulette-section-heading h2{margin:0!important;}
  .roulette-section-heading>span{font-size:12px!important;color:#9299a6!important;font-weight:800!important;}
  .roulette-promo{display:none!important;}
  .roulette-feature-card{padding:22px!important;min-height:0!important;}
  .roulette-feature-card h3{font-size:21px!important;margin:0 0 14px!important;}
  .roulette-feature-card .game-button{margin-top:0!important;}
  #rouletteModal .modal-content{padding-top:64px!important;}
  #rouletteModal .roulette-area{margin-top:28px!important;}
  #rouletteModal .roulette-balance{position:absolute;top:14px;left:16px;z-index:80;display:flex;align-items:center;gap:7px;padding:9px 13px;border:1px solid rgba(245,197,66,.35);border-radius:12px;background:rgba(12,14,18,.94);box-shadow:0 5px 18px rgba(0,0,0,.35);color:#9299a6;font:800 12px Arial;}
  #rouletteModal .roulette-balance strong{color:#ffdf75;font-size:15px;}
  #rouletteModal .pointer{z-index:70!important;}
  #rouletteModal .roulette-result{display:none!important;height:0!important;margin:0!important;padding:0!important;}
  @media(max-width:600px){#rouletteModal .modal-content{padding-top:62px!important;}#rouletteModal .roulette-area{width:min(430px,calc(100vw - 42px))!important;margin-top:26px!important;}#rouletteModal .roulette-balance{top:13px;left:14px;}}
 `;document.head.appendChild(style);
 const heads=document.querySelectorAll('.roulette-section-heading');if(heads.length){const first=heads[0];first.innerHTML='<h2 class="section-title">🎰 Roletas</h2><span>GIRE E MULTIPLIQUE</span>';for(let i=1;i<heads.length;i++)heads[i].remove();}
 const modal=document.getElementById('rouletteModal');if(modal&&!modal.querySelector('.roulette-balance')){const b=document.createElement('div');b.className='roulette-balance';b.innerHTML='Saldo <strong id="rouletteBalance">R$ 0,00</strong>';modal.querySelector('.modal-content')?.prepend(b);}
 const sync=()=>{const el=document.getElementById('rouletteBalance');if(!el)return;const v=typeof obterSaldo==='function'?obterSaldo():(window.usuarioAtual?.balance||0);el.textContent='R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});};
 sync();
 const oldAtualizar=window.atualizarSaldo;if(typeof oldAtualizar==='function')window.atualizarSaldo=function(v){const r=oldAtualizar.apply(this,arguments);sync();return r;};
 const result=document.getElementById('rouletteResult');if(result)result.style.display='none';
 const e=document.querySelector('.roulette-explanation small');if(e)e.textContent='Aposte de R$ 0,50 a R$ 100 • Prêmios: 2×, 3×, 5× e 10×';
});
})();

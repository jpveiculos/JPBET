(() => {
  function drawPreview() {
    const svg = document.getElementById('roulettePreviewSvg');
    const r = window.ROLETAS && window.ROLETAS.sorte;
    if (!svg || !r || !Array.isArray(r.segments) || r.segments.length !== 16 || !window.polar || !window.sectorPath) return;
    const ns='http://www.w3.org/2000/svg', cx=250, cy=250, radius=238, angle=22.5;
    const prize={0:'#35ff78',4:'#3da5ff',8:'#ffc02e',12:'#ff4040'};
    svg.innerHTML='';
    r.segments.forEach((label,i)=>{
      const g=document.createElementNS(ns,'g'), p=document.createElementNS(ns,'path'), a=i*angle;
      p.setAttribute('d',window.sectorPath(cx,cy,radius,a,a+angle));
      p.setAttribute('fill',String(label||'').trim()?'#080808':(i%2?'#dca928':'#c9941f'));
      p.setAttribute('stroke','#d6a321'); p.setAttribute('stroke-width','2'); g.appendChild(p);
      if(String(label||'').trim()){
        const q=window.polar(cx,cy,157,a+angle/2), t=document.createElementNS(ns,'text'), c=prize[i]||'#25e66b';
        t.textContent=String(label).toUpperCase(); t.setAttribute('x',q.x); t.setAttribute('y',q.y); t.setAttribute('class','roulette-label multiplier'); t.setAttribute('font-size','58'); t.setAttribute('fill',c); t.style.fill=c; g.appendChild(t);
      }
      svg.appendChild(g);
    });
    const ring=document.createElementNS(ns,'circle'); ring.setAttribute('cx',cx); ring.setAttribute('cy',cy); ring.setAttribute('r',radius); ring.setAttribute('fill','none'); ring.setAttribute('stroke','#a66f08'); ring.setAttribute('stroke-width','11'); svg.appendChild(ring);
    const hi=document.createElementNS(ns,'circle'); hi.setAttribute('cx',cx); hi.setAttribute('cy',cy); hi.setAttribute('r',radius-7); hi.setAttribute('fill','none'); hi.setAttribute('stroke','#f5d66a'); hi.setAttribute('stroke-width','2'); svg.appendChild(hi);
  }

  function apply(){
    if(!document.querySelector('.container') || !document.querySelector('.games')) return;
    if(!document.getElementById('mybets-final-css')){
      const s=document.createElement('style'); s.id='mybets-final-css'; s.textContent=''
      +'.mybets-logo{display:inline-flex!important;align-items:baseline;position:relative;text-decoration:none!important;font-style:italic!important;font-weight:1000!important;letter-spacing:-2px!important;line-height:1!important}.mybets-logo span{color:#f4f4f4!important}.mybets-logo b{color:#f5c542!important}.mybets-logo:after{content:"";position:absolute;left:18%;right:0;bottom:-7px;height:4px;background:#f5c542;border-radius:50%;transform:skewX(-18deg)}'
      +'.player-back-button{border:1px solid rgba(245,197,66,.45)!important;background:#171710!important;color:#ffd75c!important;border-radius:16px!important;width:82px!important;height:54px!important;font-size:29px!important;font-weight:900!important}'
      +'.balance-card{padding:18px!important;background:linear-gradient(145deg,rgba(41,35,18,.9),rgba(19,19,16,.96))!important}.balance-summary{display:grid!important;grid-template-columns:1fr 1fr;gap:12px}.balance-stat{min-width:0;padding:17px 14px!important;border-radius:18px!important;background:rgba(255,255,255,.025)!important;border:1px solid rgba(245,197,66,.55)!important;display:flex!important;align-items:center;gap:12px}.balance-stat>div{min-width:0}.balance-stat span:not(.balance-icon){display:block;color:#a7adb8;font-size:16px;margin-bottom:4px}.balance-stat strong{display:block;color:#ffd34d;font-size:clamp(27px,7vw,39px);font-weight:1000;white-space:nowrap}.bonus-stat strong{color:#e3b32d}.balance-icon{width:44px;height:44px;display:grid;place-items:center;flex:0 0 44px;font-size:30px}.wallet-icon{color:#4df0b1;border:2px solid #4df0b1;border-radius:9px;font-size:22px}.balance-actions{display:grid!important;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.balance-actions button{min-height:64px!important;border-radius:17px!important;font-size:24px!important;font-weight:900!important}'
      +'.roulette-section-heading{display:flex!important;align-items:end;justify-content:space-between;gap:10px}.roulette-section-heading .section-title{margin:26px 0 13px}.roulette-section-heading>span{color:#d9a923;font-size:14px;font-weight:900;letter-spacing:1.5px;padding-bottom:8px}.games{grid-template-columns:1fr!important;gap:18px}.roulette-feature-card{padding:0 0 16px!important;overflow:hidden;border:1px solid rgba(245,197,66,.75)!important;background:linear-gradient(145deg,#17130a,#090b0e 60%,#111)!important}.roulette-promo{min-height:315px;display:grid;grid-template-columns:42% 58%;align-items:center;padding:8px 12px 0;background:linear-gradient(120deg,#17140d,#0b0d10 55%,#12120f)}.roulette-promo-copy{position:relative;height:100%;display:flex;flex-direction:column;justify-content:center}.roulette-brand{font-size:30px;line-height:.9;font-weight:1000;font-style:italic}.roulette-brand i{display:block;color:#f5bd35}.roulette-brand strong{display:block;color:#f4f4f4}.roulette-promo-copy p{color:#bfc3cb;font-size:11px;line-height:1.35;font-weight:800;margin:15px 0}.chip-stack{position:absolute;bottom:5px;left:8px;width:120px;height:45px}.chip-stack span{position:absolute;width:55px;height:14px;border:3px solid #dba82b;border-radius:50%;background:#17120a}.chip-stack span:nth-child(1){left:5px;bottom:4px}.chip-stack span:nth-child(2){left:38px;bottom:14px}.chip-stack span:nth-child(3){left:70px;bottom:3px}.roulette-art{position:relative;display:grid;place-items:center;height:100%}.roulette-preview-pointer{position:absolute;top:0;z-index:5;color:#ef2929;font-size:42px;line-height:1}.roulette-preview-original{width:min(220px,48vw);aspect-ratio:1}.roulette-preview-original svg{width:100%;height:100%;display:block}.roulette-feature-card h3{padding:0 18px;margin:10px 0 12px;font-size:23px}.roulette-feature-card .game-button{margin:0 18px;width:calc(100% - 36px);min-height:62px;border-radius:18px;font-size:25px;font-weight:1000}'; document.head.appendChild(s);
    }
    const logo=document.querySelector('.logo'); if(logo) logo.outerHTML='<a class="logo mybets-logo" href="/" aria-label="MyBets inicio"><span>My</span><b>Bets</b></a>';
    document.querySelectorAll('.header-balance,#headerBalance').forEach(e=>e.style.display='none');
    const h=document.querySelector('.header'); if(h&&!h.querySelector('.player-back-button')){const b=document.createElement('button'); b.type='button'; b.className='player-back-button'; b.textContent='←'; b.onclick=window.voltarPaginaMyBets; h.insertBefore(b,h.querySelector('.header-right'));}
    const w=document.querySelector('.welcome'); if(w) w.innerHTML='<h1>Olá, <span id="userName">Jogador</span> 👋</h1><p>Bora jogar? Boa sorte!</p>';
    const bal=document.querySelector('.balance-card'); if(bal) bal.innerHTML='<div class="balance-summary"><div class="balance-stat balance-main-stat"><span class="balance-icon wallet-icon">▣</span><div><span>Saldo</span><strong id="mainBalance">0,00</strong></div></div><div class="balance-stat bonus-stat"><span class="balance-icon bonus-icon">🎁</span><div><span>Bônus</span><strong id="bonusBalanceValue">R$ 0,00</strong></div></div></div><div class="balance-actions"><button class="primary-button" onclick="abrirDeposito()">+ Depositar</button><button class="secondary-button" onclick="abrirSaque()">Sacar</button></div>';
    const title=[...document.querySelectorAll('.section-title')].find(e=>e.textContent.includes('Roletas')); if(title){const old=title.closest('.roulette-section-heading'); const wrap=document.createElement('div'); wrap.className='roulette-section-heading'; wrap.innerHTML='<h2 class="section-title">🎰 Roletas</h2><span>GIRE E MULTIPLIQUE</span>'; if(old) old.replaceWith(wrap); else title.replaceWith(wrap);}
    const game=document.querySelector('.games .game-card'); if(game){game.className='game-card roulette-feature-card'; game.innerHTML='<div class="roulette-promo"><div class="roulette-promo-copy"><div class="roulette-brand"><i>Roleta</i><strong>MyBets</strong></div><p>GIRE, DIVIRTA-SE<br>E MULTIPLIQUE<br>SUAS CHANCES!</p><div class="chip-stack"><span></span><span></span><span></span></div></div><div class="roulette-art"><div class="roulette-preview-pointer">▼</div><div class="roulette-preview-original"><svg id="roulettePreviewSvg" viewBox="0 0 500 500" aria-label="Roleta MyBets original"></svg></div></div></div><h3>Roleta MyBets</h3><button class="game-button" onclick="abrirRoleta(\'sorte\')">▶&nbsp;&nbsp; JOGAR</button>';}
    drawPreview(); setTimeout(drawPreview,500); setTimeout(drawPreview,1500); setTimeout(drawPreview,3000);
  }
  document.addEventListener('DOMContentLoaded',apply);
})();

(function(){
  const cfg=window.MYBETS_LARGE_ROULETTE||{};
  const slices=Number(cfg.slices)||100;
  const bet=Number(cfg.bet)||1;
  const prizes=Array.isArray(cfg.prizes)?cfg.prizes:[];
  const prizeIndexes=Array.isArray(cfg.prizeIndexes)?cfg.prizeIndexes:[];
  const api='/api/settings/roulette-large/spin';
  const $=id=>document.getElementById(id);
  let rotation=0,spinning=false,user=null;
  function money(v){return `R$ ${Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`}
  function session(){try{return JSON.parse(localStorage.getItem('jpbet_user')||'null')}catch{return null}}
  function setUser(u){if(!u)return;user={...user,...u};localStorage.setItem('jpbet_user',JSON.stringify(user));const h=$('headerBalance');if(h&&user.balance!=null)h.textContent=money(user.balance)}
  async function refreshBalance(){try{const u=session();if(!u||u.id==null)return;const r=await fetch(`/api/user/${encodeURIComponent(u.id)}`,{cache:'no-store'});if(!r.ok)return;const d=await r.json();const fresh=d.user||d;if(fresh&&fresh.balance!=null)setUser(fresh)}catch(e){}}
  function polar(r,d){const a=(d-90)*Math.PI/180;return{x:250+r*Math.cos(a),y:250+r*Math.sin(a)}}
  function path(r,a,b){const p=polar(r,a),q=polar(r,b);return `M250 250 L${p.x} ${p.y} A${r} ${r} 0 0 1 ${q.x} ${q.y} Z`}

  // A roleta continua tendo todas as probabilidades lógicas no backend,
  // mas visualmente comprime as perdas em 5 setores amarelos e os ganhos
  // em 5 setores pretos, todos exatamente do mesmo tamanho.
  const visualStep=36;
  function angleFromLogical(index){
    const i=((Number(index)%slices)+slices)%slices;
    const prizeSet=new Set(prizeIndexes.map(Number));
    if(prizeSet.has(i)){
      const prizePos=prizeIndexes.indexOf(i);
      return prizePos*72;
    }
    const block=Math.min(4,Math.floor(i/(slices/5)));
    return block*72+36;
  }
  function updatePrizeOrientation(rr){document.querySelectorAll('.large-prize-label').forEach(t=>{const x=Number(t.dataset.cx),y=Number(t.dataset.cy);t.setAttribute('transform',`translate(${x} ${y}) rotate(${-rr}) translate(${-x} ${-y})`)})}
  function renderWheel(){
    const svg=$('rouletteSvg');if(!svg)return;svg.innerHTML='';
    const ns='http://www.w3.org/2000/svg',defs=document.createElementNS(ns,'defs');
    const glow=document.createElementNS(ns,'filter');glow.id='goldGlow';glow.innerHTML='<feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>';defs.appendChild(glow);svg.appendChild(defs);
    const base=document.createElementNS(ns,'circle');base.setAttribute('cx',250);base.setAttribute('cy',250);base.setAttribute('r',239);base.setAttribute('fill','#050505');svg.appendChild(base);

    const prizeSet=new Set(prizeIndexes.map(Number));
    const textColors=['#ff8a22','#39a9ff','#31e56d','#d9d9df','#ff5d68'];

    // 10 setores visuais: 5 pretos de ganho + 5 amarelos de perda.
    for(let i=0;i<10;i++){
      const a=i*visualStep-visualStep/2,b=(i+1)*visualStep-visualStep/2;
      const sector=document.createElementNS(ns,'path');
      sector.setAttribute('d',path(239,a,b));
      const isPrize=i%2===0;
      sector.setAttribute('fill',isPrize?'#050505':'#f7b915');
      sector.setAttribute('stroke','#080808');
      sector.setAttribute('stroke-width','1.5');
      svg.appendChild(sector);

      if(isPrize){
        const prizePos=i/2;
        const prize=prizes[prizePos];
        if(prize!=null){
          const pos=polar(177,prizePos*72),t=document.createElementNS(ns,'text');
          t.textContent=money(prize);
          t.setAttribute('x',pos.x);t.setAttribute('y',pos.y);
          t.setAttribute('text-anchor','middle');t.setAttribute('dominant-baseline','middle');
          t.setAttribute('font-family','Arial Black,Arial,sans-serif');
          t.setAttribute('font-size','22');
          t.setAttribute('font-weight','900');
          t.setAttribute('fill',textColors[prizePos%textColors.length]);
          t.setAttribute('stroke','#050505');t.setAttribute('stroke-width','3.2');
          t.setAttribute('paint-order','stroke fill');
          t.classList.add('large-prize-label');
          t.dataset.cx=pos.x;t.dataset.cy=pos.y;
          svg.appendChild(t);
        }
      }
    }

    const ring=document.createElementNS(ns,'circle');ring.setAttribute('cx',250);ring.setAttribute('cy',250);ring.setAttribute('r',239);ring.setAttribute('fill','none');ring.setAttribute('stroke','#f4b91d');ring.setAttribute('stroke-width','12');ring.setAttribute('filter','url(#goldGlow)');svg.appendChild(ring);
    const hi=document.createElementNS(ns,'circle');hi.setAttribute('cx',250);hi.setAttribute('cy',250);hi.setAttribute('r',233);hi.setAttribute('fill','none');hi.setAttribute('stroke','#ffe66b');hi.setAttribute('stroke-width','2');hi.setAttribute('opacity','.8');svg.appendChild(hi);
    if($('wheel')){$('wheel').style.transformOrigin='50% 50%';$('wheel').style.transformBox='fill-box';$('wheel').style.transform=`rotate(${rotation}deg)`;updatePrizeOrientation(rotation)}
  }
  async function spin(){
    if(spinning)return;user=session();if(!user){location.href='/dashboard.html';return}
    spinning=true;$('spinButton').disabled=true;$('result').textContent='';$('result').className='result';
    try{const r=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:user.id,betAmount:bet,rouletteId:cfg.id})});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw Error(d.message||'Não foi possível realizar a rodada.');const s=d.spin||{};
      const center=angleFromLogical(Number(s.index)),target=((360-center-(rotation%360))+360)%360,dest=rotation+7*360+target,dur=1900,start=performance.now(),from=rotation;
      await new Promise(resolve=>{function frame(now){const p=Math.min(1,(now-start)/dur),e=1-Math.pow(1-p,3),rr=from+(dest-from)*e;$('wheel').style.transform=`rotate(${rr}deg)`;updatePrizeOrientation(rr);if(p<1)return requestAnimationFrame(frame);rotation=dest;$('wheel').style.transform=`rotate(${dest}deg)`;updatePrizeOrientation(dest);resolve()}requestAnimationFrame(frame)});
      $('result').textContent=Number(s.prize)>0?`🎉 Você ganhou ${money(s.prize)}!`:`Você perdeu ${money(bet)}.`;$('result').className=Number(s.prize)>0?'win':'loss';if(d.user)setUser(d.user);await refreshBalance();
    }catch(e){$('result').textContent=e.message;$('result').className='error'}finally{spinning=false;$('spinButton').disabled=false}
  }
  document.addEventListener('DOMContentLoaded',()=>{user=session();if(user)setUser(user);$('authHint').textContent=user?`Aposta fixa: ${money(bet)}`:'Faça login para jogar.';renderWheel();$('spinButton').onclick=spin;refreshBalance();setInterval(refreshBalance,3000)})
})();

document.addEventListener('DOMContentLoaded',()=>{
  const style=document.createElement('style');
  style.textContent=`
    .page{position:relative!important}
    .wheel{top:42px!important;width:min(340px,calc(100vw - 44px))!important}
    .wheel:before{inset:-12px;background:transparent!important;border:2px solid #080808;box-shadow:0 0 0 2px #5b3605,0 0 0 5px #9a5c05,0 0 0 8px #e2a515,0 0 0 11px #f8c52c,0 0 0 13px #4a2b03,0 0 0 15px #090909}
    .wheel:after{inset:-1px;border:2px solid #f8d34b;box-shadow:inset 0 0 0 2px #5b3605,inset 0 0 0 4px #0a0a0a;z-index:4}
    .center{border:0!important;box-shadow:none!important;background:radial-gradient(circle at 42% 28%,#302510 0%,#090806 62%,#020202 100%)!important;overflow:visible!important}
    .center:before{content:"";position:absolute;z-index:-2;inset:-9px;border-radius:50%;background:#050505;border:5px solid #5b3907;box-shadow:0 0 0 3px #c38b12,0 0 0 5px #1a1205,0 0 10px rgba(255,195,35,.5)}
    .center:after{content:"";position:absolute;z-index:-1;inset:-2px;border-radius:50%;border:2px solid #ffd33e;box-shadow:inset 0 0 0 2px #2a1a04;pointer-events:none}
    .center .brand,.center .go{position:relative;z-index:2}
    .result{position:absolute!important;top:365px!important;left:0!important;width:100%!important;min-height:24px;margin:0!important;padding:0 14px!important;z-index:16!important;text-align:center}
    .bet-area{position:fixed!important;left:16px!important;right:16px!important;bottom:82px!important;width:auto!important;max-width:none!important;margin:0!important;padding:0!important;z-index:60!important}
    .bet-title{font-size:13px!important;margin:0 0 4px 3px!important}
    .bet-value{height:46px!important;font-size:24px!important}
    .hint{margin-top:5px!important}
  `;
  document.head.appendChild(style);
});

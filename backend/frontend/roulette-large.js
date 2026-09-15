(function(){
  const cfg=window.MYBETS_LARGE_ROULETTE||{};
  const slices=Number(cfg.slices)||40;
  const bet=Number(cfg.bet)||5;
  const prizes=Array.isArray(cfg.prizes)?cfg.prizes:[100,200,300,400];
  const prizeIndexes=Array.isArray(cfg.prizeIndexes)?cfg.prizeIndexes:[0,10,20,30];
  const api='/api/settings/roulette-large/spin';
  const $=id=>document.getElementById(id);
  let rotation=0,spinning=false,user=null;
  function money(v){return `R$ ${Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`}
  function session(){try{return JSON.parse(localStorage.getItem('jpbet_user')||'null')}catch{return null}}
  function polar(r,d){const a=(d-90)*Math.PI/180;return{x:250+r*Math.cos(a),y:250+r*Math.sin(a)}}
  function path(r,a,b){const p=polar(r,a),q=polar(r,b);return `M250 250 L${p.x} ${p.y} A${r} ${r} 0 0 1 ${q.x} ${q.y} Z`}
  function visualIndexFromLogical(index){const n=Number(index),p=prizeIndexes.indexOf(n);if(p>=0)return p*2;for(let i=0;i<prizeIndexes.length;i++){const start=prizeIndexes[i]+1,end=(i+1<prizeIndexes.length?prizeIndexes[i+1]:slices)-1;if(n>=start&&n<=end)return i*2+1}return 1}
  function angleFromLogical(index){const n=Number(index),p=prizeIndexes.indexOf(n);if(p>=0)return p*90;const blockSize=(slices-prizeIndexes.length)/prizeIndexes.length;for(let i=0;i<prizeIndexes.length;i++){const start=prizeIndexes[i]+1,end=(i+1<prizeIndexes.length?prizeIndexes[i+1]:slices)-1;if(n>=start&&n<=end){const ordinal=n-start,visualIndex=i*2+1,blockStart=visualIndex*45-22.5;return blockStart+(ordinal+.5)*(45/blockSize)}}return 0}
  function updatePrizeOrientation(rr){document.querySelectorAll('.large-prize-label').forEach(t=>{const x=Number(t.dataset.cx),y=Number(t.dataset.cy);t.setAttribute('transform',`translate(${x} ${y}) rotate(${-rr}) translate(${-x} ${-y})`)})}
  function renderWheel(){
    const svg=$('rouletteSvg');if(!svg)return;svg.innerHTML='';
    const ns='http://www.w3.org/2000/svg',defs=document.createElementNS(ns,'defs');
    const glow=document.createElementNS(ns,'filter');glow.id='goldGlow';glow.innerHTML='<feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>';defs.appendChild(glow);svg.appendChild(defs);
    const base=document.createElementNS(ns,'circle');base.setAttribute('cx',250);base.setAttribute('cy',250);base.setAttribute('r',239);base.setAttribute('fill','#050505');svg.appendChild(base);
    const step=45,loss='#f7b915',textColors=['#ff8a22','#39a9ff','#31e56d','#d9d9df'];
    for(let v=0;v<8;v++){
      const a=v*step-step/2,b=(v+1)*step-step/2,sector=document.createElementNS(ns,'path');
      sector.setAttribute('d',path(239,a,b));sector.setAttribute('fill',v%2===0?'#050505':loss);sector.setAttribute('stroke','#080808');sector.setAttribute('stroke-width','2');svg.appendChild(sector);
      if(v%2===0){const pos=v/2,q=polar(172,v*step),t=document.createElementNS(ns,'text');
        t.textContent=money(prizes[pos]);t.setAttribute('x',q.x);t.setAttribute('y',q.y);t.setAttribute('text-anchor','middle');t.setAttribute('dominant-baseline','middle');
        t.setAttribute('font-family','Arial Black,Arial,sans-serif');t.setAttribute('font-size',slices>=60?'22':'25');t.setAttribute('font-weight','900');t.setAttribute('fill',textColors[pos]);t.setAttribute('stroke','#050505');t.setAttribute('stroke-width','4');t.setAttribute('paint-order','stroke fill');t.classList.add('large-prize-label');t.dataset.cx=q.x;t.dataset.cy=q.y;svg.appendChild(t);
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
      $('result').textContent=Number(s.prize)>0?`🎉 Você ganhou ${money(s.prize)}!`:`Você perdeu ${money(bet)}.`;$('result').className=Number(s.prize)>0?'win':'loss';if(d.user)localStorage.setItem('jpbet_user',JSON.stringify({...user,...d.user}));
    }catch(e){$('result').textContent=e.message;$('result').className='error'}finally{spinning=false;$('spinButton').disabled=false}
  }
  document.addEventListener('DOMContentLoaded',()=>{user=session();$('authHint').textContent=user?`Aposta fixa: ${money(bet)}`:'Faça login para jogar.';renderWheel();$('spinButton').onclick=spin})
})();

document.addEventListener('DOMContentLoaded',()=>{
  const style=document.createElement('style');
  style.textContent=`
    .wheel{top:32px!important}
    .wheel:before{inset:-12px;background:transparent!important;border:2px solid #080808;box-shadow:0 0 0 2px #5b3605,0 0 0 5px #9a5c05,0 0 0 8px #e2a515,0 0 0 11px #f8c52c,0 0 0 13px #4a2b03,0 0 0 15px #090909}
    .wheel:after{inset:-1px;border:2px solid #f8d34b;box-shadow:inset 0 0 0 2px #5b3605,inset 0 0 0 4px #0a0a0a;z-index:4}
    .center{border:0!important;box-shadow:none!important;background:radial-gradient(circle at 42% 28%,#302510 0%,#090806 62%,#020202 100%)!important;overflow:visible!important}
    .center:before{content:"";position:absolute;z-index:-2;inset:-9px;border-radius:50%;background:#050505;border:5px solid #5b3907;box-shadow:0 0 0 3px #c38b12,0 0 0 5px #1a1205,0 0 10px rgba(255,195,35,.5)}
    .center:after{content:"";position:absolute;z-index:-1;inset:-2px;border-radius:50%;border:2px solid #ffd33e;box-shadow:inset 0 0 0 2px #2a1a04;pointer-events:none}
    .center .brand,.center .go{position:relative;z-index:2}
    .result{position:absolute!important;top:366px!important;left:0!important;width:100%!important;min-height:24px;margin:0!important;padding:0 14px!important;z-index:15!important;text-align:center}
  `;
  document.head.appendChild(style);
});

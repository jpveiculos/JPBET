/* MyBets — base compartilhada das Roletas 2 e 3.
   As duas páginas usam esta mesma lógica para que novas funcionalidades
   sejam aplicadas às duas ao mesmo tempo. A quantidade de fatias é definida
   pela página em window.MYBETS_ROULETTE_CONFIG.slices. */
(function(){
  const cfg=window.MYBETS_ROULETTE_CONFIG||{};
  const slices=Number(cfg.slices)||16;
  const rouletteId=cfg.id||'sorte';
  const title=cfg.title||'Roleta MyBets';
  const api='/api';
  const prizes=cfg.prizes||{2:'5X',6:'10X',10:'2X',14:'3X'};
  let rotation=0,spinning=false,user=null;
  const $=id=>document.getElementById(id);
  const money=v=>`R$ ${Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  function session(){try{return JSON.parse(localStorage.getItem('jpbet_user')||'null')}catch{return null}}
  function headers(){return {'Content-Type':'application/json',...(localStorage.getItem('jpbet_token')?{'Authorization':`Bearer ${localStorage.getItem('jpbet_token')}`}:{})}}
  function polar(r,d){const a=(d-90)*Math.PI/180;return{x:250+r*Math.cos(a),y:250+r*Math.sin(a)}}
  function path(r,a,b){const p=polar(r,a),q=polar(r,b),large=b-a>180?1:0;return`M250 250 L${p.x} ${p.y} A${r} ${r} 0 ${large} 1 ${q.x} ${q.y} Z`}
  function renderWheel(){
    const svg=$('rouletteSvg');if(!svg)return;svg.innerHTML='';
    const ns='http://www.w3.org/2000/svg';
    const defs=document.createElementNS(ns,'defs');
    const grad=document.createElementNS(ns,'radialGradient');grad.id='gold';grad.innerHTML='<stop offset="0%" stop-color="#6b3c00"/><stop offset="72%" stop-color="#d88a08"/><stop offset="86%" stop-color="#fff0a0"/><stop offset="93%" stop-color="#ffd43b"/><stop offset="100%" stop-color="#8b4d00"/>';defs.appendChild(grad);svg.appendChild(defs);
    const base=document.createElementNS(ns,'circle');base.setAttribute('cx',250);base.setAttribute('cy',250);base.setAttribute('r',238);base.setAttribute('fill','#070707');svg.appendChild(base);
    const step=360/slices;
    for(let i=0;i<slices;i++){
      const p=document.createElementNS(ns,'path');p.setAttribute('d',path(238,i*step-step/2,(i+1)*step-step/2));p.setAttribute('fill',i%2?'#11161d':'#05070a');p.setAttribute('stroke','#d7a72b');p.setAttribute('stroke-width',slices>=20?'1.2':'1.8');svg.appendChild(p);
      const label=prizes[i];if(label){const q=polar(174,i*step);const t=document.createElementNS(ns,'text');t.textContent=label;t.setAttribute('x',q.x);t.setAttribute('y',q.y);t.setAttribute('text-anchor','middle');t.setAttribute('dominant-baseline','middle');t.setAttribute('font-family','Arial Black,Arial,sans-serif');t.setAttribute('font-size',label==='10X'?'42':'50');t.setAttribute('font-weight','900');t.setAttribute('font-style','italic');t.setAttribute('fill','#ffd43b');t.setAttribute('stroke','#1b1100');t.setAttribute('stroke-width','5');t.setAttribute('paint-order','stroke fill');t.dataset.x=q.x;t.dataset.y=q.y;t.classList.add('prize-label');svg.appendChild(t)}
    }
    const ring=document.createElementNS(ns,'circle');ring.setAttribute('cx',250);ring.setAttribute('cy',250);ring.setAttribute('r',238);ring.setAttribute('fill','none');ring.setAttribute('stroke','url(#gold)');ring.setAttribute('stroke-width','12');svg.appendChild(ring);
    updateLabels(rotation);const wheel=$('wheel');if(wheel)wheel.style.transform=`rotate(${rotation}deg)`;
  }
  function updateLabels(rr){document.querySelectorAll('.prize-label').forEach(t=>{const x=Number(t.dataset.x),y=Number(t.dataset.y);t.setAttribute('transform',`translate(${x} ${y}) rotate(${-rr}) translate(${-x} ${-y})`)})}
  async function spin(){
    if(spinning)return;user=session();if(!user){location.href='/dashboard.html';return}
    const bet=Number($('betAmount').value),min=1,max=1000;if(!(bet>=min&&bet<=max)){toast(`A aposta deve estar entre ${money(min)} e ${money(max)}.`);return}
    spinning=true;$('spinButton').disabled=true;
    try{
      const r=await fetch(`${api}/roulette/spin`,{method:'POST',headers:headers(),body:JSON.stringify({userId:user.id,betAmount:bet,betType:'roulette',rouletteId:'sorte'})});
      const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||'Não foi possível realizar a rodada.');
      const s=d.spin||d.result||d;if(!Number.isInteger(Number(s.index)))throw Error('Resultado inválido.');
      const idx=Number(s.index)%slices,center=idx*(360/slices),target=((360-center-(rotation%360))+360)%360,turns=7,dest=rotation+turns*360+target,dur=1800,start=performance.now(),from=rotation;
      await new Promise(resolve=>{function frame(now){const p=Math.min(1,(now-start)/dur),e=1-Math.pow(1-p,3),rr=from+(dest-from)*e;$('wheel').style.transform=`rotate(${rr}deg)`;updateLabels(rr);if(p<1)return requestAnimationFrame(frame);rotation=dest;resolve()}requestAnimationFrame(frame)});
      $('result').textContent=Number(s.prize)>0?`Você ganhou ${money(s.prize)}!`:`Você perdeu ${money(bet)}.`;$('result').className=Number(s.prize)>0?'win':'loss';
    }catch(e){toast(e.message);$('result').textContent=e.message;$('result').className='error'}finally{spinning=false;$('spinButton').disabled=false}
  }
  function toast(msg){const t=$('toast');if(t){t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}}
  function setBet(v){$('betAmount').value=Math.min(1000,Math.max(1,Number(v)||1))}
  document.addEventListener('DOMContentLoaded',()=>{user=session();if(!user){$('authHint').textContent='Faça login para jogar.'}else $('playerName').textContent=user.username||'Jogador';renderWheel();$('spinButton').onclick=spin;document.querySelectorAll('[data-bet]').forEach(b=>b.onclick=()=>setBet(b.dataset.bet));$('minus').onclick=()=>setBet(Number($('betAmount').value)-1);$('plus').onclick=()=>setBet(Number($('betAmount').value)+1)});
  window.renderVariantWheel=renderWheel;
})();

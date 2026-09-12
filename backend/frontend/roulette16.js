/* MyBets Roulette 16 — visual mobile redesign */
(() => {
  const $=id=>document.getElementById(id);
  const n=(v,d=0)=>{const x=Number(v);return Number.isFinite(x)?x:d};
  const money=v=>n(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const user=()=>{try{return JSON.parse(localStorage.getItem('jpbet_user')||'null')}catch(_){return null}};
  const headers=()=>{const h={'Content-Type':'application/json'},t=localStorage.getItem('jpbet_token');if(t)h.Authorization=`Bearer ${t}`;return h};
  let spinning=false,rotation=0;

  function wheel(){return $('rouletteWheel')||$('wheel')}
  function spinBtn(){return $('rouletteSpinButton')||$('spinButton')}
  function betEl(){return $('rouletteBetValue')||$('betAmount')}
  function polar(r,d){const a=(d-90)*Math.PI/180;return{x:250+r*Math.cos(a),y:250+r*Math.sin(a)}}
  function path(r,a,b){const p=polar(r,a),q=polar(r,b),large=b-a>180?1:0;return`M250 250 L${p.x} ${p.y} A${r} ${r} 0 ${large} 1 ${q.x} ${q.y} Z`}

  function renderWheel(){
    const el=wheel();if(!el)return;
    el.innerHTML='';el.style.background='none';el.style.transform=`rotate(${rotation}deg)`;
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 500 500');svg.setAttribute('aria-label','Roleta MyBets com 16 resultados');svg.style.cssText='width:100%;height:100%;display:block;overflow:visible';
    // Cada grupo representa 1 prêmio preto + as 3 perdas comprimidas em uma única área dourada.
    // O sorteio continua usando as 16 posições e os pesos definidos no servidor.
    const prizes=[{label:'3X',multiplier:3},{label:'5X',multiplier:5},{label:'10X',multiplier:10},{label:'2X',multiplier:2}];
    for(let g=0;g<4;g++){
      const base=g*90, blackStart=base, blackEnd=base+60, goldStart=blackEnd, goldEnd=base+90;
      const bp=document.createElementNS(ns,'path');bp.setAttribute('d',path(238,blackStart,blackEnd));bp.setAttribute('fill','#050505');bp.setAttribute('stroke','#f4c83f');bp.setAttribute('stroke-width','2');svg.appendChild(bp);
      const gp=document.createElementNS(ns,'path');gp.setAttribute('d',path(238,goldStart,goldEnd));gp.setAttribute('fill','#e3aa25');gp.setAttribute('stroke','#f4c83f');gp.setAttribute('stroke-width','2');svg.appendChild(gp);
      const mid=(blackStart+blackEnd)/2,q=polar(154,mid),t=document.createElementNS(ns,'text');t.textContent=prizes[g].label;t.setAttribute('x',q.x);t.setAttribute('y',q.y);t.setAttribute('text-anchor','middle');t.setAttribute('dominant-baseline','middle');t.setAttribute('font-family','Arial,Helvetica,sans-serif');t.setAttribute('font-size',g===2?'48':'57');t.setAttribute('font-weight','900');t.setAttribute('fill','#29e86d');t.setAttribute('stroke','#031108');t.setAttribute('stroke-width','4');t.setAttribute('paint-order','stroke fill');svg.appendChild(t);
    }
    const r=document.createElementNS(ns,'circle');r.setAttribute('cx',250);r.setAttribute('cy',250);r.setAttribute('r',238);r.setAttribute('fill','none');r.setAttribute('stroke','#a66e08');r.setAttribute('stroke-width','11');svg.appendChild(r);
    const h=document.createElementNS(ns,'circle');h.setAttribute('cx',250);h.setAttribute('cy',250);h.setAttribute('r',231);h.setAttribute('fill','none');h.setAttribute('stroke','#f8d86c');h.setAttribute('stroke-width','2');svg.appendChild(h);el.appendChild(svg);
  }

  function setBalance(v){
    const x=n(v),s=x.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    ['headerBalance','mainBalance'].forEach(id=>{const e=$(id);if(e)e.textContent=s});
    ['rouletteLiveBalance','rouletteBalance'].forEach(id=>{const e=$(id);if(e)e.textContent=money(x)});
  }
  function animateBalance(a,b,ms=850){const from=n(a),to=n(b),t0=performance.now();const f=t=>{const p=Math.min(1,(t-t0)/ms),e=1-Math.pow(1-p,3);setBalance(from+(to-from)*e);if(p<1)requestAnimationFrame(f);else setBalance(to)};requestAnimationFrame(f)}
  async function refreshBalance(){const u=user(),id=u?.id??u?.userId;if(!id)return;try{const r=await fetch(`/api/user/${encodeURIComponent(id)}`,{headers:headers()});if(!r.ok)return;const d=await r.json(),v=d.user||d,old=n(u.balance),next=n(v.balance);localStorage.setItem('jpbet_user',JSON.stringify({...u,...v}));Math.abs(next-old)>.001?animateBalance(old,next):setBalance(next)}catch(_){} }

  window.abrirInterfaceRoleta=function(config={}){
    if($('gameTypeLabel'))$('gameTypeLabel').textContent='ROLETA MYBETS';
    if($('slotPanel'))$('slotPanel').hidden=true;if($('roulettePanel'))$('roulettePanel').hidden=false;
    const min=Math.max(.5,n(config.minBet,.5)),max=Math.max(min,n(config.maxBet,100));window.__mybetsRouletteMin=min;window.__mybetsRouletteMax=max;
    const b=betEl();if(b){b.min=String(min);b.max=String(max);if(n(b.value,min)<min)b.value=String(min)}renderWheel();refreshBalance();
  };
  window.criarRoletaSorte=renderWheel;window.criarRoletaMyBets=renderWheel;window.atualizarGiroGratis=()=>{};

  window.girarRoleta=async function(){
    if(spinning)return;const u=user(),userId=u?.id??u?.userId;if(!userId)return alert('Faça login novamente.');
    const b=betEl(),bet=n(b?.value??window.rouletteBet,.5),min=n(window.__mybetsRouletteMin,.5),max=n(window.__mybetsRouletteMax,100);if(bet<min||bet>max)return alert('Aposta fora dos limites.');if(bet>n(u.balance))return alert('Saldo insuficiente.');
    spinning=true;const btn=spinBtn();if(btn){btn.disabled=true;btn.textContent='GIRANDO...'}
    try{
      const res=await fetch('/api/roulette/spin',{method:'POST',headers:headers(),body:JSON.stringify({userId,betAmount:bet,betType:'roulette',rouletteId:'sorte'})});
      const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.message||data.error||'Não foi possível girar a roleta.');
      const r=data.spin||data.result||data,index=n(r.index,-1);if(index<0||index>=16)throw new Error('Resultado inválido da roleta.');
      // Backend: prêmio em 2,6,10,14. Cada trio de perdas compartilha a mesma área dourada.
      const group=Math.floor(index/4),isPrize=index%4===2,center=isPrize?group*90+30:group*90+75,target=360-center,turns=7+Math.floor(Math.random()*3),ms=Math.max(1800,n(window.configuracaoAtual?.animationMs??window.configuracoes?.roulette_animation_ms,4800));
      const w=wheel();rotation=turns*360+target;if(w){w.style.transition=`transform ${ms}ms cubic-bezier(.12,.72,.12,1)`;w.style.transform=`rotate(${rotation}deg)`}await new Promise(resolve=>setTimeout(resolve,ms+100));
      const old=n(u.balance),next=n(data.user?.balance,old-bet+n(r.prize));if(data.user)localStorage.setItem('jpbet_user',JSON.stringify({...u,...data.user}));animateBalance(old,next);
      const result=$('rouletteResult');if(result)result.textContent=n(r.prize)>0?`🎉 ${r.label||['3X','5X','10X','2X'][group]} — Prêmio ${money(r.prize)}`:'Resultado: sem prêmio nesta rodada.';
    }catch(e){const result=$('rouletteResult');if(result)result.textContent='Defina sua aposta e gire.';alert(e.message||'Erro ao girar a roleta.')}finally{spinning=false;if(btn){btn.disabled=false;btn.textContent='GIRAR'}}
  };
  window.spinRoulette=window.girarRoleta;

  const style=document.createElement('style');style.textContent=`
    .roulette-area{width:min(520px,calc(100vw - 18px));margin:8px auto 14px;filter:drop-shadow(0 18px 30px rgba(0,0,0,.65))}
    .roulette-area:before{inset:-7px;border:7px solid #9b6509;box-shadow:0 0 0 3px #3b2505,0 0 32px rgba(255,197,48,.36)}
    #wheel,#rouletteWheel{overflow:visible;backface-visibility:hidden}
    .roulette-pointer{z-index:100;top:-20px;border-left-width:16px;border-right-width:16px;border-top:38px solid #ffd84d}
    .roulette-center-cover{width:38%;border-color:#e3a820;box-shadow:0 0 0 3px #704507,0 0 24px rgba(255,196,35,.62),inset 0 0 22px rgba(255,190,30,.2)}
    .roulette-center-button{width:29%;min-width:120px;max-width:155px;background:radial-gradient(circle at 42% 35%,#4b3a16,#080705 65%);color:#ffd33d}
    .roulette-bet{margin-top:16px;gap:12px}.roulette-bet-field{max-width:none}.roulette-bet-field label{font-size:13px;text-align:left;margin:0 0 7px 4px}.roulette-bet-field input{height:62px;border-radius:15px;border:1px solid #536078;background:#05070b;font-size:29px;text-align:left;padding:0 22px}
    .quick-bets{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:10px}.quick-bets button{height:54px;border:2px solid #f1c735;border-radius:15px;background:linear-gradient(145deg,#121a22,#0b1016);font-size:18px;box-shadow:0 0 13px rgba(244,199,49,.12)}
    .spin-button{height:66px;border-radius:16px;background:linear-gradient(180deg,#ffe278,#d99a17);font-size:31px;letter-spacing:1px;box-shadow:0 7px 18px rgba(218,155,22,.25)}.roulette-result{min-height:22px;margin:7px 0;text-align:center}.roulette-note{display:none}
    @media(max-width:600px){.modal-content{padding:18px 10px}.roulette-area{width:min(510px,calc(100vw - 18px))}.roulette-bet button{width:48px;height:62px}.roulette-center-button{min-width:105px}}
  `;document.head.appendChild(style);
  document.addEventListener('DOMContentLoaded',()=>{renderWheel();refreshBalance()});
})();
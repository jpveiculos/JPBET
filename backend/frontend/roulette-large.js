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

  // MODELO VISUAL IGUAL AO DA ROLETA DE 16:
  // Cada setor preto de prêmio ocupa UMA fatia visual.
  // Os setores de perda são comprimidos dentro de uma única fatia colorida.
  // Assim:
  //   Standard: 40 setores reais = 4 prêmios individuais + 4 blocos de 9 perdas.
  //   Premium:  60 setores reais = 4 prêmios individuais + 4 blocos de 14 perdas.
  // A roleta mostra 8 fatias visuais, mas o sorteio continua usando 40/60 posições reais.
  function visualIndexFromLogical(index){
    const n=Number(index);
    const p=prizeIndexes.indexOf(n);
    if(p>=0)return p*2;
    const lossBlockSize=(slices-prizeIndexes.length)/prizeIndexes.length;
    let block=0;
    for(let i=0;i<prizeIndexes.length;i++){
      const start=prizeIndexes[i]+1;
      const end=(i+1<prizeIndexes.length?prizeIndexes[i+1]:slices)-1;
      if(n>=start&&n<=end){block=i;break}
    }
    return block*2+1;
  }

  function renderWheel(){
    const svg=$('rouletteSvg');if(!svg)return;
    svg.innerHTML='';
    const ns='http://www.w3.org/2000/svg';
    const defs=document.createElementNS(ns,'defs');
    const glow=document.createElementNS(ns,'filter');glow.id='goldGlow';glow.innerHTML='<feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>';defs.appendChild(glow);svg.appendChild(defs);
    const base=document.createElementNS(ns,'circle');base.setAttribute('cx',250);base.setAttribute('cy',250);base.setAttribute('r',239);base.setAttribute('fill','#050505');svg.appendChild(base);

    // Exatamente 8 fatias visuais, como na roleta de 16 da referência:
    // 4 pretas = prêmios; 4 coloridas = grupos comprimidos de perdas.
    const visualStep=45;
    const lossColor='#f7b915';
    const prizeTextColors=['#ff8a22','#39a9ff','#31e56d','#d9d9df'];

    for(let v=0;v<8;v++){
      const a=v*visualStep-visualStep/2;
      const b=(v+1)*visualStep-visualStep/2;
      const sector=document.createElementNS(ns,'path');
      sector.setAttribute('d',path(239,a,b));
      sector.setAttribute('fill',v%2===0?'#050505':lossColor);
      sector.setAttribute('stroke','#080808');
      sector.setAttribute('stroke-width','2');
      sector.setAttribute('vector-effect','non-scaling-stroke');
      sector.dataset.visualSector=v;
      svg.appendChild(sector);

      if(v%2===0){
        const prizePos=v/2;
        const q=polar(176,v*visualStep);
        const t=document.createElementNS(ns,'text');
        t.textContent=money(prizes[prizePos]);
        t.setAttribute('x',q.x);t.setAttribute('y',q.y);
        t.setAttribute('text-anchor','middle');t.setAttribute('dominant-baseline','middle');
        t.setAttribute('font-family','Arial Black,Arial,sans-serif');
        t.setAttribute('font-size',slices>=60?'22':'25');t.setAttribute('font-weight','900');
        t.setAttribute('fill',prizeTextColors[prizePos]);
        t.setAttribute('stroke','#050505');t.setAttribute('stroke-width','4');t.setAttribute('paint-order','stroke fill');
        // O prêmio pertence à fatia preta e gira exatamente junto com a roda.
        t.setAttribute('transform',`rotate(${v*visualStep+90} ${q.x} ${q.y})`);
        svg.appendChild(t);
      }
    }

    const ring=document.createElementNS(ns,'circle');
    ring.setAttribute('cx',250);ring.setAttribute('cy',250);ring.setAttribute('r',239);
    ring.setAttribute('fill','none');ring.setAttribute('stroke','#f4b91d');ring.setAttribute('stroke-width','12');ring.setAttribute('filter','url(#goldGlow)');svg.appendChild(ring);
    $('wheel').style.transform=`rotate(${rotation}deg)`;
  }

  async function spin(){
    if(spinning)return;
    user=session();
    if(!user){location.href='/dashboard.html';return}
    spinning=true;$('spinButton').disabled=true;$('result').textContent='';$('result').className='result';
    try{
      const r=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:user.id,betAmount:bet,rouletteId:cfg.id})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||!d.ok)throw Error(d.message||'Não foi possível realizar a rodada.');
      const s=d.spin||{};
      const vi=visualIndexFromLogical(Number(s.index));
      const center=vi*45;
      const target=((360-center-(rotation%360))+360)%360;
      const turns=7;
      const dest=rotation+turns*360+target;
      const dur=1900;
      const start=performance.now(),from=rotation;
      await new Promise(resolve=>{
        function frame(now){
          const p=Math.min(1,(now-start)/dur),e=1-Math.pow(1-p,3),rr=from+(dest-from)*e;
          $('wheel').style.transform=`rotate(${rr}deg)`;
          if(p<1)return requestAnimationFrame(frame);
          rotation=dest;resolve();
        }
        requestAnimationFrame(frame)
      });
      $('result').textContent=Number(s.prize)>0?`🎉 Você ganhou ${money(s.prize)}!`:`Você perdeu ${money(bet)}.`;
      $('result').className=Number(s.prize)>0?'win':'loss';
      if(d.user)localStorage.setItem('jpbet_user',JSON.stringify({...user,...d.user}));
    }catch(e){$('result').textContent=e.message;$('result').className='error'}finally{spinning=false;$('spinButton').disabled=false}
  }

  document.addEventListener('DOMContentLoaded',()=>{
    user=session();
    if(!user)$('authHint').textContent='Faça login para jogar.';
    else $('authHint').textContent=`Aposta fixa: ${money(bet)}`;
    renderWheel();
    $('spinButton').onclick=spin;
  });
})();

(()=>{
const ANGLE=360/16;
const SHIFT=10;
const GOLD=new Set([0,4,8,12]);
let visualRotation=0;
let originalCriarRoda=null;

function sincronizarConfiguracaoRoleta(){
 try{
  if(typeof ROLETAS!=='undefined'&&ROLETAS.sorte){
   ROLETAS.sorte.title='Roleta MyBets';
   ROLETAS.sorte.subtitle='';
   ROLETAS.sorte.rules='A roleta tem 16 fatias: 4 multiplicadores e 12 áreas de perda.';
   ROLETAS.sorte.segments=['2X','','','', '3X','','','', '5X','','','', '10X','','',''];
  }
 }catch(e){}
 const title=document.getElementById('rouletteTitle');
 if(title)title.textContent='Roleta MyBets';
 const subtitle=document.getElementById('rouletteSubtitle');
 if(subtitle)subtitle.textContent='';
 const rules=document.getElementById('rouletteRules');
 if(rules)rules.textContent='A roleta tem 16 fatias: 4 multiplicadores e 12 áreas de perda.';
 const explanation=document.querySelector('#rouletteModal .roulette-explanation small');
 if(explanation)explanation.textContent='Prêmios: 2×, 3×, 5× e 10×';
}

function polar(cx,cy,radius,angleDeg){
 const rad=(angleDeg-90)*Math.PI/180;
 return {x:cx+radius*Math.cos(rad),y:cy+radius*Math.sin(rad)};
}
function sectorPath(cx,cy,radius,startDeg,endDeg){
 const start=polar(cx,cy,radius,startDeg);
 const end=polar(cx,cy,radius,endDeg);
 return [`M ${cx} ${cy}`,`L ${start.x} ${start.y}`,`A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`,'Z'].join(' ');
}

function desenharLayoutAprovado(){
 const svg=document.getElementById('rouletteSvg');
 const wheel=document.getElementById('wheel');
 if(!svg||!wheel)return;
 const grupos=Array.from(svg.querySelectorAll('g.roulette-sector'));
 if(grupos.length!==16)return;

 const premios=[];
 grupos.forEach((g,index)=>{
  const label=g.querySelector('text.roulette-label.multiplier');
  if(label) premios.push({index,text:String(label.textContent||'').toUpperCase()});
  const path=g.querySelector('path');
  if(path){
   const start=index*ANGLE-ANGLE/2;
   const end=start+ANGLE;
   path.setAttribute('d',sectorPath(250,250,238,start,end));
   path.setAttribute('fill',GOLD.has(index)?'#dca928':'#080808');
   path.setAttribute('stroke','#d6a321');
   path.setAttribute('stroke-width','2');
  }
  if(label) label.remove();
 });

 premios.forEach(({index,text})=>{
  const target=(index+SHIFT)%16;
  const grupo=grupos[target];
  if(!grupo)return;
  const p=polar(250,250,157,target*ANGLE);
  const node=document.createElementNS('http://www.w3.org/2000/svg','text');
  node.textContent=text;
  node.setAttribute('x',p.x);
  node.setAttribute('y',p.y);
  node.setAttribute('class','roulette-label multiplier');
  node.setAttribute('font-size','58');
  node.setAttribute('font-weight','1000');
  node.setAttribute('fill','#25e66b');
  node.style.fill='#25e66b';
  node.dataset.x=String(p.x);
  node.dataset.y=String(p.y);
  node.setAttribute('transform',`rotate(0 ${p.x} ${p.y})`);
  grupo.appendChild(node);
 });

 wheel.style.transition='none';
 wheel.style.transform='rotate(0deg)';
 visualRotation=0;
}

function instalarRoletaReal(){
 if(typeof window.criarRoda!=='function'||window.criarRoda.__mybetsWrapped)return;
 originalCriarRoda=window.criarRoda;
 const base=originalCriarRoda;
 const wrapped=function(){
  sincronizarConfiguracaoRoleta();
  base.apply(this,arguments);
  requestAnimationFrame(desenharLayoutAprovado);
 };
 wrapped.__mybetsWrapped=true;
 window.criarRoda=wrapped;

 window.animarRoleta=async function(indiceResultado){
  const wheel=document.getElementById('wheel');
  if(!wheel)return;
  const source=Number(indiceResultado);
  if(!Number.isInteger(source)||source<0||source>=16)return;
  const visualIndex=(source+SHIFT)%16;
  const centro=visualIndex*ANGLE;
  const alvo=-centro;
  const atual=Number(visualRotation)||0;
  const moduloAlvo=((alvo%360)+360)%360;
  const moduloAtual=((atual%360)+360)%360;
  let ajuste=moduloAlvo-moduloAtual;
  if(ajuste<0)ajuste+=360;
  const destino=atual+4*360+ajuste;
  const duracao=Math.max(1400,Number(window.configuracoes?.roulette_animation_ms)||1800);
  wheel.style.transition='none';
  wheel.style.transform=`rotate(${atual}deg)`;
  await new Promise(resolve=>{
   requestAnimationFrame(()=>{
    const inicio=performance.now();
    const passo=(agora)=>{
     const progresso=Math.min(1,(agora-inicio)/duracao);
     const ease=1-Math.pow(1-progresso,3);
     const rotacao=atual+(destino-atual)*ease;
     wheel.style.transform=`rotate(${rotacao}deg)`;
     document.querySelectorAll('#rouletteSvg .roulette-label.multiplier').forEach(label=>{
      const x=Number(label.dataset.x||label.getAttribute('x')||0);
      const y=Number(label.dataset.y||label.getAttribute('y')||0);
      label.setAttribute('transform',`rotate(${-rotacao} ${x} ${y})`);
     });
     if(progresso<1)requestAnimationFrame(passo);
     else{visualRotation=destino;wheel.style.transform=`rotate(${destino}deg)`;resolve();}
    };
    requestAnimationFrame(passo);
   });
  });
  if(typeof window.tocarSom==='function')window.tocarSom('click');
 };
}

function ajustarCentro(){
 const modal=document.getElementById('rouletteModal');
 if(!modal)return;
 sincronizarConfiguracaoRoleta();
 const title=document.getElementById('rouletteTitle');
 if(title)title.style.display='none';
 const subtitle=document.getElementById('rouletteSubtitle');
 if(subtitle)subtitle.style.display='none';
 const rules=document.getElementById('rouletteRules');
 if(rules)rules.style.display='none';
 const explanation=document.querySelector('#rouletteModal .roulette-explanation');
 if(explanation)explanation.style.display='none';
 const button=document.getElementById('spinButton');
 if(button){
  button.setAttribute('aria-label','GIRAR - MyBets');
  button.dataset.mybets='1';
 }
 let bet=document.getElementById('betAmount');
 if(bet&&!bet.parentElement.classList.contains('mybets-bet-wrap')){
  const wrap=document.createElement('div');
  wrap.className='mybets-bet-wrap';
  bet.parentNode.insertBefore(wrap,bet);
  wrap.appendChild(bet);
  const currency=document.createElement('span');
  currency.className='mybets-bet-currency';
  currency.textContent='R$';
  wrap.appendChild(currency);
 }
}

function aplicarEstilo(){
 if(document.getElementById('mybets-player-approved-css'))return;
 const style=document.createElement('style');
 style.id='mybets-player-approved-css';
 style.textContent=`
#rouletteModal{background:rgba(0,0,0,.80)!important;padding:8px!important}
#rouletteModal .modal-content{width:min(980px,calc(100vw - 18px))!important;max-width:calc(100vw - 18px)!important;max-height:96vh!important;padding:12px 18px 28px!important;border-radius:26px!important;background:#10141c!important;border:1px solid rgba(255,255,255,.10)!important}
#rouletteModal .close{width:58px!important;height:58px!important;top:12px!important;right:12px!important;border-radius:17px!important;background:#1b222e!important;font-size:34px!important;font-weight:300!important;z-index:100!important}
#rouletteModal .roulette-area{width:min(900px,88vw)!important;margin:0 auto 12px!important;filter:none!important}
#rouletteModal #wheel{filter:none!important}
#rouletteModal .roulette-center-cover{width:39%!important;border:6px solid #d99b19!important;box-shadow:0 0 0 3px #6b4208!important;background:radial-gradient(circle at 45% 35%,#252525 0%,#0c0c0c 55%,#030303 100%)!important}
#rouletteModal .roulette-center-button{width:30%!important;min-width:0!important;max-width:none!important;border:5px solid #d89a12!important;box-shadow:0 0 0 3px #5c3b0b!important,inset 0 0 18px rgba(255,190,30,.10)!important,0 8px 20px rgba(0,0,0,.55)!important;background:radial-gradient(circle at 42% 35%,#282828 0%,#080808 72%)!important;color:#ffd33d!important;font-size:clamp(17px,4vw,25px)!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;line-height:1!important}
#rouletteModal .roulette-center-button::before{content:'MyBets'!important;display:block!important;font-size:clamp(18px,4vw,30px)!important;font-style:italic!important;font-weight:1000!important;letter-spacing:-1.5px!important;color:#f4f4f4!important;line-height:1!important;margin:0 0 5px!important}
#rouletteModal .roulette-center-button::after{content:''!important;display:block!important;position:absolute!important;width:42%!important;height:3px!important;background:#f2bd38!important;border-radius:50%!important;bottom:43%!important;transform:skewX(-18deg)!important}
#rouletteModal .pointer{top:-4px!important;width:66px!important;height:84px!important;background:linear-gradient(145deg,#fff5b8,#ffc52e 55%,#a86400)!important;clip-path:polygon(4% 0,96% 0,80% 55%,50% 100%,20% 55%)!important;filter:drop-shadow(0 5px 7px rgba(0,0,0,.9))!important}
#rouletteModal .pointer::before{left:50%!important;top:7px!important;width:52px!important;height:64px!important;background:#151515!important;clip-path:polygon(5% 0,95% 0,80% 55%,50% 100%,20% 55%)!important}
#rouletteModal .pointer::after{left:50%!important;top:12px!important;width:40px!important;height:51px!important;background:#ff3434!important;clip-path:polygon(0 0,100% 0,50% 100%)!important;filter:none!important}
#rouletteModal .roulette-label.multiplier{fill:#25e66b!important;color:#25e66b!important;font-size:58px!important;font-weight:1000!important;stroke:#06150a!important;stroke-width:4px!important}
#rouletteModal .bet-area{margin:4px 18px 0!important}
#rouletteModal .input-label{font-size:18px!important;margin-bottom:8px!important;color:#9299a6!important}
#rouletteModal .mybets-bet-wrap{position:relative;width:100%!important}
#rouletteModal #betAmount{width:100%!important;padding:17px 68px 17px 28px!important;min-height:68px!important;border-radius:18px!important;border:2px solid #394354!important;background:#090d13!important;color:#f5f5f5!important;font-size:25px!important}
#rouletteModal .mybets-bet-currency{position:absolute;right:22px;top:50%;transform:translateY(-50%);color:#9299a6;font-size:25px;pointer-events:none}
#rouletteModal .quick-values{grid-template-columns:repeat(3,1fr)!important;gap:10px!important;margin-top:12px!important}
#rouletteModal .quick-button{min-height:58px!important;border:2px solid #d7a622!important;border-radius:16px!important;background:#1a2029!important;color:#f5f5f5!important;font-size:22px!important;font-weight:900!important}
@media(max-width:600px){#rouletteModal .modal-content{padding:10px 8px 22px!important}#rouletteModal .close{width:52px!important;height:52px!important;font-size:31px!important}#rouletteModal .roulette-area{width:min(900px,88vw)!important;margin-top:0!important}#rouletteModal .pointer{width:58px!important;height:72px!important}#rouletteModal .pointer::before{width:45px!important;height:55px!important}#rouletteModal .pointer::after{width:34px!important;height:43px!important}#rouletteModal .bet-area{margin-left:12px!important;margin-right:12px!important}#rouletteModal #betAmount{font-size:22px!important;min-height:62px!important;padding-left:20px!important}.mybets-bet-currency{font-size:22px!important}.quick-button{min-height:54px!important;font-size:20px!important}}
`;
 document.head.appendChild(style);
}

function aplicarRoleta(){
 sincronizarConfiguracaoRoleta();
 instalarRoletaReal();
 ajustarCentro();
 aplicarEstilo();
 if(typeof window.criarRoda==='function'){
  try{window.criarRoda()}catch(e){}
 }
 setTimeout(()=>{ajustarCentro();if(typeof window.criarRoda==='function'){try{window.criarRoda()}catch(e){}}},150);
}

function aplicarLayout(){
 const container=document.querySelector('.container');
 const games=document.querySelector('.games');
 if(container&&games){
  document.querySelectorAll('.roulette-section-heading').forEach(el=>{el.querySelectorAll('.roulette-section-heading').forEach(n=>n.remove())});
  const headings=document.querySelectorAll('.roulette-section-heading');
  let heading=headings[0];
  headings.forEach((el,i)=>{if(i>0)el.remove()});
  if(!heading){
   heading=document.createElement('div');
   heading.className='roulette-section-heading';
   heading.innerHTML='<h2 class="section-title">🎰 Roletas</h2><span>GIRE E MULTIPLIQUE</span>';
   games.parentNode.insertBefore(heading,games);
  }
 }
 aplicarRoleta();
}

document.addEventListener('DOMContentLoaded',aplicarLayout);
if(document.readyState!=='loading')aplicarLayout();
setTimeout(aplicarRoleta,400);
})();
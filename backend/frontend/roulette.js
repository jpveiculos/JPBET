/*
 * MyBets — Roleta
 *
 * Lógica exclusiva da roleta. A roleta continua sendo exibida dentro de dashboard.html.
 * As regras e o resultado continuam no backend (/api/roulette/spin).
 */

function polar(r,d){const a=(d-90)*Math.PI/180;return{x:250+r*Math.cos(a),y:250+r*Math.sin(a)}}
function path(r,a,b){const p=polar(r,a),q=polar(r,b),large=b-a>180?1:0;return`M250 250 L${p.x} ${p.y} A${r} ${r} 0 ${large} 1 ${q.x} ${q.y} Z`}

function renderWheel(){
 const svg=$('rouletteSvg');if(!svg)return;svg.innerHTML='';const ns='http://www.w3.org/2000/svg';const defs=document.createElementNS(ns,'defs');
 const grad=document.createElementNS(ns,'radialGradient');grad.setAttribute('id','goldRing');grad.innerHTML='<stop offset="0%" stop-color="#6b3c00"/><stop offset="72%" stop-color="#d88a08"/><stop offset="86%" stop-color="#fff0a0"/><stop offset="93%" stop-color="#ffd43b"/><stop offset="100%" stop-color="#8b4d00"/>';defs.appendChild(grad);
 const green=document.createElementNS(ns,'linearGradient');green.setAttribute('id','prizeGreen');green.setAttribute('x1','0%');green.setAttribute('y1','0%');green.setAttribute('x2','0%');green.setAttribute('y2','100%');green.innerHTML='<stop offset="0%" stop-color="#baffd0"/><stop offset="22%" stop-color="#3dff8a"/><stop offset="62%" stop-color="#10df69"/><stop offset="100%" stop-color="#009b45"/>';defs.appendChild(green);
 const white=document.createElementNS(ns,'linearGradient');white.setAttribute('id','prizeWhite');white.setAttribute('x1','0%');white.setAttribute('y1','0%');white.setAttribute('x2','0%');white.setAttribute('y2','100%');white.innerHTML='<stop offset="0%" stop-color="#ffffff"/><stop offset="45%" stop-color="#f8fbff"/><stop offset="100%" stop-color="#bfc9d6"/>';defs.appendChild(white);
 const blue=document.createElementNS(ns,'linearGradient');blue.setAttribute('id','prizeBlue');blue.setAttribute('x1','0%');blue.setAttribute('y1','0%');blue.setAttribute('x2','0%');blue.setAttribute('y2','100%');blue.innerHTML='<stop offset="0%" stop-color="#9ee6ff"/><stop offset="25%" stop-color="#28c1ff"/><stop offset="65%" stop-color="#008cff"/><stop offset="100%" stop-color="#0057d9"/>';defs.appendChild(blue);
 const orange=document.createElementNS(ns,'linearGradient');orange.setAttribute('id','prizeOrange');orange.setAttribute('x1','0%');orange.setAttribute('y1','0%');orange.setAttribute('y2','100%');orange.setAttribute('x2','0%');orange.innerHTML='<stop offset="0%" stop-color="#ffcf80"/><stop offset="22%" stop-color="#ffad32"/><stop offset="65%" stop-color="#ff8500"/><stop offset="100%" stop-color="#b84b00"/>';defs.appendChild(orange);
 const filter=document.createElementNS(ns,'filter');filter.setAttribute('id','prize3D');filter.setAttribute('x','-35%');filter.setAttribute('y','-35%');filter.setAttribute('width','170%');filter.setAttribute('height','180%');filter.innerHTML='<feDropShadow dx="3" dy="4" stdDeviation="1.2" flood-color="#001b0b" flood-opacity=".98"/><feDropShadow dx="-1" dy="-1" stdDeviation=".6" flood-color="#ffffff" flood-opacity=".45"/>';defs.appendChild(filter);svg.appendChild(defs);
 const base=document.createElementNS(ns,'circle');base.setAttribute('cx',250);base.setAttribute('cy',250);base.setAttribute('r',238);base.setAttribute('fill','#f6b916');svg.appendChild(base);
 const prizes={2:'5X',6:'10X',10:'2X',14:'3X'};const visualByIndex={0:-14,1:0,3:14,2:45,4:76,5:90,7:104,6:135,8:166,9:180,11:194,10:225,12:256,13:270,15:284,14:315};const prizeFill={2:'url(#prizeBlue)',6:'url(#prizeOrange)',10:'url(#prizeGreen)',14:'url(#prizeWhite)'};const prizeStroke={2:'#001f45',6:'#5c2600',10:'#002d13',14:'#46505b'};
 for(const i of [2,6,10,14]){const center=visualByIndex[i];const p=document.createElementNS(ns,'path');p.setAttribute('d',path(238,center-24,center+24));p.setAttribute('fill','#020202');p.setAttribute('stroke','#050505');p.setAttribute('stroke-width','1');svg.appendChild(p);const q=polar(172,center),t=document.createElementNS(ns,'text');t.textContent=prizes[i];t.setAttribute('x',q.x);t.setAttribute('y',q.y);t.setAttribute('text-anchor','middle');t.setAttribute('dominant-baseline','middle');t.setAttribute('font-family','Arial Black,Arial,Helvetica,sans-serif');t.setAttribute('font-size',prizes[i]==='10X'?'46':'54');t.setAttribute('font-weight','900');t.setAttribute('font-style','italic');t.setAttribute('fill',prizeFill[i]);t.setAttribute('stroke',prizeStroke[i]);t.setAttribute('stroke-width','5');t.setAttribute('paint-order','stroke fill');t.setAttribute('filter','url(#prize3D)');t.setAttribute('class','prize-label');t.dataset.cx=q.x;t.dataset.cy=q.y;svg.appendChild(t)}
 const ring=document.createElementNS(ns,'circle');ring.setAttribute('cx',250);ring.setAttribute('cy',250);ring.setAttribute('r',238);ring.setAttribute('fill','none');ring.setAttribute('stroke','url(#goldRing)');ring.setAttribute('stroke-width','12');svg.appendChild(ring);const highlight=document.createElementNS(ns,'circle');highlight.setAttribute('cx',250);highlight.setAttribute('cy',250);highlight.setAttribute('r',232);highlight.setAttribute('fill','none');highlight.setAttribute('stroke','#ffe66b');highlight.setAttribute('stroke-width','2');highlight.setAttribute('opacity','.8');svg.appendChild(highlight);$('wheel').style.transform=`rotate(${rotation}deg)`;
}
function updatePrizeOrientation(rr){document.querySelectorAll('.prize-label').forEach(t=>{const x=Number(t.dataset.cx),y=Number(t.dataset.cy);t.setAttribute('transform',`translate(${x} ${y}) rotate(${-rr}) translate(${-x} ${-y})`)})}

async function spinRoulette(){
 if(spinning)return;const bet=Number($('betAmount').value),min=Number(settings.roulette_min_bet||1),max=Number(settings.roulette_max_bet||100);if(!(bet>=min&&bet<=max))return toast(`A aposta deve estar entre ${money(min)} e ${money(max)}.`,'error');if(bet>Number(user.balance||0))return toast('Saldo insuficiente.','error');spinning=true;$('spinButton').disabled=true;$('spinButton').style.opacity='.6';
 try{const r=await fetch(`${API}/roulette/spin`,{method:'POST',headers:headers(),body:JSON.stringify({userId:user.id,betAmount:bet,betType:'roulette',rouletteId:'sorte'})});const d=await r.json();if(!r.ok)throw Error(d.message||'Não foi possível realizar a rodada.');const spin=d.spin||d.result||d;if(!Number.isInteger(Number(spin.index))||Number(spin.index)<0||Number(spin.index)>=16)throw Error('Resultado inválido.');const visualByIndex={0:-14,1:0,3:14,2:45,4:76,5:90,7:104,6:135,8:166,9:180,11:194,10:225,12:256,13:270,15:284,14:315};const idx=Number(spin.index),center=visualByIndex[idx],target=((360-center-(rotation%360))+360)%360,turns=7+Math.floor(Math.random()*2),dest=rotation+turns*360+target,dur=Math.max(1800,Number(settings.roulette_animation_ms)||4800),start=performance.now(),from=rotation;await new Promise(resolve=>{function frame(now){const p=Math.min(1,(now-start)/dur),e=1-Math.pow(1-p,3),rr=from+(dest-from)*e;$('wheel').style.transform=`rotate(${rr}deg)`;updatePrizeOrientation(rr);if(p<1)return requestAnimationFrame(frame);rotation=dest;$('wheel').style.transform=`rotate(${dest}deg)`;updatePrizeOrientation(dest);resolve()}requestAnimationFrame(frame)});await loadAccount();if(Number(spin.prize)>0)toast(`Você ganhou ${money(spin.prize)}!`,'win');else toast(`Você perdeu ${money(bet)}!`,'loss')}catch(e){toast(e.message,'error')}finally{spinning=false;$('spinButton').disabled=false;$('spinButton').style.opacity='1'}
}

function configurarInterfaceRoleta(){
 const nav=document.querySelector('.bottom-nav');
 const removerRetorno=()=>{document.querySelectorAll('.back-player').forEach(el=>el.remove())};
 const sincronizarRolagem=()=>{
   const rv=document.getElementById('rouletteView');
   const pv=document.getElementById('playerView');
   const roletaAtiva=!!(rv&&getComputedStyle(rv).display!=='none');
   document.body.classList.toggle('mybets-roulette-lock',roletaAtiva);
   document.body.classList.toggle('mybets-player-scroll',!roletaAtiva);
   if(pv)pv.scrollTop=pv.scrollTop;
 };
 removerRetorno();
 document.querySelectorAll('#bottomSpinButton').forEach(el=>el.remove());
 const style=document.createElement('style');style.id='mybets-roulette-modern';style.textContent=`
html,body{overflow-x:hidden!important}
body.mybets-player-scroll{overflow-y:auto!important;overflow-x:hidden!important;height:auto!important;min-height:100%!important}
body.mybets-player-scroll #playerView{height:auto!important;min-height:calc(100vh - 66px)!important;overflow:visible!important;padding-bottom:90px!important}
body.mybets-roulette-lock{overflow:hidden!important;height:100%!important}
body.mybets-roulette-lock #rouletteView{height:calc(100vh - 66px)!important;overflow:hidden!important}
body.mybets-roulette-lock #rouletteView .page{height:calc(100vh - 66px)!important;min-height:calc(100vh - 66px)!important;overflow:hidden!important}
.back-player{display:none!important}
.header .logo{position:relative!important;padding-bottom:8px!important;line-height:1!important;color:inherit!important;text-decoration:none!important;display:inline-block!important;font-weight:950!important;letter-spacing:-2.2px!important;text-shadow:0 0 .2px currentColor!important}
.header .logo b{font-weight:950!important}
.header .logo:after{content:"";position:absolute;left:2px;right:-3px;bottom:0;height:7px;border-bottom:4px solid #f6bd24;border-radius:0 0 70% 55%;transform:skewX(-18deg) rotate(-2deg);filter:drop-shadow(0 0 3px rgba(246,189,36,.35));pointer-events:none}
.roulette-area{width:min(370px,calc(100vw - 24px))!important;margin:8px auto 4px!important}
.roulette-center-cover{width:42%!important;background:radial-gradient(circle at 38% 30%,#24211b 0%,#090909 58%,#020202 100%)!important;border:3px solid #d7a72b!important;box-shadow:0 0 0 2px #5a3b0b!important}
.roulette-center-button{width:30%!important;min-width:92px!important;max-width:124px!important;height:30%!important;min-height:92px!important;max-height:124px!important;border:3px solid #f5c83f!important;border-radius:50%!important;background:radial-gradient(circle at 38% 22%,#5a4720 0%,#1b160c 42%,#030303 78%)!important;box-shadow:0 0 0 2px #4b330a,0 0 20px rgba(255,194,45,.42),inset 0 3px 10px rgba(255,231,130,.28),inset 0 -12px 20px rgba(0,0,0,.8)!important;color:#ffd83d!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:4px!important;cursor:pointer!important}
.roulette-center-button:before{content:"MyBets"!important;color:#fff!important;font-size:clamp(16px,4.3vw,23px)!important;font-weight:900!important;font-style:italic!important;line-height:1!important;margin:0!important;padding:0 0 6px!important;border-bottom:3px solid #ffd23d!important;border-radius:0 0 65% 55%!important;transform:skewX(-10deg) rotate(-2deg)!important;text-shadow:0 1px 2px #000,0 0 7px rgba(255,210,60,.22)!important}
.roulette-center-button:after{content:"GIRAR"!important;color:#ffd83d!important;font-size:clamp(26px,7vw,38px)!important;font-weight:950!important;letter-spacing:.6px!important;line-height:1!important;text-shadow:0 2px 3px #000,0 0 10px rgba(255,204,45,.28)!important}
.bet-title{font-size:15px!important;margin-bottom:5px!important}
.roulette-bet{gap:8px!important}
.roulette-bet>button{width:50px!important;height:50px!important;border-radius:13px!important;font-size:27px!important}
.roulette-bet-field input{height:50px!important;border-radius:13px!important;padding:0 15px!important;font-size:24px!important}
.quick-bets{gap:5px!important;margin-top:5px!important}
.quick-bets button{height:43px!important;border-radius:11px!important;font-size:16px!important;border-width:2px!important}
.roulette-result{font-size:17px!important;min-height:20px!important;margin:2px 0 3px!important;top:0!important}
.rouletteView{padding-bottom:95px!important}
#rouletteView .page{padding-bottom:125px!important;min-height:calc(100vh - 66px + 80px)!important}
#rouletteView .quick-bets{margin-bottom:18px!important}
`;
if(!document.getElementById('mybets-roulette-modern'))document.head.appendChild(style);
 if(nav){
   nav.innerHTML='<button class="nav-item" data-nav="home"><span>⌂</span>Início</button><button class="nav-item" data-nav="roulette"><span>◉</span>Roleta</button><button class="nav-item" data-nav="player"><span>👤</span>Área do jogador</button><button class="nav-item" data-nav="games"><span>⌁</span>Jogos</button>';
   nav.style.gridTemplateColumns='repeat(4,1fr)';
   const items={home:nav.querySelector('[data-nav="home"]'),roulette:nav.querySelector('[data-nav="roulette"]'),player:nav.querySelector('[data-nav="player"]'),games:nav.querySelector('[data-nav="games"]')};
   const syncActive=()=>{const rv=$('rouletteView');const rouletteVisible=rv&&getComputedStyle(rv).display!=='none';Object.values(items).forEach(i=>i.classList.remove('active'));(rouletteVisible?items.roulette:items.player).classList.add('active');sincronizarRolagem()};
   items.home.onclick=()=>{location.href='/'};
   items.roulette.onclick=()=>{if(typeof openRoulette==='function')openRoulette();setTimeout(syncActive,0)};
   items.player.onclick=()=>{if(typeof closeRoulette==='function')closeRoulette();setTimeout(syncActive,0)};
   items.games.onclick=()=>{location.href='/games.html'};
   const logo=document.querySelector('.header .logo');
   if(logo){const link=document.createElement('a');link.href='/';link.className='logo';link.setAttribute('aria-label','Página principal');link.innerHTML=logo.innerHTML;link.style.color='inherit';link.style.textDecoration='none';link.style.display='inline-block';logo.replaceWith(link)}
   syncActive();
 }
 removerRetorno();
 sincronizarRolagem();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',configurarInterfaceRoleta);else configurarInterfaceRoleta();
if(typeof renderWheel==='function')renderWheel();

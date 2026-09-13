const API = "/api";

let jogoAtual = null;
let configuracaoAtual = null;
let slotBet = 1;
let rouletteBet = 1;
let slotSpinning = false;
let rouletteSpinning = false;

const SLOT_SYMBOLS = {
  fortune7: [
    {v:"7", cls:"seven"}, {v:"🍒"}, {v:"🍋"}, {v:"🔔"}, {v:"BAR"}, {v:"💎"}, {v:"⭐"}
  ],
  diamondGold: [
    {v:"💎", cls:"diamond"}, {v:"👑", cls:"crown"}, {v:"🪙", cls:"coin"}, {v:"7", cls:"seven"}, {v:"💠"}, {v:"✨"}
  ],
  royalJackpot: [
    {v:"👑", cls:"crown"}, {v:"💎", cls:"diamond"}, {v:"7", cls:"seven"}, {v:"💰", cls:"coin"}, {v:"♛", cls:"crown"}, {v:"✨"}
  ],
  lucky7: [
    {v:"7", cls:"seven"}, {v:"7", cls:"seven"}, {v:"🍒"}, {v:"🍀"}, {v:"BAR"}, {v:"⭐"}, {v:"🔔"}
  ]
};

const THEMES = {
  fortune7: {title:"FORTUNE 7", accent:"#d51f3d"},
  diamondGold: {title:"DIAMOND GOLD", accent:"#178fca"},
  royalJackpot: {title:"ROYAL JACKPOT", accent:"#9a55d8"},
  lucky7: {title:"LUCKY 7", accent:"#e3a51b"}
};

const ROULETTE_SEGMENTS = Array.from({length:15}, (_, i) => ({
  label: i % 3 === 0 ? "2X" : "X",
  type: i % 3 === 0 ? "prize" : "zero",
  multiplier: i % 3 === 0 ? 2 : 0
}));

const $ = id => document.getElementById(id);

function usuarioAtual(){
  try{return JSON.parse(localStorage.getItem("jpbet_user") || "null");}
  catch(_){return null;}
}

function tokenAtual(){return localStorage.getItem("jpbet_token") || "";}

function obterIdUsuario(){
  const u = usuarioAtual();
  return u?.id ?? u?.userId ?? null;
}

function headersJSON(){
  const h = {"Content-Type":"application/json"};
  if(tokenAtual()) h.Authorization = `Bearer ${tokenAtual()}`;
  return h;
}

function numero(v, fallback=0){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function moeda(v){
  return Number(v || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}

function mostrarToast(msg){
  const el=$("toast");
  if(!el) return;
  el.textContent=msg;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer=setTimeout(()=>el.classList.remove("show"),2800);
}

function atualizarSaldos(v){
  const valor=numero(v);
  const texto=valor.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  if($("balance")) $("balance").textContent=texto;
  if($("stageBalance")) $("stageBalance").textContent=texto;
}

function atualizarUsuario(data){
  if(!data) return;
  const atual=usuarioAtual() || {};
  const novo={...atual,...data};
  localStorage.setItem("jpbet_user",JSON.stringify(novo));
  if(Number.isFinite(Number(novo.balance))) atualizarSaldos(novo.balance);
}

function catalogoLocal(){
  return [
    {id:"roulette",name:"Roleta MyBets",type:"roulette",minBet:1,maxBet:100},
    {id:"fortune7",name:"Fortune 7",type:"slot",minBet:1,maxBet:1000},
    {id:"diamondGold",name:"Diamond Gold",type:"slot",minBet:1,maxBet:1000},
    {id:"royalJackpot",name:"Royal Jackpot",type:"slot",minBet:1,maxBet:1000},
    {id:"lucky7",name:"Lucky 7",type:"slot",minBet:1,maxBet:1000}
  ];
}

function normalizarIdJogo(gameId){
  const id=String(gameId || "").trim();
  const aliases={diamondgold:"diamondGold",royaljackpot:"royalJackpot"};
  return aliases[id.toLowerCase()] || id;
}

function configurarVisualDosJogos(){
  if($("gameStage")) $("gameStage").classList.add("games-stage-fixed");
  if(document.getElementById("gamesVisualPatch")) return;
  const style=document.createElement("style");
  style.id="gamesVisualPatch";
  style.textContent=`
    html,body{scroll-behavior:auto!important}
    .roulette-machine.custom-roulette-machine{position:relative!important;width:min(560px,94vw)!important;aspect-ratio:1/1!important;height:auto!important;margin:12px auto 22px!important;padding:18px!important;display:block!important;border-radius:50%!important;background:radial-gradient(circle,#171a21 0 57%,#080a0e 58% 66%,#c58a13 67% 69%,#111 70% 100%)!important;box-shadow:0 18px 55px rgba(0,0,0,.55),inset 0 0 35px #000,0 0 28px rgba(245,197,66,.18)!important}
    .roulette-wheel{position:absolute!important;inset:24px!important;width:auto!important;height:auto!important;border-radius:50%!important;overflow:hidden!important;border:7px solid #f4c542!important;transform-origin:center!important;z-index:2!important;box-shadow:inset 0 0 0 4px #805507,inset 0 0 35px #000,0 0 22px rgba(255,200,60,.35)!important}
    .roulette-wheel::before{content:""!important;position:absolute!important;inset:8%!important;border:3px solid rgba(255,226,130,.75)!important;border-radius:50%!important;z-index:6!important;pointer-events:none!important}
    .roulette-wheel::after{content:""!important;position:absolute!important;inset:0!important;border-radius:50%!important;z-index:4!important;pointer-events:none!important;background:repeating-conic-gradient(from -90deg,transparent 0deg 23deg,rgba(255,225,130,.95) 23deg 24deg)!important}
    .roulette-label{position:absolute!important;left:50%!important;top:50%!important;width:30%!important;height:30%!important;display:flex!important;align-items:center!important;justify-content:center!important;z-index:5!important;font-size:clamp(14px,4vw,24px)!important;font-weight:1000!important;pointer-events:none!important}
    .roulette-label.prize{color:#15110a!important;text-shadow:0 1px 0 #fff6b0,0 2px 4px #000!important}
    .roulette-label.zero{color:#f7d45a!important;text-shadow:0 2px 4px #000,0 0 7px rgba(255,215,80,.5)!important}
    .custom-roulette-machine .roulette-pointer{z-index:20!important;top:-3px!important;border-top:31px solid #ffd84d!important;filter:drop-shadow(0 4px 6px rgba(0,0,0,.7))!important}
    .roulette-hub{position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;width:31%!important;aspect-ratio:1!important;border-radius:50%!important;z-index:12!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-direction:column!important;background:radial-gradient(circle at 35% 25%,#fff3a0 0,#f5c542 20%,#a96c00 56%,#17130a 58%,#050505 100%)!important;border:5px solid #ffe17a!important;color:#120f08!important;box-shadow:0 0 0 7px rgba(0,0,0,.55),0 0 28px rgba(245,197,66,.55),inset 0 0 15px rgba(255,255,255,.45)!important;font-size:clamp(18px,4.5vw,30px)!important;font-weight:1000!important;text-transform:uppercase!important}
    .roulette-hub strong{color:#17110a!important;text-shadow:0 1px 0 #fff!important}
    .roulette-hub small{color:#7a4b00!important;font-size:18px!important}
    .roulette-betting{position:relative;z-index:3}
    .slot-panel.fortune7-visual .slot-screen{display:none!important}
    .slot-panel.fortune7-visual .slot-cabinet{background-color:#000!important}
    .slot-panel.fortune7-visual .slot-controls{position:absolute!important;z-index:8!important;left:13%!important;right:13%!important;bottom:5%!important}
    .slot-panel.fortune7-visual .slot-paytable{margin-top:14px!important}
    .slot-panel.fortune7-visual .slot-status{display:block!important}
    .slot-cabinet.spinning{animation:fortuneMachineShake .12s linear infinite!important}
    @keyframes fortuneMachineShake{0%{transform:translateX(0)}25%{transform:translateX(-1px)}50%{transform:translateX(1px)}75%{transform:translateX(-1px)}100%{transform:translateX(0)}}
    .roulette-machine.is-spinning{filter:drop-shadow(0 0 18px rgba(245,197,66,.38))}
    @media(max-width:600px){.roulette-machine.custom-roulette-machine{width:min(520px,94vw)!important;padding:14px!important}.roulette-wheel{inset:19px!important}.roulette-hub{width:30%!important}.slot-panel.fortune7-visual .slot-controls{left:12%!important;right:12%!important}}
  `;
  document.head.appendChild(style);
}

function configurarBotoesVoltar(){
  const back=$("backButton");
  const stageBack=$("stageBack");
  if(back) back.onclick=()=>window.location.href="dashboard.html";
  if(stageBack) stageBack.onclick=voltarLobby;
}

function configurarNavegacaoInicial(){
  const id=new URLSearchParams(location.search).get("game");
  if(id) abrirJogo(id);
}

function renderizarJogosFallback(){
  const box=$("gamesContainer");
  if(!box || box.querySelector(".central-game-card")) return;
  const lista=catalogoLocal();
  box.innerHTML=lista.map(j=>`<article class="lobby-card"><div class="lobby-icon">${j.type==="roulette"?"🎡":j.id==="fortune7"?"🎰":j.id==="diamondGold"?"💎":j.id==="royalJackpot"?"👑":"🍀"}</div><h3>${j.name}</h3><p>Escolha este jogo para jogar.</p><button class="lobby-play" type="button" data-game="${j.id}">JOGAR</button></article>`).join("");
  box.querySelectorAll("[data-game]").forEach(btn=>btn.onclick=()=>abrirJogo(btn.dataset.game));
}

async function carregarSaldoInicial(){
  const id=obterIdUsuario();
  if(!id) return;
  try{
    const r=await fetch(`${API}/account/${encodeURIComponent(id)}`,{headers:tokenAtual()?{Authorization:`Bearer ${tokenAtual()}`}:{}});
    if(!r.ok) return;
    const d=await r.json();
    const u=d.user || d.account || d;
    if(Number.isFinite(Number(u?.balance))){
      atualizarUsuario(u);
      const header=document.querySelector(".game-header");
      if(header) header.classList.add("has-session");
    }
  }catch(_){ }
}

async function abrirJogo(gameId){
  try{
    const id=normalizarIdJogo(gameId);
    const config=catalogoLocal().find(j=>String(j.id).toLowerCase()===id.toLowerCase());
    if(!config) throw new Error("Jogo não encontrado.");
    if(!obterIdUsuario()){
      localStorage.setItem("jpbet_pending_game",`/games.html?game=${encodeURIComponent(id)}`);
      window.location.href=`/?login=1&game=${encodeURIComponent(id)}`;
      return;
    }
    configuracaoAtual=config;
    jogoAtual=config;
    if($("gamesLobby")) $("gamesLobby").hidden=true;
    if($("gameStage")) $("gameStage").hidden=false;
    if($("gameTitle")) $("gameTitle").textContent=config.name;
    if(id.toLowerCase()==="roulette") abrirInterfaceRoleta(config);
    else abrirInterfaceSlot(config);
    window.scrollTo({top:0,behavior:"auto"});
  }catch(e){mostrarToast(e.message || "Erro ao abrir jogo.");}
}

function abrirInterfaceSlot(config){
  if($("gameTypeLabel")) $("gameTypeLabel").textContent="SLOT";
  if($("slotPanel")) $("slotPanel").hidden=false;
  if($("roulettePanel")) $("roulettePanel").hidden=true;
  const theme=THEMES[config.id] || THEMES.fortune7;
  const panel=$("slotPanel");
  if(panel) panel.classList.toggle("fortune7-visual",config.id==="fortune7");
  if($("marqueeTitle")) $("marqueeTitle").textContent=(config.name||theme.title).toUpperCase();
  document.documentElement.style.setProperty("--slot1",theme.accent);
  definirSlotBet(slotBet);
  if($("slotStatus")) $("slotStatus").textContent="Boa sorte!";
  if($("winDisplay")) $("winDisplay").textContent="R$ 0,00";
  if($("screenWin")) $("screenWin").textContent="R$ 0,00";
  criarReels(config.id);
}

function abrirInterfaceRoleta(config){
  if($("gameTypeLabel")) $("gameTypeLabel").textContent="RODA DA SORTE";
  if($("slotPanel")) $("slotPanel").hidden=true;
  if($("roulettePanel")) $("roulettePanel").hidden=false;
  rouletteBet=Math.max(1,numero(config.minBet,1));
  if($("rouletteBetValue")) $("rouletteBetValue").textContent=moeda(rouletteBet);
  if($("winDisplay")) $("winDisplay").textContent="R$ 0,00";
  criarRoletaSorte();
  if($("rouletteResult")) $("rouletteResult").textContent="Defina sua aposta e gire.";
}

function criarReels(gameId){
  const symbols=SLOT_SYMBOLS[gameId] || SLOT_SYMBOLS.fortune7;
  for(let i=0;i<3;i++){
    const reel=$(`reel${i}`);
    if(!reel) continue;
    reel.innerHTML=`<div class="reel-strip">${Array.from({length:9},(_,k)=>{const s=symbols[(k+i)%symbols.length];return `<div class="symbol ${s.cls||""}">${s.v}</div>`;}).join("")}</div>`;
    const strip=reel.querySelector(".reel-strip");
    if(strip) strip.style.transform="translateY(0)";
  }
}

function criarRoletaSorte(){
  const wheel=$("rouletteWheel");
  if(!wheel) return;
  wheel.innerHTML="";
  const n=ROULETTE_SEGMENTS.length;
  const angle=360/n;
  const faixas=ROULETTE_SEGMENTS.map((s,i)=>`${s.type==="prize"?"#d4af37":"#111111"} ${i*angle}deg ${(i+1)*angle}deg`).join(",");
  wheel.style.background=`conic-gradient(from -${angle/2}deg,${faixas})`;
  ROULETTE_SEGMENTS.forEach((seg,i)=>{
    const el=document.createElement("span");
    el.className=`roulette-label ${seg.type}`;
    el.textContent=seg.label;
    const mid=i*angle+angle/2;
    el.style.transform=`translate(-50%,-50%) rotate(${mid}deg) translateY(-${innerWidth<500?39:40}%) rotate(${-mid}deg)`;
    wheel.appendChild(el);
  });
}

function definirSlotBet(v){
  const min=Math.max(1,numero(configuracaoAtual?.minBet,1));
  const max=Math.max(min,numero(configuracaoAtual?.maxBet,1000));
  slotBet=Math.min(max,Math.max(min,numero(v,min)));
  if($("slotBetValue")) $("slotBetValue").textContent=moeda(slotBet);
}

function definirRouletteBet(v){
  const min=Math.max(1,numero(configuracaoAtual?.minBet,1));
  const max=Math.max(min,Math.min(100,numero(configuracaoAtual?.maxBet,100)));
  rouletteBet=Math.min(max,Math.max(min,numero(v,min)));
  if($("rouletteBetValue")) $("rouletteBetValue").textContent=moeda(rouletteBet);
}

function prepararBets(){
  if($("betMinus")) $("betMinus").onclick=()=>definirSlotBet(slotBet-1);
  if($("betPlus")) $("betPlus").onclick=()=>definirSlotBet(slotBet+1);
  $("slotQuickBets")?.querySelectorAll("[data-bet]").forEach(b=>b.onclick=()=>definirSlotBet(b.dataset.bet));
  if($("slotSpinButton")) $("slotSpinButton").onclick=girarSlot;
  if($("rouletteBetMinus")) $("rouletteBetMinus").onclick=()=>definirRouletteBet(rouletteBet-1);
  if($("rouletteBetPlus")) $("rouletteBetPlus").onclick=()=>definirRouletteBet(rouletteBet+1);
  document.querySelectorAll("[data-roulette-bet]").forEach(b=>b.onclick=()=>definirRouletteBet(b.dataset.rouletteBet));
  if($("rouletteSpinButton")) $("rouletteSpinButton").onclick=girarRoleta;
  if($("rouletteHubButton")) $("rouletteHubButton").onclick=girarRoleta;
}

function simbolosParaResultado(win,gameId){
  if(win>0){
    if(gameId==="fortune7") return ["7","7","7"];
    if(gameId==="diamondGold") return ["💎","💎","💎"];
    if(gameId==="royalJackpot") return ["👑","👑","👑"];
    return ["7","🍀","7"];
  }
  const symbols=SLOT_SYMBOLS[gameId] || SLOT_SYMBOLS.fortune7;
  return Array.from({length:3},()=>symbols[Math.floor(Math.random()*symbols.length)].v);
}

async function animarResultadoSlot(result){
  const strips=[...document.querySelectorAll(".reel-strip")];
  await Promise.all(strips.map((strip,i)=>new Promise(resolve=>{
    const reel=strip.parentElement;
    const symbols=SLOT_SYMBOLS[configuracaoAtual?.id] || SLOT_SYMBOLS.fortune7;
    const pool=[];
    for(let k=0;k<18+i*4;k++) pool.push(symbols[Math.floor(Math.random()*symbols.length)]);
    pool.push({v:result[i] || "7"});
    strip.innerHTML=pool.map(s=>`<div class="symbol ${s.cls||""}">${s.v}</div>`).join("");
    const itemHeight=Math.max(1,reel.clientHeight/3);
    strip.style.transition="none";
    strip.style.transform="translateY(0)";
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      strip.style.transition=`transform ${1450+i*280}ms cubic-bezier(.12,.72,.12,1)`;
      strip.style.transform=`translateY(-${(pool.length-1)*itemHeight}px)`;
    }));
    setTimeout(resolve,1900+i*260);
  })));
}

async function girarSlot(){
  if(slotSpinning) return;
  const userId=obterIdUsuario();
  if(!userId) return mostrarToast("Faça login novamente.");
  const bet=numero(slotBet);
  const saldo=numero(usuarioAtual()?.balance,0);
  if(bet>saldo) return mostrarToast("Saldo insuficiente.");
  if(bet<1 || bet>1000) return mostrarToast("Aposta fora dos limites.");

  slotSpinning=true;
  const btn=$("slotSpinButton");
  const cabinet=$("slotCabinet");
  if(btn){btn.disabled=true;btn.querySelector("span")?.replaceChildren(document.createTextNode("GIRANDO..."));}
  cabinet?.classList.add("spinning");
  if($("slotStatus")) $("slotStatus").textContent="Girando...";

  try{
    const resposta=await fetch(`${API}/roulette/spin`,{
      method:"POST",
      headers:headersJSON(),
      body:JSON.stringify({userId,betAmount:bet,betType:"roulette",rouletteId:"sorte",freeSpin:false})
    });
    const data=await resposta.json();
    if(!resposta.ok) throw new Error(data.message || "Não foi possível registrar a aposta.");
    const r=data.spin || data.result || data;
    const win=numero(r.prize ?? data.prize ?? data.win,0);
    const result=simbolosParaResultado(win,configuracaoAtual.id);
    await animarResultadoSlot(result);
    const balance=data.user?.balance ?? data.balance ?? data.saldoDepois;
    if(balance!==undefined){atualizarUsuario(data.user || {balance});atualizarSaldos(balance);}
    if($("screenWin")) $("screenWin").textContent=moeda(win);
    if($("winDisplay")) $("winDisplay").textContent=moeda(win);
    if($("slotStatus")) $("slotStatus").textContent=win>0?`Você ganhou ${moeda(win)}!`:"Aposta registrada. Boa sorte no próximo giro!";
    if(win>0) cabinet?.classList.add("win");
  }catch(e){
    mostrarToast(e.message || "Erro ao girar.");
    if($("slotStatus")) $("slotStatus").textContent="Boa sorte!";
  }finally{
    setTimeout(()=>{
      cabinet?.classList.remove("spinning","win");
      if(btn){btn.disabled=false;const span=btn.querySelector("span");if(span) span.textContent="GIRAR";}
      slotSpinning=false;
    },500);
  }
}

async function girarRoleta(){
  if(rouletteSpinning) return;
  const userId=obterIdUsuario();
  if(!userId) return mostrarToast("Faça login novamente.");
  const bet=numero(rouletteBet,1);
  const saldo=numero(usuarioAtual()?.balance,0);
  if(bet>saldo) return mostrarToast("Saldo insuficiente.");

  rouletteSpinning=true;
  const btn=$("rouletteSpinButton");
  const hub=$("rouletteHubButton");
  const machine=document.querySelector(".roulette-machine");
  const wheel=$("rouletteWheel");
  if(btn){btn.disabled=true;btn.textContent="GIRANDO...";}
  if(hub) hub.disabled=true;
  machine?.classList.add("is-spinning");

  try{
    const resposta=await fetch(`${API}/roulette/spin`,{
      method:"POST",
      headers:headersJSON(),
      body:JSON.stringify({userId,betAmount:bet,betType:"roulette",rouletteId:"sorte",freeSpin:false})
    });
    const data=await resposta.json();
    if(!resposta.ok) throw new Error(data.message || "Não foi possível girar a roleta.");
    const r=data.spin || data.result || data;
    let index=numero(r.index,-1);
    if(index<0 || index>=ROULETTE_SEGMENTS.length) index=Math.floor(Math.random()*ROULETTE_SEGMENTS.length);
    const angle=360/ROULETTE_SEGMENTS.length;
    const target=360-(index*angle+angle/2);
    const rotations=7+Math.floor(Math.random()*3);
    const duration=4800;
    if(wheel){
      wheel.style.transition=`transform ${duration}ms cubic-bezier(.12,.72,.12,1)`;
      wheel.style.transform=`rotate(${rotations*360+target}deg)`;
    }
    await new Promise(resolve=>setTimeout(resolve,duration+120));
    const prize=numero(r.prize,0);
    if(data.user){atualizarUsuario(data.user);atualizarSaldos(data.user.balance);}
    else if(data.balance!==undefined){atualizarSaldos(data.balance);atualizarUsuario({balance:data.balance});}
    if($("winDisplay")) $("winDisplay").textContent=moeda(prize);
    const seg=ROULETTE_SEGMENTS[index];
    if($("rouletteResult")) $("rouletteResult").textContent=prize>0?`🎉 ${seg.label} — Prêmio ${moeda(prize)}`:"❌ PERDEU — Prêmio R$ 0,00";
  }catch(e){
    if($("rouletteResult")) $("rouletteResult").textContent="Defina sua aposta e gire.";
    mostrarToast(e.message || "Erro ao girar a roleta.");
  }finally{
    machine?.classList.remove("is-spinning");
    rouletteSpinning=false;
    if(btn){btn.disabled=false;btn.textContent="GIRAR ROLETA";}
    if(hub) hub.disabled=false;
  }
}

function voltarLobby(){
  if(slotSpinning || rouletteSpinning) return;
  if($("gameStage")) $("gameStage").hidden=true;
  if($("gamesLobby")) $("gamesLobby").hidden=false;
  history.replaceState(null,"","games.html");
  window.scrollTo({top:0,behavior:"auto"});
}

document.addEventListener("DOMContentLoaded",()=>{
  configurarVisualDosJogos();
  configurarBotoesVoltar();
  prepararBets();
  renderizarJogosFallback();
  carregarSaldoInicial();
  configurarNavegacaoInicial();
});

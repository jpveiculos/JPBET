const API = "/api";

let jogos = [];
let jogoAtual = null;
let configuracaoAtual = null;
let slotBet = 1;
let rouletteBet = 1;
let rouletteSpinning = false;
let slotSpinning = false;

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

const ROULETTE_SEGMENTS = [
  {label:"2x",type:"prize",multiplier:2,probability:2.546875},{label:"3x",type:"prize",multiplier:3,probability:1.25},{label:"X",type:"zero",multiplier:0,probability:6.6359},{label:"75x",type:"prize",multiplier:75,probability:0.005},{label:"3x",type:"prize",multiplier:3,probability:1.25},{label:"X",type:"zero",multiplier:0,probability:6.6359},{label:"2x",type:"prize",multiplier:2,probability:2.546875},{label:"20x",type:"prize",multiplier:20,probability:0.2},{label:"2x",type:"prize",multiplier:2,probability:2.546875},{label:"3x",type:"prize",multiplier:3,probability:1.25},{label:"2x",type:"prize",multiplier:2,probability:2.546875},{label:"X",type:"zero",multiplier:0,probability:6.6359},{label:"10x",type:"prize",multiplier:10,probability:1},{label:"X",type:"zero",multiplier:0,probability:6.6359},{label:"5x",type:"prize",multiplier:5,probability:1.3333333333},{label:"X",type:"zero",multiplier:0,probability:6.6359},{label:"100x",type:"prize",multiplier:100,probability:0.001},{label:"X",type:"zero",multiplier:0,probability:6.6359},{label:"2x",type:"prize",multiplier:2,probability:2.546875},{label:"X",type:"zero",multiplier:0,probability:6.6359},{label:"2x",type:"prize",multiplier:2,probability:2.546875},{label:"50x",type:"prize",multiplier:50,probability:0.01},{label:"3x",type:"prize",multiplier:3,probability:1.25},{label:"X",type:"zero",multiplier:0,probability:6.6359},{label:"5x",type:"prize",multiplier:5,probability:1.3333333333},{label:"2x",type:"prize",multiplier:2,probability:2.546875},{label:"5x",type:"prize",multiplier:5,probability:1.3333333333},{label:"30x",type:"prize",multiplier:30,probability:0.05},{label:"X",type:"zero",multiplier:0,probability:6.6359},{label:"2x",type:"prize",multiplier:2,probability:2.546875},{label:"X",type:"zero",multiplier:0,probability:6.6359},{label:"🍀",type:"replay",multiplier:0,probability:3}
];

const ROULETTE_VISUAL_SEGMENTS = [
  {label:"2X", type:"prize", multiplier:2},
  {label:"X", type:"zero", multiplier:0},
  {label:"3X", type:"prize", multiplier:3},
  {label:"X", type:"zero", multiplier:0},
  {label:"4X", type:"prize", multiplier:4},
  {label:"X", type:"zero", multiplier:0},
  {label:"X", type:"zero", multiplier:0},
  {label:"🍀", type:"replay", multiplier:0},
  {label:"5X", type:"prize", multiplier:5},
  {label:"X", type:"zero", multiplier:0}
];

const THEMES = {
  fortune7: {title:"FORTUNE 7", type:"SLOT", accent:"#d51f3d"},
  diamondGold: {title:"DIAMOND GOLD", type:"SLOT", accent:"#178fca"},
  royalJackpot: {title:"ROYAL JACKPOT", type:"SLOT", accent:"#9a55d8"},
  lucky7: {title:"LUCKY 7", type:"SLOT", accent:"#e3a51b"}
};

const $ = id => document.getElementById(id);

function usuarioAtual() {
  try {
    return JSON.parse(localStorage.getItem("jpbet_user") || "null");
  } catch (_) {
    return null;
  }
}

function tokenAtual() {
  return localStorage.getItem("jpbet_token") || "";
}

function headersJSON() {
  const h = {"Content-Type":"application/json"};
  if (tokenAtual()) h.Authorization = `Bearer ${tokenAtual()}`;
  return h;
}

function moeda(v) {
  return Number(v || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}

function numero(v, fallback=0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function obterIdUsuario() {
  const u = usuarioAtual();
  return u?.id ?? u?.userId ?? null;
}

function mostrarToast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

function atualizarSaldos(v) {
  const valor = numero(v);
  $("balance").textContent = valor.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  $("stageBalance").textContent = valor.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
}

function configurarBotoesVoltar() {
  $("backButton").onclick = () => window.location.href = "dashboard.html";
  $("stageBack").onclick = voltarLobby;
}

async function carregarJogos() {
  try {
    const resposta = await fetch(`${API}/games`, {headers: headersJSON()});
    const data = await resposta.json();
    if (!resposta.ok) throw new Error(data.message || "Não foi possível carregar os jogos.");
    jogos = Array.isArray(data.games) ? data.games : [];
    renderizarJogos();
    const id = new URLSearchParams(location.search).get("game");
    if (id) {
      const jogo = jogos.find(j => String(j.id) === String(id));
      if (jogo) await abrirJogo(jogo.id);
    }
  } catch (e) {
    $("gamesMessage").textContent = e.message || "Erro ao carregar jogos.";
  }
}

function iconeJogo(jogo) {
  if (jogo.type === "roulette" || jogo.id === "roulette") return "🎡";
  const icons = {fortune7:"🎰",diamondGold:"💎",royalJackpot:"👑",lucky7:"🍀"};
  return icons[jogo.id] || "🎰";
}

function renderizarJogos() {
  const box = $("gamesContainer");
  $("gamesMessage").style.display = jogos.length ? "none" : "block";
  box.innerHTML = jogos.map(jogo => `
    <article class="lobby-card">
      <div class="lobby-icon">${iconeJogo(jogo)}</div>
      <h3>${jogo.name || jogo.id}</h3>
      <p>${jogo.description || "Escolha este jogo para jogar."}</p>
      <button class="lobby-play" type="button" data-game="${String(jogo.id)}">JOGAR</button>
    </article>
  `).join("");

  box.querySelectorAll("[data-game]").forEach(btn => {
    btn.onclick = () => abrirJogo(btn.dataset.game);
  });
}

async function abrirJogo(gameId) {
  try {
    const resposta = await fetch(`${API}/games/${encodeURIComponent(gameId)}`, {headers: headersJSON()});
    const data = await resposta.json();
    if (!resposta.ok) throw new Error(data.message || "Não foi possível abrir o jogo.");

    configuracaoAtual = data.game || data;
    jogoAtual = configuracaoAtual;

    $("gamesLobby").hidden = true;
    $("gameStage").hidden = false;
    $("gameTitle").textContent = configuracaoAtual.name || gameId;

    if ((configuracaoAtual.type || "").toLowerCase() === "roulette" || gameId === "roulette") {
      abrirInterfaceRoleta(configuracaoAtual);
    } else {
      abrirInterfaceSlot(configuracaoAtual);
    }

    window.scrollTo({top:0,behavior:"instant"});
  } catch (e) {
    mostrarToast(e.message || "Erro ao abrir jogo.");
  }
}

function abrirInterfaceSlot(config) {
  $("gameTypeLabel").textContent = "SLOT";
  $("slotPanel").hidden = false;
  $("roulettePanel").hidden = true;
  const theme = THEMES[config.id] || THEMES.fortune7;
  $("marqueeTitle").textContent = (config.name || theme.title).toUpperCase();
  document.documentElement.style.setProperty("--slot1", theme.accent);
  $("slotBetValue").textContent = moeda(slotBet);
  $("slotStatus").textContent = "Boa sorte!";
  $("winDisplay").textContent = "R$ 0,00";
  $("screenWin").textContent = "R$ 0,00";
  criarReels(config.id);
}

function abrirInterfaceRoleta(config) {
  $("gameTypeLabel").textContent = "RODA DA SORTE";
  $("slotPanel").hidden = true;
  $("roulettePanel").hidden = false;
  $("winDisplay").textContent = "R$ 0,00";
  rouletteBet = Math.max(0.5, numero(config.minBet,0.5));
  $("rouletteBetValue").textContent = moeda(rouletteBet);
  criarRoletaSorte();
  atualizarGiroGratis();
}

function classeRoleta(seg) {
  if (seg.type === "replay") return "clover";
  if (seg.type === "zero") return "zero";
  return `m${seg.multiplier}`;
}

function criarRoletaSorte() {
  const wheel = $("rouletteWheel");
  if (!wheel) return;

  const angle = 360 / ROULETTE_VISUAL_SEGMENTS.length;
  const colors = [
    "#f4b91f", "#16171c", "#7b19d8", "#15171c", "#0879e8",
    "#15171c", "#15171c", "#087d2f", "#ed1f5a", "#15171c"
  ];

  wheel.innerHTML = "";
  ROULETTE_VISUAL_SEGMENTS.forEach((seg, i) => {
    const d = document.createElement("span");
    d.className = `roulette-label ${seg.type === "replay" ? "clover" : seg.type === "zero" ? "zero" : `v${seg.multiplier}`}`;
    d.textContent = seg.type === "replay" ? "🍀" : seg.label;
    const mid = i * angle + angle / 2;
    const radius = Math.min(44, Math.max(37, (wheel.clientWidth || 300) * 0.14));
    d.style.transform = `translate(-50%,-50%) rotate(${mid}deg) translateY(-${radius}%) rotate(${-mid}deg)`;
    d.dataset.index = i;
    wheel.appendChild(d);

    if (seg.type === "replay") {
      const sub = document.createElement("small");
      sub.className = "roulette-label-sub";
      sub.textContent = "GIRO GRÁTIS";
      sub.style.transform = `translate(-50%,-50%) rotate(${mid}deg) translateY(-${radius - 7}%) rotate(${-mid}deg)`;
      wheel.appendChild(sub);
    }
  });

  wheel.style.background = `repeating-conic-gradient(from -18deg, transparent 0deg ${angle - 1.2}deg, rgba(255,221,105,.9) ${angle - 1.2}deg ${angle}deg), conic-gradient(from -18deg, ${colors.map((c, i) => `${c} ${i * angle}deg ${(i + 1) * angle}deg`).join(",")})`;
}

function atualizarGiroGratis() {
  const u=usuarioAtual()||{};
  const qtd=numero(u.rouletteFreeSpins,0);
  const aposta=numero(u.rouletteFreeSpinBet,0);
  const box=$("rouletteFreeSpinStatus");
  const btn=$("rouletteSpinButton");
  if(qtd>0 && aposta>0){ box.hidden=false; box.textContent=`🍀 ${qtd} giro${qtd===1?"":"s"} grátis disponível${qtd===1?"":"eis"} — aposta ${moeda(aposta)}`; btn.textContent="USAR GIRO GRÁTIS"; }
  else { box.hidden=true; box.textContent=""; btn.textContent="GIRAR ROLETA"; }
}

function criarReels(gameId) {
  const symbols = SLOT_SYMBOLS[gameId] || SLOT_SYMBOLS.fortune7;
  for (let i=0;i<3;i++) {
    const reel = $(`reel${i}`);
    reel.innerHTML = `<div class="reel-strip">${Array.from({length:9},(_,k)=>{
      const s = symbols[(k+i)%symbols.length];
      return `<div class="symbol ${s.cls||""}">${s.v}</div>`;
    }).join("")}</div>`;
  }
}

function definirSlotBet(v) {
  const min = Math.max(0.01, numero(configuracaoAtual?.minBet,1));
  const max = Math.max(min, numero(configuracaoAtual?.maxBet,1000));
  slotBet = Math.min(max, Math.max(min, numero(v,min)));
  $("slotBetValue").textContent = moeda(slotBet);
}

function prepararBets() {
  $("betMinus").onclick = () => definirSlotBet(slotBet - 1);
  $("betPlus").onclick = () => definirSlotBet(slotBet + 1);
  $("slotQuickBets").querySelectorAll("[data-bet]").forEach(b => { b.onclick = () => definirSlotBet(numero(b.dataset.bet,1)); });
  $("slotSpinButton").onclick = girarSlot;
  $("rouletteBetMinus").onclick = () => definirRouletteBet(rouletteBet - 0.5);
  $("rouletteBetPlus").onclick = () => definirRouletteBet(rouletteBet + 0.5);
  document.querySelectorAll("[data-roulette-bet]").forEach(b => { b.onclick = () => definirRouletteBet(numero(b.dataset.rouletteBet,0.5)); });
  $("rouletteSpinButton").onclick = girarRoleta;
  const hub = $("rouletteHubButton");
  if (hub) hub.onclick = girarRoleta;
}

function definirRouletteBet(v) {
  const min = Math.max(0.01, numero(configuracaoAtual?.minBet,1));
  const max = Math.max(min, numero(configuracaoAtual?.maxBet,1000));
  rouletteBet = Math.min(max, Math.max(min, numero(v,min)));
  $("rouletteBetValue").textContent = moeda(rouletteBet);
}

async function girarSlot() {
  if (slotSpinning) return;
  const userId = obterIdUsuario();
  if (!userId) return mostrarToast("Faça login novamente.");

  const bet = numero(slotBet);
  if (!(bet > 0)) return mostrarToast("Informe uma aposta válida.");
  if (bet < numero(configuracaoAtual?.minBet,1) || bet > numero(configuracaoAtual?.maxBet,1000)) {
    return mostrarToast("Aposta fora dos limites.");
  }

  slotSpinning = true;
  const btn = $("slotSpinButton");
  const cabinet = $("slotCabinet");
  btn.disabled = true;
  cabinet.classList.add("spinning");
  $("slotStatus").textContent = "Girando...";

  const strips = [...document.querySelectorAll(".reel-strip")];
  document.querySelectorAll(".reel").forEach(r=>r.classList.add("spinning"));

  try {
    const resposta = await fetch(`${API}/games/spin`,{
      method:"POST",
      headers:headersJSON(),
      body:JSON.stringify({userId,gameId:configuracaoAtual.id,bet})
    });
    const data = await resposta.json();
    if (!resposta.ok) throw new Error(data.message || "Não foi possível girar.");

    const resultado = data.result || data.spin || data;
    const symbols = extrairSimbolosResultado(resultado);
    await animarResultadoSlot(strips, symbols);

    const win = numero(resultado.win ?? resultado.won ?? resultado.payout ?? data.win,0);
    atualizarSaldos(data.saldoDepois ?? data.balance ?? data.user?.balance ?? 0);
    $("screenWin").textContent = moeda(win);
    $("winDisplay").textContent = moeda(win);

    if (win > 0) {
      cabinet.classList.add("win");
      $("slotStatus").textContent = `Você ganhou ${moeda(win)}!`;
    } else {
      $("slotStatus").textContent = "Boa sorte no próximo giro!";
    }
  } catch(e) {
    $("slotStatus").textContent = "Boa sorte!";
    mostrarToast(e.message || "Erro ao girar.");
  } finally {
    setTimeout(()=>{
      document.querySelectorAll(".reel").forEach(r=>r.classList.remove("spinning"));
      cabinet.classList.remove("spinning","win");
      btn.disabled = false;
      slotSpinning = false;
    },700);
  }
}

function extrairSimbolosResultado(resultado) {
  let raw = resultado?.symbols || resultado?.reels || resultado?.result || resultado?.outcome;
  if (Array.isArray(raw)) {
    if (raw.length >= 3 && Array.isArray(raw[0])) return raw.map(x=>x[1] ?? x[0]);
    return raw.slice(0,3).map(x=>typeof x==="object" ? (x.symbol ?? x.value ?? x.label) : x);
  }
  return [randomSlotSymbol(),randomSlotSymbol(),randomSlotSymbol()];
}

function randomSlotSymbol() {
  const symbols = SLOT_SYMBOLS[configuracaoAtual?.id] || SLOT_SYMBOLS.fortune7;
  return symbols[Math.floor(Math.random()*symbols.length)].v;
}

function normalizarSymbol(v) {
  const s=String(v??"");
  if (s==="7" || /seven|7/.test(s.toLowerCase())) return "7";
  if (/diamond|gem|💎/.test(s.toLowerCase())) return "💎";
  if (/cherr|🍒/.test(s.toLowerCase())) return "🍒";
  if (/lemon|🍋/.test(s.toLowerCase())) return "🍋";
  if (/bell|🔔/.test(s.toLowerCase())) return "🔔";
  if (/crown|👑|♛/.test(s.toLowerCase())) return "👑";
  if (/coin|money|💰|🪙/.test(s.toLowerCase())) return "🪙";
  if (/bar/.test(s.toLowerCase())) return "BAR";
  if (/star|⭐|✨/.test(s.toLowerCase())) return "⭐";
  if (/clover|🍀/.test(s.toLowerCase())) return "🍀";
  return s || randomSlotSymbol();
}

function animarResultadoSlot(strips, result) {
  return new Promise(resolve=>{
    const values = result.map(normalizarSymbol);
    strips.forEach((strip,i)=>{
      strip.innerHTML = "";
      const symbols = SLOT_SYMBOLS[configuracaoAtual?.id] || SLOT_SYMBOLS.fortune7;
      const pool = [];
      for(let k=0;k<18+i*3;k++) pool.push(symbols[Math.floor(Math.random()*symbols.length)]);
      values.forEach(v=>pool.push({v}));
      strip.innerHTML = pool.map(s=>`<div class="symbol ${s.cls||""}">${s.v}</div>`).join("");
      const targetIndex = pool.length-1;
      strip.style.transition = "none";
      strip.style.transform = "translateY(0)";
      requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{
          strip.style.transition = `transform ${1500+i*230}ms cubic-bezier(.12,.72,.12,1)`;
          strip.style.transform = `translateY(-${targetIndex*75}px)`;
        });
      });
    });
    setTimeout(resolve,2200);
  });
}

async function girarRoleta() {
  if (rouletteSpinning) return;
  const userId = obterIdUsuario();
  if (!userId) return mostrarToast("Faça login novamente.");

  const u = usuarioAtual() || {};
  const hasFree = numero(u.rouletteFreeSpins,0)>0 && numero(u.rouletteFreeSpinBet,0)>0;
  const bet = hasFree ? numero(u.rouletteFreeSpinBet,0) : numero(rouletteBet,0.5);
  const min = Math.max(0.5, numero(configuracaoAtual?.minBet,0.5));
  const max = Math.min(100, Math.max(min, numero(configuracaoAtual?.maxBet,100)));
  if (!hasFree && (bet < min || bet > max)) return mostrarToast("Aposta fora dos limites.");
  if (!hasFree && bet > numero(u.balance,0)) return mostrarToast("Saldo insuficiente.");

  rouletteSpinning=true;
  const btn=$("rouletteSpinButton"); btn.disabled=true; btn.textContent="GIRANDO...";
  try {
    const resposta=await fetch(`${API}/roulette/spin`,{method:"POST",headers:headersJSON(),body:JSON.stringify({userId,betAmount:bet,betType:"roulette",rouletteId:"sorte",freeSpin:hasFree})});
    const data=await resposta.json();
    if(!resposta.ok) throw new Error(data.message||"Não foi possível girar.");
    const r=data.spin||data.result||data;
    const index=numero(r.index,-1);
    if(index<0 || index>=ROULETTE_SEGMENTS.length) throw new Error("Resultado inválido.");
    const wheel=$("rouletteWheel");
    const logicalSeg=ROULETTE_SEGMENTS[index];
    const visualIndex = (() => {
      const exact = ROULETTE_VISUAL_SEGMENTS.findIndex(s => s.type === logicalSeg.type && Number(s.multiplier) === Number(logicalSeg.multiplier));
      if (exact >= 0) return exact;
      if (logicalSeg.type === "replay") return 7;
      if (logicalSeg.type === "zero") return 1;
      let best = 0, bestDiff = Infinity;
      ROULETTE_VISUAL_SEGMENTS.forEach((s, i) => {
        if (s.type !== "prize") return;
        const diff = Math.abs(Number(s.multiplier) - Number(logicalSeg.multiplier));
        if (diff < bestDiff) { bestDiff = diff; best = i; }
      });
      return best;
    })();
    const angle=360/ROULETTE_VISUAL_SEGMENTS.length;
    const target=360-(visualIndex*angle+angle/2);
    const rotations=7+Math.floor(Math.random()*3);
    wheel.style.transition=`transform ${numero(configuracaoAtual?.animationMs,4800)}ms cubic-bezier(.12,.72,.12,1)`;
    wheel.style.transform=`rotate(${rotations*360+target}deg)`;
    await new Promise(resolve=>setTimeout(resolve,numero(configuracaoAtual?.animationMs,4800)+100));

    const seg=ROULETTE_SEGMENTS[index];
    const prize=numero(r.prize,0);
    if(data.user){
      atualizarSaldos(data.user.balance);
      localStorage.setItem("jpbet_user",JSON.stringify({...u,...data.user}));
    }
    $("winDisplay").textContent=moeda(prize);
    if(seg.type==="replay") $("rouletteResult").textContent=`🍀 GIRO GRÁTIS! Aposta preservada: ${moeda(bet)}.`;
    else if(prize>0) $("rouletteResult").textContent=`🎉 ${seg.label} — Prêmio ${moeda(prize)}${hasFree?" (giro grátis)":""}`;
    else $("rouletteResult").textContent="❌ PERDEU — Prêmio R$ 0,00";
    criarRoletaSorte();
    atualizarGiroGratis();
  } catch(e) {
    $("rouletteResult").textContent="Defina sua aposta e gire.";
    mostrarToast(e.message||"Erro ao girar.");
  } finally {
    rouletteSpinning=false; btn.disabled=false; atualizarGiroGratis();
  }
}

function voltarLobby() {
  if (slotSpinning || rouletteSpinning) return;
  $("gameStage").hidden=true;
  $("gamesLobby").hidden=false;
  history.replaceState(null,"","games.html");
  window.scrollTo({top:0,behavior:"instant"});
}

document.addEventListener("DOMContentLoaded",()=>{
  configurarBotoesVoltar();
  prepararBets();
  carregarJogos();
});

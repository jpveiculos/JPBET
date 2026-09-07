const API = "/api";

let jogos = [];
let jogoAtual = null;
let configuracaoAtual = null;
let slotBet = 1;
let rouletteBet = 1;
let rouletteSelected = 0;
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

    if (!resposta.ok) {
      throw new Error(data.message || "Não foi possível carregar os jogos.");
    }

    jogos = Array.isArray(data.games) ? data.games : [];

    renderizarJogos();

    const id = new URLSearchParams(location.search).get("game");

    if (id) {
      const jogo = jogos.find(j => String(j.id) === String(id));

      if (jogo) {
        await abrirJogo(jogo.id);
      }
    }
  } catch (e) {
    $("gamesMessage").textContent = e.message || "Erro ao carregar jogos.";
  }
}

function iconeJogo(jogo) {
  if (jogo.type === "roulette" || jogo.id === "roulette") {
    return "🎡";
  }

  const icons = {
    fortune7:"🎰",
    diamondGold:"💎",
    royalJackpot:"👑",
    lucky7:"🍀"
  };

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
      <button class="lobby-play" type="button" data-game="${String(jogo.id)}">
        JOGAR
      </button>
    </article>
  `).join("");

  box.querySelectorAll("[data-game]").forEach(btn => {
    btn.onclick = () => abrirJogo(btn.dataset.game);
  });
}

async function abrirJogo(gameId) {
  try {
    const resposta = await fetch(
      `${API}/games/${encodeURIComponent(gameId)}`,
      {headers: headersJSON()}
    );

    const data = await resposta.json();

    if (!resposta.ok) {
      throw new Error(data.message || "Não foi possível abrir o jogo.");
    }

    configuracaoAtual = data.game || data;
    jogoAtual = configuracaoAtual;

    $("gamesLobby").hidden = true;
    $("gameStage").hidden = false;

    $("gameTitle").textContent =
      configuracaoAtual.name || gameId;

    if (
      (configuracaoAtual.type || "").toLowerCase() === "roulette" ||
      gameId === "roulette"
    ) {
      abrirInterfaceRoleta(configuracaoAtual);
    } else {
      abrirInterfaceSlot(configuracaoAtual);
    }

    window.scrollTo({
      top:0,
      behavior:"instant"
    });

  } catch (e) {
    mostrarToast(e.message || "Erro ao abrir jogo.");
  }
}

function abrirInterfaceSlot(config) {
  $("gameTypeLabel").textContent = "SLOT";

  $("slotPanel").hidden = false;
  $("roulettePanel").hidden = true;

  const theme =
    THEMES[config.id] || THEMES.fortune7;

  $("marqueeTitle").textContent =
    (config.name || theme.title).toUpperCase();

  document.documentElement.style.setProperty(
    "--slot1",
    theme.accent
  );

  $("slotBetValue").textContent = moeda(slotBet);
  $("slotStatus").textContent = "Boa sorte!";
  $("winDisplay").textContent = "R$ 0,00";
  $("screenWin").textContent = "R$ 0,00";

  criarReels(config.id);
}

function abrirInterfaceRoleta(config) {
  $("gameTypeLabel").textContent = "ROLETA EUROPEIA";

  $("slotPanel").hidden = true;
  $("roulettePanel").hidden = false;

  $("winDisplay").textContent = "R$ 0,00";

  rouletteBet = Math.max(
    1,
    numero(config.minBet,1)
  );

  rouletteSelected = 0;

  $("rouletteBetValue").textContent =
    moeda(rouletteBet);

  criarNumerosRoleta();
  atualizarSelecaoRoleta();
}

function criarReels(gameId) {
  const symbols =
    SLOT_SYMBOLS[gameId] ||
    SLOT_SYMBOLS.fortune7;

  for (let i=0;i<3;i++) {
    const reel = $(`reel${i}`);

    reel.innerHTML = `
      <div class="reel-strip">
        ${Array.from({length:9},(_,k)=>{
          const s = symbols[(k+i)%symbols.length];

          return `
            <div class="symbol ${s.cls||""}">
              ${s.v}
            </div>
          `;
        }).join("")}
      </div>
    `;
  }
}

function definirSlotBet(v) {
  const min =
    Math.max(
      0.01,
      numero(configuracaoAtual?.minBet,1)
    );

  const max =
    Math.max(
      min,
      numero(configuracaoAtual?.maxBet,1000)
    );

  slotBet =
    Math.min(
      max,
      Math.max(
        min,
        numero(v,min)
      )
    );

  $("slotBetValue").textContent =
    moeda(slotBet);
}

function prepararBets() {
  $("betMinus").onclick =
    () => definirSlotBet(slotBet - 1);

  $("betPlus").onclick =
    () => definirSlotBet(slotBet + 1);

  $("slotQuickBets")
    .querySelectorAll("[data-bet]")
    .forEach(b => {
      b.onclick =
        () => definirSlotBet(
          numero(b.dataset.bet,1)
        );
    });

  $("slotSpinButton").onclick =
    girarSlot;

  $("rouletteBetMinus").onclick =
    () => definirRouletteBet(
      rouletteBet - 1
    );

  $("rouletteBetPlus").onclick =
    () => definirRouletteBet(
      rouletteBet + 1
    );

  document
    .querySelectorAll("[data-roulette-bet]")
    .forEach(b => {
      b.onclick =
        () => definirRouletteBet(
          numero(
            b.dataset.rouletteBet,
            1
          )
        );
    });

  $("rouletteBetType").onchange = () => {
    const type =
      $("rouletteBetType").value;

    rouletteSelected =
      type === "straight"
        ? 0
        : type;

    criarNumerosRoleta();
    atualizarSelecaoRoleta();
  };

  $("rouletteSpinButton").onclick =
    girarRoleta;
}

function definirRouletteBet(v) {
  const min =
    Math.max(
      0.01,
      numero(configuracaoAtual?.minBet,1)
    );

  const max =
    Math.max(
      min,
      numero(configuracaoAtual?.maxBet,1000)
    );

  rouletteBet =
    Math.min(
      max,
      Math.max(
        min,
        numero(v,min)
      )
    );

  $("rouletteBetValue").textContent =
    moeda(rouletteBet);
}

function criarNumerosRoleta() {
  const type =
    $("rouletteBetType").value;

  const box =
    $("rouletteNumberGrid");

  if (type !== "straight") {
    box.innerHTML = "";

    $("rouletteSelectionLabel").textContent =
      "Aposta selecionada";

    return;
  }

  $("rouletteSelectionLabel").textContent =
    "Escolha o número";

  box.innerHTML =
    Array.from({length:37},(_,n)=>{
      const color =
        n === 0
          ? "green"
          : vermelho(n)
            ? "red"
            : "";

      return `
        <button
          type="button"
          class="roulette-number ${color}"
          data-number="${n}"
        >
          ${n}
        </button>
      `;
    }).join("");

  box
    .querySelectorAll("[data-number]")
    .forEach(b=>{
      b.onclick=()=>{
        rouletteSelected =
          Number(b.dataset.number);

        atualizarSelecaoRoleta();
      };
    });
}

function atualizarSelecaoRoleta() {
  document
    .querySelectorAll(".roulette-number")
    .forEach(b=>{
      b.classList.toggle(
        "selected",
        Number(b.dataset.number) ===
        Number(rouletteSelected)
      );
    });
}

function vermelho(n) {
  return [
    1,3,5,7,9,
    12,14,16,18,
    19,21,23,25,27,
    30,32,34,36
  ].includes(Number(n));
}

async function girarSlot() {
  if (slotSpinning) return;

  const userId =
    obterIdUsuario();

  if (!userId) {
    return mostrarToast(
      "Faça login novamente."
    );
  }

  const bet =
    numero(slotBet);

  if (!(bet > 0)) {
    return mostrarToast(
      "Informe uma aposta válida."
    );
  }

  if (
    bet < numero(configuracaoAtual?.minBet,1) ||
    bet > numero(configuracaoAtual?.maxBet,1000)
  ) {
    return mostrarToast(
      "Aposta fora dos limites."
    );
  }

  slotSpinning = true;

  const btn =
    $("slotSpinButton");

  const cabinet =
    $("slotCabinet");

  btn.disabled = true;

  cabinet.classList.add(
    "spinning"
  );

  $("slotStatus").textContent =
    "Girando...";

  const strips =
    [...document.querySelectorAll(".reel-strip")];

  document
    .querySelectorAll(".reel")
    .forEach(r =>
      r.classList.add("spinning")
    );

  try {
    const resposta =
      await fetch(
        `${API}/games/spin`,
        {
          method:"POST",
          headers:headersJSON(),
          body:JSON.stringify({
            userId,
            gameId:configuracaoAtual.id,
            bet
          })
        }
      );

    const data =
      await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        data.message ||
        "Não foi possível girar."
      );
    }

    const resultado =
      data.result ||
      data.spin ||
      data;

    const symbols =
      extrairSimbolosResultado(
        resultado
      );

    await animarResultadoSlot(
      strips,
      symbols
    );

    const win =
      numero(
        resultado.win ??
        resultado.won ??
        resultado.payout ??
        data.win,
        0
      );

    atualizarSaldos(
      data.saldoDepois ??
      data.balance ??
      data.user?.balance ??
      0
    );

    $("screenWin").textContent =
      moeda(win);

    $("winDisplay").textContent =
      moeda(win);

    if (win > 0) {
      cabinet.classList.add("win");

      $("slotStatus").textContent =
        `Você ganhou ${moeda(win)}!`;
    } else {
      $("slotStatus").textContent =
        "Boa sorte no próximo giro!";
    }

  } catch(e) {
    $("slotStatus").textContent =
      "Boa sorte!";

    mostrarToast(
      e.message ||
      "Erro ao girar."
    );

  } finally {
    setTimeout(()=>{
      document
        .querySelectorAll(".reel")
        .forEach(r =>
          r.classList.remove("spinning")
        );

      cabinet.classList.remove(
        "spinning",
        "win"
      );

      btn.disabled = false;
      slotSpinning = false;

    },700);
  }
}

function extrairSimbolosResultado(resultado) {
  let raw =
    resultado?.symbols ||
    resultado?.reels ||
    resultado?.result ||
    resultado?.outcome;

  if (Array.isArray(raw)) {

    if (
      raw.length >= 3 &&
      Array.isArray(raw[0])
    ) {
      return raw.map(
        x => x[1] ?? x[0]
      );
    }

    return raw
      .slice(0,3)
      .map(
        x =>
          typeof x === "object"
            ? (
                x.symbol ??
                x.value ??
                x.label
              )
            : x
      );
  }

  return [
    randomSlotSymbol(),
    randomSlotSymbol(),
    randomSlotSymbol()
  ];
}

function randomSlotSymbol() {
  const symbols =
    SLOT_SYMBOLS[
      configuracaoAtual?.id
    ] ||
    SLOT_SYMBOLS.fortune7;

  return symbols[
    Math.floor(
      Math.random() *
      symbols.length
    )
  ].v;
}

function normalizarSymbol(v) {
  const s =
    String(v ?? "");

  if (
    s === "7" ||
    /seven|7/.test(
      s.toLowerCase()
    )
  ) {
    return "7";
  }

  if (
    /diamond|gem|💎/.test(
      s.toLowerCase()
    )
  ) {
    return "💎";
  }

  if (
    /cherr|🍒/.test(
      s.toLowerCase()
    )
  ) {
    return "🍒";
  }

  if (
    /lemon|🍋/.test(
      s.toLowerCase()
    )
  ) {
    return "🍋";
  }

  if (
    /bell|🔔/.test(
      s.toLowerCase()
    )
  ) {
    return "🔔";
  }

  if (
    /crown|👑|♛/.test(
      s.toLowerCase()
    )
  ) {
    return "👑";
  }

  if (
    /coin|money|💰|🪙/.test(
      s.toLowerCase()
    )
  ) {
    return "🪙";
  }

  if (
    /bar/.test(
      s.toLowerCase()
    )
  ) {
    return "BAR";
  }

  if (
    /star|⭐|✨/.test(
      s.toLowerCase()
    )
  ) {
    return "⭐";
  }

  if (
    /clover|🍀/.test(
      s.toLowerCase()
    )
  ) {
    return "🍀";
  }

  return s ||
    randomSlotSymbol();
}

function animarResultadoSlot(
  strips,
  result
) {
  return new Promise(resolve=>{

    const values =
      result.map(
        normalizarSymbol
      );

    strips.forEach(
      (strip,i)=>{

        strip.innerHTML = "";

        const symbols =
          SLOT_SYMBOLS[
            configuracaoAtual?.id
          ] ||
          SLOT_SYMBOLS.fortune7;

        const pool = [];

        for(
          let k=0;
          k<18+i*3;
          k++
        ) {
          pool.push(
            symbols[
              Math.floor(
                Math.random() *
                symbols.length
              )
            ]
          );
        }

        values.forEach(v =>
          pool.push({v})
        );

        strip.innerHTML =
          pool.map(
            s =>
              `<div class="symbol ${s.cls||""}">${s.v}</div>`
          ).join("");

        const targetIndex =
          pool.length - 1;

        strip.style.transition =
          "none";

        strip.style.transform =
          "translateY(0)";

        requestAnimationFrame(()=>{
          requestAnimationFrame(()=>{

            strip.style.transition =
              `transform ${1500+i*230}ms cubic-bezier(.12,.72,.12,1)`;

            strip.style.transform =
              `translateY(-${targetIndex*75}px)`;

          });
        });
      }
    );

    setTimeout(
      resolve,
      2200
    );
  });
}

async function girarRoleta() {
  if (rouletteSpinning) return;

  const userId =
    obterIdUsuario();

  if (!userId) {
    return mostrarToast(
      "Faça login novamente."
    );
  }

  const betType =
    $("rouletteBetType").value;

  const selection =
    betType === "straight"
      ? rouletteSelected
      : betType;

  rouletteSpinning = true;

  $("rouletteSpinButton").disabled =
    true;

  $("rouletteResult").textContent =
    "A roleta está girando...";

  try {

    const resposta =
      await fetch(
        `${API}/games/roulette/spin`,
        {
          method:"POST",
          headers:headersJSON(),
          body:JSON.stringify({
            userId,
            bet:rouletteBet,
            betType,
            selection
          })
        }
      );

    const data =
      await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        data.message ||
        "Não foi possível girar a roleta."
      );
    }

    const r =
      data.result ||
      data.spin ||
      data;

    const number =
      numero(
        r.number ??
        r.result?.number ??
        r.result,
        0
      );

    const win =
      numero(
        r.win ??
        r.payout ??
        data.saldoDepois,
        0
      );

    const wheel =
      $("rouletteWheel");

    const rotations =
      5 +
      Math.floor(
        Math.random() * 3
      );

    wheel.style.transform =
      `rotate(${rotations*360 + number*9.73}deg)`;

    setTimeout(()=>{

      $("rouletteResult").textContent =
        `Resultado: ${number} • ${
          vermelho(number)
            ? "Vermelho"
            : number === 0
              ? "Verde"
              : "Preto"
        } • ${
          win > 0
            ? "Você ganhou " + moeda(win)
            : "Sem prêmio"
        }`;

      $("winDisplay").textContent =
        moeda(win);

      atualizarSaldos(
        data.saldoDepois ??
        data.balance ??
        data.user?.balance ??
        0
      );

    },3300);

  } catch(e) {

    $("rouletteResult").textContent =
      "Faça sua aposta";

    mostrarToast(
      e.message ||
      "Erro na roleta."
    );

  } finally {

    setTimeout(()=>{

      $("rouletteSpinButton").disabled =
        false;

      rouletteSpinning = false;

    },3400);
  }
}

function voltarLobby() {
  if (
    slotSpinning ||
    rouletteSpinning
  ) {
    return;
  }

  $("gameStage").hidden =
    true;

  $("gamesLobby").hidden =
    false;

  history.replaceState(
    null,
    "",
    "games.html"
  );

  window.scrollTo({
    top:0,
    behavior:"instant"
  });
}

document.addEventListener(
  "DOMContentLoaded",
  ()=>{
    configurarBotoesVoltar();
    prepararBets();
    carregarJogos();
  }
);

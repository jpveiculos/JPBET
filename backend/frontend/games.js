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
    {v:"7", cls:"seven"},
    {v:"🍒"},
    {v:"🍋"},
    {v:"🔔"},
    {v:"BAR"},
    {v:"💎"},
    {v:"⭐"}
  ],

  diamondGold: [
    {v:"💎", cls:"diamond"},
    {v:"👑", cls:"crown"},
    {v:"🪙", cls:"coin"},
    {v:"7", cls:"seven"},
    {v:"💠"},
    {v:"✨"}
  ],

  royalJackpot: [
    {v:"👑", cls:"crown"},
    {v:"💎", cls:"diamond"},
    {v:"7", cls:"seven"},
    {v:"💰", cls:"coin"},
    {v:"♛", cls:"crown"},
    {v:"✨"}
  ],

  lucky7: [
    {v:"7", cls:"seven"},
    {v:"7", cls:"seven"},
    {v:"🍒"},
    {v:"🍀"},
    {v:"BAR"},
    {v:"⭐"},
    {v:"🔔"}
  ]
};


/* =========================================================
   ROLETA - 15 FATIAS
   Sequência:
   2x, X, X, 2x, X, X...
========================================================= */

const ROULETTE_SEGMENTS = [
  {label:"2x", type:"prize", multiplier:2},
  {label:"X", type:"zero", multiplier:0},
  {label:"X", type:"zero", multiplier:0},

  {label:"2x", type:"prize", multiplier:2},
  {label:"X", type:"zero", multiplier:0},
  {label:"X", type:"zero", multiplier:0},

  {label:"2x", type:"prize", multiplier:2},
  {label:"X", type:"zero", multiplier:0},
  {label:"X", type:"zero", multiplier:0},

  {label:"2x", type:"prize", multiplier:2},
  {label:"X", type:"zero", multiplier:0},
  {label:"X", type:"zero", multiplier:0},

  {label:"2x", type:"prize", multiplier:2},
  {label:"X", type:"zero", multiplier:0},
  {label:"X", type:"zero", multiplier:0}
];


/* =========================================================
   VISUAL DA ROLETA
   15 FATIAS
========================================================= */

const ROULETTE_VISUAL_SEGMENTS = [
  {label:"2X", type:"prize", multiplier:2},
  {label:"X", type:"zero", multiplier:0},
  {label:"X", type:"zero", multiplier:0},

  {label:"2X", type:"prize", multiplier:2},
  {label:"X", type:"zero", multiplier:0},
  {label:"X", type:"zero", multiplier:0},

  {label:"2X", type:"prize", multiplier:2},
  {label:"X", type:"zero", multiplier:0},
  {label:"X", type:"zero", multiplier:0},

  {label:"2X", type:"prize", multiplier:2},
  {label:"X", type:"zero", multiplier:0},
  {label:"X", type:"zero", multiplier:0},

  {label:"2X", type:"prize", multiplier:2},
  {label:"X", type:"zero", multiplier:0},
  {label:"X", type:"zero", multiplier:0}
];


const THEMES = {
  fortune7: {
    title:"FORTUNE 7",
    type:"SLOT",
    accent:"#d51f3d"
  },

  diamondGold: {
    title:"DIAMOND GOLD",
    type:"SLOT",
    accent:"#178fca"
  },

  royalJackpot: {
    title:"ROYAL JACKPOT",
    type:"SLOT",
    accent:"#9a55d8"
  },

  lucky7: {
    title:"LUCKY 7",
    type:"SLOT",
    accent:"#e3a51b"
  }
};


const $ = id => document.getElementById(id);


/* =========================================================
   USUÁRIO / SESSÃO
========================================================= */

function usuarioAtual() {
  try {
    return JSON.parse(
      localStorage.getItem("jpbet_user") || "null"
    );
  } catch (_) {
    return null;
  }
}


function tokenAtual() {
  return localStorage.getItem("jpbet_token") || "";
}


function headersJSON() {
  const h = {
    "Content-Type":"application/json"
  };

  if (tokenAtual()) {
    h.Authorization = `Bearer ${tokenAtual()}`;
  }

  return h;
}


/* =========================================================
   UTILITÁRIOS
========================================================= */

function moeda(v) {
  return Number(v || 0).toLocaleString(
    "pt-BR",
    {
      style:"currency",
      currency:"BRL"
    }
  );
}


function numero(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}


function obterIdUsuario() {
  const u = usuarioAtual();
  return u?.id ?? u?.userId ?? null;
}


function mostrarToast(msg) {
  const el = $("toast");

  if (!el) return;

  el.textContent = msg;
  el.classList.add("show");

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 2600);
}


function atualizarSaldos(v) {
  const valor = numero(v);

  const balance = $("balance");
  const stageBalance = $("stageBalance");

  if (balance) {
    balance.textContent = valor.toLocaleString(
      "pt-BR",
      {
        minimumFractionDigits:2,
        maximumFractionDigits:2
      }
    );
  }

  if (stageBalance) {
    stageBalance.textContent = valor.toLocaleString(
      "pt-BR",
      {
        minimumFractionDigits:2,
        maximumFractionDigits:2
      }
    );
  }
}


/* =========================================================
   NAVEGAÇÃO
========================================================= */

function configurarBotoesVoltar() {
  const backButton = $("backButton");
  const stageBack = $("stageBack");

  if (backButton) {
    backButton.onclick = () => {
      window.location.href = "dashboard.html";
    };
  }

  if (stageBack) {
    stageBack.onclick = voltarLobby;
  }
}


/* =========================================================
   CARREGAR JOGOS
========================================================= */

async function carregarJogos() {
  try {
    const resposta = await fetch(
      `${API}/games`,
      {
        headers:headersJSON()
      }
    );

    const data = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        data.message ||
        "Não foi possível carregar os jogos."
      );
    }

    jogos = Array.isArray(data.games)
      ? data.games
      : [];

    renderizarJogos();

    const id =
      new URLSearchParams(location.search)
        .get("game");

    if (id) {
      const jogo = jogos.find(
        j => String(j.id) === String(id)
      );

      if (jogo) {
        await abrirJogo(jogo.id);
      }
    }

  } catch (e) {
    const message = $("gamesMessage");

    if (message) {
      message.textContent =
        e.message ||
        "Erro ao carregar jogos.";
    }
  }
}


/* =========================================================
   ÍCONE DOS JOGOS
========================================================= */

function iconeJogo(jogo) {
  if (
    jogo.type === "roulette" ||
    jogo.id === "roulette"
  ) {
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


/* =========================================================
   LOBBY
========================================================= */

function renderizarJogos() {
  const box = $("gamesContainer");
  const message = $("gamesMessage");

  if (!box) return;

  if (message) {
    message.style.display =
      jogos.length ? "none" : "block";
  }

  box.innerHTML = jogos.map(jogo => `
    <article class="lobby-card">
      <div class="lobby-icon">
        ${iconeJogo(jogo)}
      </div>

      <h3>
        ${jogo.name || jogo.id}
      </h3>

      <p>
        ${jogo.description ||
          "Escolha este jogo para jogar."}
      </p>

      <button
        class="lobby-play"
        type="button"
        data-game="${String(jogo.id)}"
      >
        JOGAR
      </button>
    </article>
  `).join("");

  box
    .querySelectorAll("[data-game]")
    .forEach(btn => {
      btn.onclick = () =>
        abrirJogo(btn.dataset.game);
    });
}


/* =========================================================
   ABRIR JOGO
========================================================= */

async function abrirJogo(gameId) {
  try {
    const resposta = await fetch(
      `${API}/games/${encodeURIComponent(gameId)}`,
      {
        headers:headersJSON()
      }
    );

    const data = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        data.message ||
        "Não foi possível abrir o jogo."
      );
    }

    configuracaoAtual =
      data.game || data;

    jogoAtual =
      configuracaoAtual;

    $("gamesLobby").hidden = true;
    $("gameStage").hidden = false;

    $("gameTitle").textContent =
      configuracaoAtual.name ||
      gameId;

    if (
      (configuracaoAtual.type || "")
        .toLowerCase() === "roulette" ||
      gameId === "roulette"
    ) {
      abrirInterfaceRoleta(
        configuracaoAtual
      );
    } else {
      abrirInterfaceSlot(
        configuracaoAtual
      );
    }

    window.scrollTo({
      top:0,
      behavior:"instant"
    });

  } catch (e) {
    mostrarToast(
      e.message ||
      "Erro ao abrir jogo."
    );
  }
}


/* =========================================================
   SLOT
========================================================= */

function abrirInterfaceSlot(config) {
  $("gameTypeLabel").textContent =
    "SLOT";

  $("slotPanel").hidden = false;
  $("roulettePanel").hidden = true;

  const theme =
    THEMES[config.id] ||
    THEMES.fortune7;

  $("marqueeTitle").textContent =
    (
      config.name ||
      theme.title
    ).toUpperCase();

  document.documentElement.style
    .setProperty(
      "--slot1",
      theme.accent
    );

  $("slotBetValue").textContent =
    moeda(slotBet);

  $("slotStatus").textContent =
    "Boa sorte!";

  $("winDisplay").textContent =
    "R$ 0,00";

  $("screenWin").textContent =
    "R$ 0,00";

  criarReels(config.id);
}


/* =========================================================
   ROLETA
========================================================= */

function abrirInterfaceRoleta(config) {
  $("gameTypeLabel").textContent =
    "RODA DA SORTE";

  $("slotPanel").hidden = true;
  $("roulettePanel").hidden = false;

  $("winDisplay").textContent =
    "R$ 0,00";

  rouletteBet =
    Math.max(
      0.5,
      numero(config.minBet,0.5)
    );

  $("rouletteBetValue").textContent =
    moeda(rouletteBet);

  criarRoletaSorte();

  atualizarGiroGratis();
}


/* =========================================================
   CRIAR ROLETA VISUAL
========================================================= */

function criarRoletaSorte() {
  const wheel = $("rouletteWheel");

  if (!wheel) return;

  const quantidade =
    ROULETTE_VISUAL_SEGMENTS.length;

  const angle =
    360 / quantidade;

  /*
    DOURADO / PRETO / DOURADO / PRETO...
  */

  const colors =
    ROULETTE_VISUAL_SEGMENTS.map(
      (_, i) =>
        i % 2 === 0
          ? "#D4AF37"
          : "#111111"
    );

  wheel.innerHTML = "";

  ROULETTE_VISUAL_SEGMENTS.forEach(
    (seg, i) => {

      const d =
        document.createElement("span");

      d.className =
        `roulette-label ${
          seg.type === "zero"
            ? "zero"
            : "prize"
        }`;

      d.textContent =
        seg.label;

      const mid =
        i * angle +
        angle / 2;

      const radius =
        Math.min(
          43,
          Math.max(
            36,
            (wheel.clientWidth || 300) *
              0.14
          )
        );

      d.style.transform =
        `translate(-50%,-50%)
         rotate(${mid}deg)
         translateY(-${radius}%)
         rotate(${-mid}deg)`;

      d.dataset.index = i;

      wheel.appendChild(d);
    }
  );

  /*
    Divide visualmente a roda em 15 partes.
  */

  const faixas =
    colors.map(
      (color, i) =>
        `${color} ${i * angle}deg ${(i + 1) * angle}deg`
    );

  wheel.style.background =
    `
      repeating-conic-gradient(
        from -${angle / 2}deg,
        transparent 0deg ${angle - 1}deg,
        rgba(255,221,105,.85)
          ${angle - 1}deg ${angle}deg
      ),
      conic-gradient(
        from -${angle / 2}deg,
        ${faixas.join(",")}
      )
    `;
}


/* =========================================================
   GIROS GRÁTIS
========================================================= */

function atualizarGiroGratis() {
  const u =
    usuarioAtual() || {};

  const qtd =
    numero(
      u.rouletteFreeSpins,
      0
    );

  const aposta =
    numero(
      u.rouletteFreeSpinBet,
      0
    );

  const box =
    $("rouletteFreeSpinStatus");

  const btn =
    $("rouletteSpinButton");

  if (!box || !btn) return;

  if (
    qtd > 0 &&
    aposta > 0
  ) {
    box.hidden = false;

    box.textContent =
      `🍀 ${qtd} giro${
        qtd === 1 ? "" : "s"
      } grátis disponível${
        qtd === 1 ? "" : "eis"
      } — aposta ${moeda(aposta)}`;

    btn.textContent =
      "USAR GIRO GRÁTIS";

  } else {

    box.hidden = true;
    box.textContent = "";

    btn.textContent =
      "GIRAR ROLETA";
  }
}


/* =========================================================
   REELS
========================================================= */

function criarReels(gameId) {
  const symbols =
    SLOT_SYMBOLS[gameId] ||
    SLOT_SYMBOLS.fortune7;

  for (let i = 0; i < 3; i++) {

    const reel =
      $(`reel${i}`);

    if (!reel) continue;

    reel.innerHTML =
      `<div class="reel-strip">
        ${
          Array.from(
            {length:9},
            (_,k) => {

              const s =
                symbols[
                  (k+i) %
                  symbols.length
                ];

              return `
                <div class="symbol ${
                  s.cls || ""
                }">
                  ${s.v}
                </div>
              `;
            }
          ).join("")
        }
      </div>`;
  }
}


/* =========================================================
   APOSTA SLOT
========================================================= */

function definirSlotBet(v) {
  const min =
    Math.max(
      0.01,
      numero(
        configuracaoAtual?.minBet,
        1
      )
    );

  const max =
    Math.max(
      min,
      numero(
        configuracaoAtual?.maxBet,
        1000
      )
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


/* =========================================================
   BOTÕES
========================================================= */

function prepararBets() {

  $("betMinus").onclick =
    () =>
      definirSlotBet(
        slotBet - 1
      );

  $("betPlus").onclick =
    () =>
      definirSlotBet(
        slotBet + 1
      );

  $("slotQuickBets")
    .querySelectorAll("[data-bet]")
    .forEach(b => {

      b.onclick =
        () =>
          definirSlotBet(
            numero(
              b.dataset.bet,
              1
            )
          );
    });

  $("slotSpinButton").onclick =
    girarSlot;

  $("rouletteBetMinus").onclick =
    () =>
      definirRouletteBet(
        rouletteBet - 0.5
      );

  $("rouletteBetPlus").onclick =
    () =>
      definirRouletteBet(
        rouletteBet + 0.5
      );

  document
    .querySelectorAll(
      "[data-roulette-bet]"
    )
    .forEach(b => {

      b.onclick =
        () =>
          definirRouletteBet(
            numero(
              b.dataset.rouletteBet,
              0.5
            )
          );
    });

  $("rouletteSpinButton").onclick =
    girarRoleta;

  const hub =
    $("rouletteHubButton");

  if (hub) {
    hub.onclick =
      girarRoleta;
  }
}


/* =========================================================
   APOSTA ROLETA
========================================================= */

function definirRouletteBet(v) {

  const min =
    Math.max(
      0.5,
      numero(
        configuracaoAtual?.minBet,
        0.5
      )
    );

  const max =
    Math.max(
      min,
      numero(
        configuracaoAtual?.maxBet,
        100
      )
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


/* =========================================================
   GIRAR SLOT
========================================================= */

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
    bet <
      numero(
        configuracaoAtual?.minBet,
        1
      ) ||
    bet >
      numero(
        configuracaoAtual?.maxBet,
        1000
      )
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
    [
      ...document.querySelectorAll(
        ".reel-strip"
      )
    ];

  document
    .querySelectorAll(".reel")
    .forEach(r =>
      r.classList.add(
        "spinning"
      )
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
            gameId:
              configuracaoAtual.id,
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

      cabinet.classList.add(
        "win"
      );

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

    setTimeout(() => {

      document
        .querySelectorAll(".reel")
        .forEach(r =>
          r.classList.remove(
            "spinning"
          )
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


/* =========================================================
   RESULTADO SLOT
========================================================= */

function extrairSimbolosResultado(
  resultado
) {

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
        x =>
          x[1] ??
          x[0]
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


/* =========================================================
   ANIMAÇÃO SLOT
========================================================= */

function animarResultadoSlot(
  strips,
  result
) {

  return new Promise(resolve => {

    const values =
      result.map(
        normalizarSymbol
      );

    strips.forEach(
      (strip,i) => {

        strip.innerHTML = "";

        const symbols =
          SLOT_SYMBOLS[
            configuracaoAtual?.id
          ] ||
          SLOT_SYMBOLS.fortune7;

        const pool = [];

        for (
          let k = 0;
          k < 18 + i * 3;
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
              `<div class="symbol ${
                s.cls || ""
              }">${s.v}</div>`
          ).join("");

        const targetIndex =
          pool.length - 1;

        strip.style.transition =
          "none";

        strip.style.transform =
          "translateY(0)";

        requestAnimationFrame(() => {

          requestAnimationFrame(() => {

            strip.style.transition =
              `transform ${
                1500 + i * 230
              }ms cubic-bezier(.12,.72,.12,1)`;

            strip.style.transform =
              `translateY(-${
                targetIndex * 75
              }px)`;
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


/* =========================================================
   GIRAR ROLETA
========================================================= */

async function girarRoleta() {

  if (rouletteSpinning) return;

  const userId =
    obterIdUsuario();

  if (!userId) {
    return mostrarToast(
      "Faça login novamente."
    );
  }

  const u =
    usuarioAtual() || {};

  const hasFree =
    numero(
      u.rouletteFreeSpins,
      0
    ) > 0 &&
    numero(
      u.rouletteFreeSpinBet,
      0
    ) > 0;

  const bet =
    hasFree
      ? numero(
          u.rouletteFreeSpinBet,
          0
        )
      : numero(
          rouletteBet,
          0.5
        );

  const min =
    Math.max(
      0.5,
      numero(
        configuracaoAtual?.minBet,
        0.5
      )
    );

  const max =
    Math.min(
      100,
      Math.max(
        min,
        numero(
          configuracaoAtual?.maxBet,
          100
        )
      )
    );

  if (
    !hasFree &&
    (
      bet < min ||
      bet > max
    )
  ) {
    return mostrarToast(
      "Aposta fora dos limites."
    );
  }

  if (
    !hasFree &&
    bet > numero(u.balance,0)
  ) {
    return mostrarToast(
      "Saldo insuficiente."
    );
  }

  rouletteSpinning = true;

  const btn =
    $("rouletteSpinButton");

  btn.disabled = true;
  btn.textContent =
    "GIRANDO...";

  try {

    const resposta =
      await fetch(
        `${API}/roulette/spin`,
        {
          method:"POST",
          headers:headersJSON(),
          body:JSON.stringify({
            userId,
            betAmount:bet,
            betType:"roulette",
            rouletteId:"sorte",
            freeSpin:hasFree
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

    const r =
      data.spin ||
      data.result ||
      data;

    const index =
      numero(
        r.index,
        -1
      );

    /*
      A roleta agora possui exatamente
      15 posições: 0 até 14.
    */

    if (
      index < 0 ||
      index >=
        ROULETTE_VISUAL_SEGMENTS.length
    ) {
      throw new Error(
        "Resultado inválido."
      );
    }

    const wheel =
      $("rouletteWheel");

    /*
      O índice do servidor é exatamente
      o índice visual.

      Não fazemos mais procura por
      multiplicador, porque existem
      várias fatias X e várias 2X.
    */

    const visualIndex =
      index;

    const angle =
      360 /
      ROULETTE_VISUAL_SEGMENTS.length;

    /*
      Centraliza a fatia escolhida
      no ponteiro superior.
    */

    const target =
      360 -
      (
        visualIndex * angle +
        angle / 2
      );

    const rotations =
      7 +
      Math.floor(
        Math.random() * 3
      );

    const animationMs =
      numero(
        configuracaoAtual?.animationMs,
        4800
      );

    wheel.style.transition =
      `transform ${animationMs}ms cubic-bezier(.12,.72,.12,1)`;

    wheel.style.transform =
      `rotate(${
        rotations * 360 +
        target
      }deg)`;

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          animationMs + 100
        )
    );

    /*
      O resultado visual também usa
      exatamente o mesmo índice.
    */

    const seg =
      ROULETTE_SEGMENTS[index];

    const prize =
      numero(
        r.prize,
        0
      );

    if (data.user) {

      atualizarSaldos(
        data.user.balance
      );

      localStorage.setItem(
        "jpbet_user",
        JSON.stringify({
          ...u,
          ...data.user
        })
      );
    }

    $("winDisplay").textContent =
      moeda(prize);

    if (prize > 0) {

      $("rouletteResult").textContent =
        `🎉 ${seg.label} — Prêmio ${moeda(prize)}${
          hasFree
            ? " (giro grátis)"
            : ""
        }`;

    } else {

      $("rouletteResult").textContent =
        "❌ PERDEU — Prêmio R$ 0,00";
    }

    /*
      Recria somente os elementos
      visuais, mantendo a posição da roda.
    */

    criarRoletaSorte();

    atualizarGiroGratis();

  } catch(e) {

    $("rouletteResult").textContent =
      "Defina sua aposta e gire.";

    mostrarToast(
      e.message ||
      "Erro ao girar."
    );

  } finally {

    rouletteSpinning =
      false;

    btn.disabled = false;

    atualizarGiroGratis();
  }
}


/* =========================================================
   VOLTAR PARA O LOBBY
========================================================= */

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


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    configurarBotoesVoltar();

    prepararBets();

    carregarJogos();
  }
);

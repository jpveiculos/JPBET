const API = "/api";

let jogos = [];
let jogoAtual = null;
let configuracaoAtual = null;

let slotBet = 1;
let rouletteBet = 0.5;

let rouletteSpinning = false;
let slotSpinning = false;

let rouletteFreeSpins = 0;
let rouletteFreeSpinBet = 0;

const ROULETTE_SEGMENTS = [
  { label: "X",   type: "zero",  multiplier: 0 },
  { label: "2x",  type: "prize", multiplier: 2 },
  { label: "X",   type: "zero",  multiplier: 0 },
  { label: "3x",  type: "prize", multiplier: 3 },
  { label: "X",   type: "zero",  multiplier: 0 },
  { label: "5x",  type: "prize", multiplier: 5 },
  { label: "X",   type: "zero",  multiplier: 0 },
  { label: "🍀",  type: "sorte", multiplier: 0 },
  { label: "X",   type: "zero",  multiplier: 0 },
  { label: "10x", type: "prize", multiplier: 10 },
  { label: "X",   type: "zero",  multiplier: 0 },
  { label: "2x",  type: "prize", multiplier: 2 },
  { label: "X",   type: "zero",  multiplier: 0 },
  { label: "3x",  type: "prize", multiplier: 3 },
  { label: "X",   type: "zero",  multiplier: 0 },
  { label: "2x",  type: "prize", multiplier: 2 }
];

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
    "Content-Type": "application/json"
  };

  if (tokenAtual()) {
    h.Authorization = `Bearer ${tokenAtual()}`;
  }

  return h;
}

function obterIdUsuario() {
  const u = usuarioAtual();

  return u?.id ??
    u?.userId ??
    null;
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

function numero(v, fallback=0) {
  const n = Number(v);

  return Number.isFinite(n)
    ? n
    : fallback;
}

function mostrarToast(msg) {
  const el = $("toast");

  if (!el) return;

  el.textContent = msg;

  el.classList.add("show");

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(
    () => el.classList.remove("show"),
    2600
  );
}


/* =========================================================
   SALDOS
========================================================= */

function atualizarSaldos(v) {
  const valor = numero(v);

  if ($("balance")) {
    $("balance").textContent =
      valor.toLocaleString(
        "pt-BR",
        {
          minimumFractionDigits:2,
          maximumFractionDigits:2
        }
      );
  }

  if ($("stageBalance")) {
    $("stageBalance").textContent =
      valor.toLocaleString(
        "pt-BR",
        {
          minimumFractionDigits:2,
          maximumFractionDigits:2
        }
      );
  }
}


/* =========================================================
   GIROS GRÁTIS
========================================================= */

function atualizarGirosGratis(
  quantidade,
  aposta
) {
  rouletteFreeSpins =
    Math.max(
      0,
      Number(quantidade || 0)
    );

  if (aposta !== undefined) {
    rouletteFreeSpinBet =
      Math.max(
        0,
        Number(aposta || 0)
      );
  }

  const status =
    $("rouletteFreeSpinStatus");

  if (!status) return;

  if (rouletteFreeSpins > 0) {

    status.hidden = false;

    status.innerHTML = `
      🍀 <strong>GIRO GRÁTIS DISPONÍVEL</strong>
      <br>
      <span>
        Aposta preservada:
        ${moeda(rouletteFreeSpinBet)}
      </span>
    `;

  } else {

    status.hidden = true;
    status.innerHTML = "";
  }
}


/* =========================================================
   BOTÕES DE VOLTA
========================================================= */

function configurarBotoesVoltar() {

  $("backButton").onclick =
    () => {
      window.location.href =
        "dashboard.html";
    };

  $("stageBack").onclick =
    voltarLobby;
}


/* =========================================================
   CARREGAR JOGOS
========================================================= */

async function carregarJogos() {

  try {

    const resposta =
      await fetch(
        `${API}/games`,
        {
          headers: headersJSON()
        }
      );

    const data =
      await resposta.json();

    if (!resposta.ok) {

      throw new Error(
        data.message ||
        "Não foi possível carregar os jogos."
      );
    }

    jogos =
      Array.isArray(data.games)
        ? data.games
        : [];

    renderizarJogos();

    const id =
      new URLSearchParams(
        location.search
      ).get("game");

    if (id) {

      const jogo =
        jogos.find(
          j =>
            String(j.id) ===
            String(id)
        );

      if (jogo) {
        await abrirJogo(jogo.id);
      }
    }

  } catch (e) {

    if ($("gamesMessage")) {
      $("gamesMessage").textContent =
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
    jogo.id === "roulette" ||
    jogo.id === "roulettePopular" ||
    jogo.id === "popular"
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

  const box =
    $("gamesContainer");

  if (!box) return;

  $("gamesMessage").style.display =
    jogos.length
      ? "none"
      : "block";

  box.innerHTML =
    jogos.map(
      jogo => `
        <article class="lobby-card">

          <div class="lobby-icon">
            ${iconeJogo(jogo)}
          </div>

          <h3>
            ${jogo.name || jogo.id}
          </h3>

          <p>
            ${
              jogo.description ||
              "Escolha este jogo para jogar."
            }
          </p>

          <button
            class="lobby-play"
            type="button"
            data-game="${String(jogo.id)}"
          >
            JOGAR
          </button>

        </article>
      `
    ).join("");

  box
    .querySelectorAll("[data-game]")
    .forEach(btn => {

      btn.onclick =
        () =>
          abrirJogo(
            btn.dataset.game
          );
    });
}


/* =========================================================
   ABRIR JOGO
========================================================= */

async function abrirJogo(gameId) {

  try {

    const resposta =
      await fetch(
        `${API}/games/${encodeURIComponent(gameId)}`,
        {
          headers: headersJSON()
        }
      );

    const data =
      await resposta.json();

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

    $("gamesLobby").hidden =
      true;

    $("gameStage").hidden =
      false;

    $("gameTitle").textContent =
      configuracaoAtual.name ||
      gameId;

    const tipo =
      String(
        configuracaoAtual.type || ""
      ).toLowerCase();

    const isRoulette =
      tipo === "roulette" ||
      gameId === "roulette" ||
      gameId === "roulettePopular" ||
      gameId === "popular";

    if (isRoulette) {

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
   INTERFACE SLOT
========================================================= */

function abrirInterfaceSlot(config) {

  $("gameTypeLabel").textContent =
    "SLOT";

  $("slotPanel").hidden =
    false;

  $("roulettePanel").hidden =
    true;

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

  criarReels(
    config.id
  );
}


/* =========================================================
   INTERFACE ROLETA POPULAR
========================================================= */

function abrirInterfaceRoleta(config) {

  $("gameTypeLabel").textContent =
    "ROLETA POPULAR";

  $("slotPanel").hidden =
    true;

  $("roulettePanel").hidden =
    false;

  $("winDisplay").textContent =
    "R$ 0,00";

  const min =
    Math.max(
      0.5,
      numero(
        config.minBet,
        0.5
      )
    );

  const max =
    Math.min(
      20,
      Math.max(
        min,
        numero(
          config.maxBet,
          20
        )
      )
    );

  if (
    rouletteBet < min ||
    rouletteBet > max
  ) {
    rouletteBet =
      min;
  }

  $("rouletteBetValue").textContent =
    moeda(rouletteBet);

  criarRoletaVisual();

  const u =
    usuarioAtual();

  atualizarGirosGratis(
    u?.rouletteFreeSpins ??
    u?.roulette_free_spins ??
    0,
    u?.rouletteFreeSpinBet ??
    u?.roulette_free_spin_bet ??
    0
  );
}


/* =========================================================
   SLOTS
========================================================= */

function criarReels(gameId) {

  const symbols =
    SLOT_SYMBOLS[gameId] ||
    SLOT_SYMBOLS.fortune7;

  for (
    let i = 0;
    i < 3;
    i++
  ) {

    const reel =
      $(`reel${i}`);

    if (!reel) continue;

    reel.innerHTML = `
      <div class="reel-strip">
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
                <div class="symbol ${s.cls || ""}">
                  ${s.v}
                </div>
              `;
            }
          ).join("")
        }
      </div>
    `;
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
    Math.min(
      20,
      Math.max(
        min,
        numero(
          configuracaoAtual?.maxBet,
          20
        )
      )
    );

  rouletteBet =
    Math.min(
      max,
      Math.max(
        min,
        numero(
          v,
          min
        )
      )
    );

  $("rouletteBetValue").textContent =
    moeda(rouletteBet);
}


/* =========================================================
   CONFIGURAÇÃO DOS BOTÕES
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
    .querySelectorAll(
      "[data-bet]"
    )
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


  const center =
    $("rouletteCenterButton");

  if (center) {
    center.onclick =
      girarRoleta;
  }


  $("rouletteSpinButton").onclick =
    girarRoleta;
}


/* =========================================================
   ROLETA VISUAL
========================================================= */

function criarRoletaVisual() {

  const wheel =
    $("rouletteWheel");

  if (!wheel) return;

  wheel.innerHTML = "";

  const total =
    ROULETTE_SEGMENTS.length;

  const angle =
    360 / total;

  /*
   * A roda visual é independente
   * da probabilidade matemática.
   *
   * O servidor decide o resultado.
   */

  const cores = {
    zero:"#c9152d",
    prize:"#202633",
    sorte:"#18a957"
  };

  ROULETTE_SEGMENTS.forEach(
    (segmento,index) => {

      const el =
        document.createElement("div");

      el.className =
        "roulette-label";

      el.dataset.index =
        String(index);

      el.dataset.type =
        segmento.type;

      el.dataset.multiplier =
        String(
          segmento.multiplier
        );

      el.textContent =
        segmento.label;

      const center =
        index * angle +
        angle / 2;

      const radius =
        38;

      el.style.position =
        "absolute";

      el.style.left =
        "50%";

      el.style.top =
        "50%";

      el.style.transform =
        `
          translate(-50%, -50%)
          rotate(${center}deg)
          translateY(-${radius}%)
          rotate(-${center}deg)
        `;

      if (
        segmento.type ===
        "zero"
      ) {

        el.style.color =
          "#ffffff";

        el.style.background =
          cores.zero;

      } else if (
        segmento.type ===
        "sorte"
      ) {

        el.style.color =
          "#ffffff";

        el.style.background =
          cores.sorte;

      } else {

        if (
          segmento.multiplier === 2
        ) {
          el.style.background =
            "#d7a51d";
        }

        if (
          segmento.multiplier === 3
        ) {
          el.style.background =
            "#8d4fd1";
        }

        if (
          segmento.multiplier === 5
        ) {
          el.style.background =
            "#d6339a";
        }

        if (
          segmento.multiplier === 10
        ) {
          el.style.background =
            "#159ec9";
        }

        el.style.color =
          "#ffffff";
      }

      wheel.appendChild(el);
    }
  );

  /*
   * Define a roda parada na posição inicial.
   */

  wheel.style.transform =
    "rotate(0deg)";
}


/* =========================================================
   ENCONTRAR SETOR DO RESULTADO
========================================================= */

function encontrarIndiceRoleta(spin) {

  if (!spin) {
    return 0;
  }

  const index =
    Number(
      spin.index ??
      spin.segmentIndex
    );

  if (
    Number.isInteger(index) &&
    index >= 0 &&
    index < ROULETTE_SEGMENTS.length
  ) {
    return index;
  }

  const label =
    String(
      spin.result ??
      spin.label ??
      ""
    ).toLowerCase();

  const multiplier =
    Number(
      spin.multiplier ??
      0
    );

  const candidatos =
    ROULETTE_SEGMENTS
      .map(
        (s,index) => ({
          s,
          index
        })
      )
      .filter(
        item => {

          const s =
            item.s;

          if (
            multiplier > 0
          ) {
            return (
              s.type === "prize" &&
              Number(
                s.multiplier
              ) === multiplier
            );
          }

          if (
            label === "🍀" ||
            label.includes("sorte") ||
            label.includes("clover")
          ) {
            return (
              s.type === "sorte"
            );
          }

          return (
            s.type === "zero"
          );
        }
      );

  if (candidatos.length) {

    return candidatos[
      Math.floor(
        Math.random() *
        candidatos.length
      )
    ].index;
  }

  return 0;
}


/* =========================================================
   ANIMAÇÃO ROLETA
========================================================= */

function animarRoleta(
  indiceResultado,
  duracao = 4800
) {

  return new Promise(
    resolve => {

      const wheel =
        $("rouletteWheel");

      if (!wheel) {
        resolve();
        return;
      }

      const total =
        ROULETTE_SEGMENTS.length;

      const angle =
        360 / total;

      /*
       * O ponteiro fica no topo.
       * O centro do setor vencedor
       * precisa parar nessa posição.
       */

      const alvo =
        -(
          indiceResultado *
            angle +
          angle / 2
        );

      const voltas =
        7 +
        Math.floor(
          Math.random() * 3
        );

      const rotacao =
        voltas * 360 +
        alvo;

      wheel.style.transition =
        `transform ${duracao}ms cubic-bezier(.12,.72,.12,1)`;

      requestAnimationFrame(
        () => {

          requestAnimationFrame(
            () => {

              wheel.style.transform =
                `rotate(${rotacao}deg)`;

            }
          );
        }
      );

      setTimeout(
        resolve,
        duracao + 100
      );
    }
  );
}


/* =========================================================
   DESTACAR RESULTADO
========================================================= */

async function destacarResultadoRoleta(
  index
) {

  const elemento =
    document.querySelector(
      `.roulette-label[data-index="${index}"]`
    );

  if (!elemento) return;

  elemento.classList.add(
    "winner"
  );

  elemento.style.animation =
    "rouletteWinnerFlash .22s ease-in-out infinite alternate";

  elemento.style.filter =
    "brightness(2.2)";

  elemento.style.textShadow =
    "0 0 10px #fff, 0 0 20px #ffd700, 0 0 40px #ffd700";

  await new Promise(
    resolve =>
      setTimeout(
        resolve,
        1800
      )
  );

  elemento.classList.remove(
    "winner"
  );

  elemento.style.animation =
    "";

  elemento.style.filter =
    "";

  elemento.style.textShadow =
    "";
}


/* =========================================================
   ROLETA POPULAR
========================================================= */

async function girarRoleta() {

  if (rouletteSpinning) {
    return;
  }

  const userId =
    obterIdUsuario();

  if (!userId) {

    mostrarToast(
      "Faça login novamente."
    );

    return;
  }

  /*
   * Se houver giro grátis,
   * usamos o valor preservado.
   *
   * O usuário não precisa pagar.
   */

  const usandoGiroGratis =
    rouletteFreeSpins > 0;

  let bet =
    usandoGiroGratis
      ? rouletteFreeSpinBet
      : rouletteBet;

  if (
    !(bet > 0)
  ) {

    mostrarToast(
      "Informe uma aposta válida."
    );

    return;
  }

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
      20,
      Math.max(
        min,
        numero(
          configuracaoAtual?.maxBet,
          20
        )
      )
    );

  if (
    bet < min ||
    bet > max
  ) {

    mostrarToast(
      "Aposta fora dos limites."
    );

    return;
  }

  rouletteSpinning =
    true;

  const spinButton =
    $("rouletteSpinButton");

  const centerButton =
    $("rouletteCenterButton");

  if (spinButton) {
    spinButton.disabled =
      true;

    spinButton.classList.add(
      "spinning"
    );

    spinButton.textContent =
      "GIRANDO...";
  }

  if (centerButton) {
    centerButton.disabled =
      true;

    centerButton.classList.add(
      "spinning"
    );
  }

  $("rouletteResult").textContent =
    usandoGiroGratis
      ? "🍀 Giro grátis em andamento..."
      : "A roleta está girando...";

  try {

    /*
     * IMPORTANTE:
     *
     * O frontend NÃO sorteia.
     *
     * O servidor decide o resultado.
     */

    const resposta =
      await fetch(
        `${API}/roulette/spin`,
        {
          method:"POST",

          headers:
            headersJSON(),

          body:
            JSON.stringify({
              userId,

              betAmount:
                bet,

              betType:
                "roulette",

              rouletteId:
                "popular",

              freeSpin:
                usandoGiroGratis
            })
        }
      );

    const data =
      await resposta.json();

    if (!resposta.ok) {

      throw new Error(
        data.message ||
        data.error ||
        "Não foi possível girar a roleta."
      );
    }

    const spin =
      data.spin ||
      data.result ||
      data;

    /*
     * O índice vem do servidor.
     */

    const indiceResultado =
      encontrarIndiceRoleta(
        spin
      );

    const duracao =
      numero(
        configuracaoAtual?.animationMs ??
        configuracaoAtual?.rouletteAnimationMs,
        4800
      );

    await animarRoleta(
      indiceResultado,
      duracao
    );

    await destacarResultadoRoleta(
      indiceResultado
    );

    const segmento =
      ROULETTE_SEGMENTS[
        indiceResultado
      ];

    const resultadoLabel =
      String(
        spin.result ??
        spin.label ??
        segmento.label
      );

    const multiplier =
      numero(
        spin.multiplier ??
        segmento.multiplier,
        0
      );

    const premio =
      numero(
        spin.prize ??
        spin.win ??
        spin.payout,
        0
      );

    const ganhou =
      spin.won === true ||
      spin.won === "true" ||
      premio > 0;

    const replay =
      spin.replay === true ||
      spin.replay === "true" ||
      spin.sorte === true ||
      spin.sorte === "true";

    /*
     * Atualiza saldo retornado
     * pelo servidor.
     */

    const saldo =
      data.user?.balance ??
      data.saldoDepois ??
      data.balance ??
      null;

    if (saldo !== null) {
      atualizarSaldos(
        saldo
      );
    }

    /*
     * Atualiza giros grátis.
     */

    const novosGiros =
      data.user?.rouletteFreeSpins ??
      spin.freeSpinsAvailable ??
      0;

    const novaApostaGratis =
      data.user?.rouletteFreeSpinBet ??
      (replay
        ? bet
        : rouletteFreeSpinBet);

    atualizarGirosGratis(
      novosGiros,
      novaApostaGratis
    );

    /*
     * Exibe prêmio.
     */

    $("winDisplay").textContent =
      moeda(premio);

    if (
      resultadoLabel === "🍀" ||
      segmento.type === "sorte"
    ) {

      $("rouletteResult").innerHTML =
        `
          <strong>🍀 GIRO GRÁTIS!</strong>
          <br>
          <span>
            Você ganhou um novo giro
            de ${moeda(bet)}.
          </span>
        `;

    } else if (
      ganhou &&
      multiplier > 0
    ) {

      $("rouletteResult").innerHTML =
        `
          <strong>🎉 ${resultadoLabel}</strong>
          <br>
          <span>
            ${multiplier}x —
            Você ganhou ${moeda(premio)}
          </span>
        `;

    } else {

      $("rouletteResult").innerHTML =
        `
          <strong>${resultadoLabel}</strong>
          <br>
          <span>
            Sem prêmio neste giro.
          </span>
        `;
    }

  } catch (e) {

    $("rouletteResult").textContent =
      "Defina sua aposta e gire.";

    mostrarToast(
      e.message ||
      "Erro na roleta."
    );

  } finally {

    setTimeout(
      () => {

        if (spinButton) {

          spinButton.disabled =
            false;

          spinButton.classList.remove(
            "spinning"
          );

          spinButton.textContent =
            "GIRAR";
        }

        if (centerButton) {

          centerButton.disabled =
            false;

          centerButton.classList.remove(
            "spinning"
          );
        }

        rouletteSpinning =
          false;

      },
      300
    );
  }
}


/* =========================================================
   SLOT — GIRAR
========================================================= */

async function girarSlot() {

  if (slotSpinning) {
    return;
  }

  const userId =
    obterIdUsuario();

  if (!userId) {

    mostrarToast(
      "Faça login novamente."
    );

    return;
  }

  const bet =
    numero(slotBet);

  if (!(bet > 0)) {

    mostrarToast(
      "Informe uma aposta válida."
    );

    return;
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

    mostrarToast(
      "Aposta fora dos limites."
    );

    return;
  }

  slotSpinning =
    true;

  const btn =
    $("slotSpinButton");

  const cabinet =
    $("slotCabinet");

  btn.disabled =
    true;

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
    .forEach(
      r =>
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

          body:
            JSON.stringify({
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

    const saldo =
      data.saldoDepois ??
      data.balance ??
      data.user?.balance ??
      0;

    atualizarSaldos(
      saldo
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

    setTimeout(
      () => {

        document
          .querySelectorAll(".reel")
          .forEach(
            r =>
              r.classList.remove(
                "spinning"
              )
          );

        cabinet.classList.remove(
          "spinning",
          "win"
        );

        btn.disabled =
          false;

        slotSpinning =
          false;

      },
      700
    );
  }
}


/* =========================================================
   EXTRAIR RESULTADO DOS SLOTS
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


/* =========================================================
   SÍMBOLO ALEATÓRIO VISUAL
========================================================= */

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


/* =========================================================
   NORMALIZAR SÍMBOLO
========================================================= */

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
   ANIMAÇÃO DOS SLOTS
========================================================= */

function animarResultadoSlot(
  strips,
  result
) {

  return new Promise(
    resolve => {

      const values =
        result.map(
          normalizarSymbol
        );

      strips.forEach(
        (strip,i) => {

          strip.innerHTML =
            "";

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

          values.forEach(
            v =>
              pool.push({v})
          );

          strip.innerHTML =
            pool.map(
              s =>
                `
                  <div class="symbol ${s.cls || ""}">
                    ${s.v}
                  </div>
                `
            ).join("");

          const targetIndex =
            pool.length - 1;

          strip.style.transition =
            "none";

          strip.style.transform =
            "translateY(0)";

          requestAnimationFrame(
            () => {

              requestAnimationFrame(
                () => {

                  strip.style.transition =
                    `transform ${1500+i*230}ms cubic-bezier(.12,.72,.12,1)`;

                  strip.style.transform =
                    `translateY(-${targetIndex*75}px)`;
                }
              );
            }
          );
        }
      );

      setTimeout(
        resolve,
        2200
      );
    }
  );
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

const API = "/api";

let jogos = [];
let jogoAtual = null;
let configuracaoAtual = null;
let girando = false;

let rouletteSelectedNumber = 0;

const usuarioSalvo =
  localStorage.getItem("jpbet_user");

let usuario = null;

try {
  usuario = usuarioSalvo
    ? JSON.parse(usuarioSalvo)
    : null;
} catch {
  usuario = null;
}


/* =========================================================
   ELEMENTOS
========================================================= */

const gamesContainer =
  document.getElementById("gamesContainer");

const gamesMessage =
  document.getElementById("gamesMessage");

const gameModal =
  document.getElementById("gameModal");

const gameTitle =
  document.getElementById("gameTitle");

const gameBalance =
  document.getElementById("gameBalance");

const slotMachine =
  document.getElementById("slotMachine");

const slotReels =
  document.getElementById("slotReels");

const rouletteMachine =
  document.getElementById("rouletteMachine");

const rouletteWheel =
  document.getElementById("rouletteWheel");

const rouletteWheelNumbers =
  document.getElementById(
    "rouletteWheelNumbers"
  );

const rouletteResult =
  document.getElementById(
    "rouletteResult"
  );

const rouletteBetType =
  document.getElementById(
    "rouletteBetType"
  );

const rouletteNumberGrid =
  document.getElementById(
    "rouletteNumberGrid"
  );

const rouletteMultiplier =
  document.getElementById(
    "rouletteMultiplier"
  );

const rouletteControls =
  document.getElementById(
    "rouletteControls"
  );

const rouletteBetInput =
  document.getElementById(
    "rouletteBetInput"
  );

const rouletteSpinButton =
  document.getElementById(
    "rouletteSpinButton"
  );

const slotControls =
  document.getElementById(
    "slotControls"
  );

const winMessage =
  document.getElementById("winMessage");

const betInput =
  document.getElementById("betInput");

const minBet =
  document.getElementById("minBet");

const maxBet =
  document.getElementById("maxBet");

const paytable =
  document.getElementById("paytable");

const spinButton =
  document.getElementById("spinButton");

const closeGameButton =
  document.getElementById(
    "closeGameButton"
  );

const backButton =
  document.getElementById(
    "backButton"
  );

const quickBetButtons =
  document.querySelectorAll(
    "[data-bet]"
  );


/* =========================================================
   API
========================================================= */

async function apiFetch(
  endpoint,
  options = {}
) {
  const token =
    localStorage.getItem(
      "jpbet_token"
    );

  const headers = {
    "Content-Type":
      "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  const response =
    await fetch(
      `${API}${endpoint}`,
      {
        ...options,
        headers,
        credentials: "include"
      }
    );

  let data = {};

  try {
    data =
      await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
      "Erro na comunicação com o servidor."
    );
  }

  return data;
}


/* =========================================================
   UTILITÁRIOS
========================================================= */

function numero(
  valor,
  padrao = 0
) {
  const n =
    Number(valor);

  return Number.isFinite(n)
    ? n
    : padrao;
}

function dinheiro(valor) {
  return numero(valor).toFixed(2);
}

function escaparHtml(valor) {
  return String(
    valor ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function atualizarUsuario(
  novoUsuario
) {
  if (!novoUsuario) {
    return;
  }

  usuario = {
    ...usuario,
    ...novoUsuario
  };

  localStorage.setItem(
    "jpbet_user",
    JSON.stringify(usuario)
  );

  atualizarSaldo();
}

function obterSaldo() {
  if (!usuario) {
    return 0;
  }

  if (
    usuario.balance !== undefined &&
    usuario.balance !== null
  ) {
    return numero(
      usuario.balance
    );
  }

  return (
    numero(usuario.bonusBalance) +
    numero(usuario.cashBalance)
  );
}

function atualizarSaldo(
  saldo = null
) {
  if (
    saldo !== null &&
    usuario
  ) {
    usuario.balance =
      numero(saldo);

    localStorage.setItem(
      "jpbet_user",
      JSON.stringify(usuario)
    );
  }

  const valor =
    obterSaldo();

  if (gameBalance) {
    gameBalance.textContent =
      `R$ ${dinheiro(valor)}`;
  }

  const balance =
    document.getElementById(
      "balance"
    );

  if (balance) {
    balance.textContent =
      `R$ ${dinheiro(valor)}`;
  }
}


/* =========================================================
   LOGIN
========================================================= */

function verificarUsuario() {
  if (
    !usuario ||
    !usuario.id
  ) {
    window.location.href =
      "index.html";

    return false;
  }

  atualizarSaldo();

  return true;
}


/* =========================================================
   CARREGAR JOGOS
========================================================= */

async function carregarJogos() {
  if (!gamesContainer) {
    return;
  }

  gamesContainer.innerHTML = "";

  if (gamesMessage) {
    gamesMessage.textContent =
      "Carregando jogos...";
    gamesMessage.hidden = false;
  }

  try {
    const data =
      await apiFetch("/games");

    jogos =
      Array.isArray(data.games)
        ? data.games
        : [];

    renderizarJogos();

    if (gamesMessage) {
      gamesMessage.textContent =
        jogos.length
          ? ""
          : "Nenhum jogo disponível.";

      gamesMessage.hidden =
        Boolean(jogos.length);
    }

    /*
     * IMPORTANTE:
     *
     * Sem ?game=...
     * → permanece na página de seleção.
     *
     * Com ?game=roulette
     * → abre diretamente a roleta.
     *
     * Com ?game=fortune7 etc.
     * → abre diretamente a máquina.
     */
    const params =
      new URLSearchParams(
        window.location.search
      );

    const gameId =
      params.get("game");

    if (gameId) {
      const jogoExiste =
        jogos.some(
          (jogo) =>
            String(jogo.id) ===
            String(gameId)
        );

      if (jogoExiste) {
        await abrirJogo(gameId);
      } else {
        mostrarMensagem(
          "O jogo selecionado não está disponível.",
          "error"
        );
      }
    }

  } catch (error) {
    console.error(
      "Erro ao carregar jogos:",
      error
    );

    if (gamesMessage) {
      gamesMessage.hidden = false;
      gamesMessage.textContent =
        error.message ||
        "Não foi possível carregar os jogos.";
    }
  }
}


/* =========================================================
   RENDERIZAR LISTA
========================================================= */

function renderizarJogos() {
  if (!gamesContainer) {
    return;
  }

  gamesContainer.innerHTML = "";

  jogos
    .filter(
      (jogo) =>
        jogo &&
        jogo.enabled !== false
    )
    .forEach((jogo) => {

      const card =
        document.createElement(
          "button"
        );

      card.type = "button";
      card.className =
        "game-card";

      card.dataset.gameId =
        jogo.id;

      card.innerHTML = `
        <div class="game-card-icon">
          ${obterIconeJogo(jogo.id)}
        </div>

        <div class="game-card-content">
          <h3>
            ${escaparHtml(
              jogo.name ||
              jogo.nome ||
              jogo.id
            )}
          </h3>

          <p>
            ${escaparHtml(
              jogo.description ||
              "Jogue agora."
            )}
          </p>
        </div>

        <div class="game-card-action">
          Jogar
        </div>
      `;

      card.addEventListener(
        "click",
        () =>
          abrirJogo(jogo.id)
      );

      gamesContainer.appendChild(
        card
      );
    });
}


/* =========================================================
   ÍCONES
========================================================= */

function obterIconeJogo(
  gameId
) {
  const icones = {
    roulette: "🎡",
    fortune7: "7️⃣",
    diamondGold: "💎",
    royalJackpot: "👑",
    lucky7: "🍀"
  };

  return (
    icones[gameId] ||
    "🎰"
  );
}


/* =========================================================
   ABRIR JOGO
========================================================= */

async function abrirJogo(
  gameId
) {
  if (girando) {
    return;
  }

  try {
    const data =
      await apiFetch(
        `/games/${encodeURIComponent(
          gameId
        )}`
      );

    jogoAtual =
      data.game ||
      data;

    configuracaoAtual =
      jogoAtual;

    renderizarConfiguracaoJogo();

    if (gameModal) {
      gameModal.hidden = false;

      gameModal.classList.add(
        "active"
      );

      gameModal.setAttribute(
        "aria-hidden",
        "false"
      );

      document.body.classList.add(
        "game-modal-open"
      );
    }
  } catch (error) {
    console.error(
      "Erro ao abrir jogo:",
      error
    );

    mostrarMensagem(
      error.message ||
      "Não foi possível abrir o jogo.",
      "error"
    );
  }
}


/* =========================================================
   CONFIGURAÇÃO
========================================================= */

function renderizarConfiguracaoJogo() {
  if (!configuracaoAtual) {
    return;
  }

  const config =
    configuracaoAtual;

  const ehRoleta =
    config.type === "roulette" ||
    config.id === "roulette";

  if (gameTitle) {
    gameTitle.textContent =
      config.name ||
      config.nome ||
      (ehRoleta
        ? "Roleta Europeia"
        : "Jogo");
  }

  if (ehRoleta) {
    prepararRoleta(config);
  } else {
    prepararSlot(config);
  }

  atualizarSaldo();
}


/* =========================================================
   PREPARAR SLOT
========================================================= */

function prepararSlot(config) {
  if (slotMachine) {
    slotMachine.hidden = false;
  }

  if (slotControls) {
    slotControls.hidden = false;
  }

  if (rouletteMachine) {
    rouletteMachine.hidden = true;
  }

  if (rouletteControls) {
    rouletteControls.hidden = true;
  }

  if (paytable) {
    paytable.closest(
      ".paytable-section"
    )?.removeAttribute("hidden");
  }

  if (minBet) {
    minBet.textContent =
      `R$ ${dinheiro(
        config.minBet ?? 1
      )}`;
  }

  if (maxBet) {
    maxBet.textContent =
      `R$ ${dinheiro(
        config.maxBet ?? 1000
      )}`;
  }

  if (betInput) {
    const minimo =
      numero(config.minBet, 1);

    const maximo =
      numero(
        config.maxBet,
        1000
      );

    betInput.min =
      minimo;

    betInput.max =
      maximo;

    betInput.step =
      "0.01";

    betInput.value =
      Math.min(
        Math.max(
          numero(
            betInput.value,
            minimo
          ),
          minimo
        ),
        maximo
      ).toFixed(2);
  }

  renderizarTabelaPremios();
  renderizarGradeInicial();
}


/* =========================================================
   PREPARAR ROLETA
========================================================= */

function prepararRoleta(config) {
  if (slotMachine) {
    slotMachine.hidden = true;
  }

  if (slotControls) {
    slotControls.hidden = true;
  }

  if (rouletteMachine) {
    rouletteMachine.hidden = false;
  }

  if (rouletteControls) {
    rouletteControls.hidden = false;
  }

  const secaoTabela =
    paytable?.closest(
      ".paytable-section"
    );

  if (secaoTabela) {
    secaoTabela.hidden = true;
  }

  if (minBet) {
    minBet.textContent =
      `R$ ${dinheiro(
        config.minBet ?? 1
      )}`;
  }

  if (maxBet) {
    maxBet.textContent =
      `R$ ${dinheiro(
        config.maxBet ?? 1000
      )}`;
  }

  if (rouletteBetInput) {
    rouletteBetInput.min =
      numero(config.minBet, 1);

    rouletteBetInput.max =
      numero(
        config.maxBet,
        1000
      );

    rouletteBetInput.step =
      "0.01";

    rouletteBetInput.value =
      numero(
        rouletteBetInput.value,
        numero(config.minBet, 1)
      ).toFixed(2);
  }

  rouletteSelectedNumber = 0;

  criarRoletaVisual();
  criarSelecaoNumeros();
  atualizarTipoApostaRoleta();

  if (rouletteResult) {
    rouletteResult.textContent =
      "Faça sua aposta";
  }
}


/* =========================================================
   ROLETA VISUAL
========================================================= */

function corRoleta(numero) {
  if (numero === 0) {
    return "green";
  }

  const vermelhos = new Set([
    1, 3, 5, 7, 9,
    12, 14, 16, 18,
    19, 21, 23, 25,
    27, 30, 32, 34, 36
  ]);

  return vermelhos.has(numero)
    ? "red"
    : "black";
}

function criarRoletaVisual() {
  if (!rouletteWheelNumbers) {
    return;
  }

  rouletteWheelNumbers.innerHTML = "";

  const numeros = [
    0,
    32, 15, 19, 4, 21, 2,
    25, 17, 34, 6, 27, 13,
    36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20,
    14, 31, 9, 22, 18, 29,
    7, 28, 12, 35, 3, 26
  ];

  numeros.forEach(
    (numero, index) => {
      const elemento =
        document.createElement(
          "div"
        );

      elemento.className =
        `roulette-wheel-number ${corRoleta(
          numero
        )}`;

      elemento.textContent =
        numero;

      const angulo =
        index *
        (360 / numeros.length);

      elemento.style.setProperty(
        "--angle",
        `${angulo}deg`
      );

      rouletteWheelNumbers.appendChild(
        elemento
      );
    }
  );
}


/* =========================================================
   NÚMEROS DA ROLETA
========================================================= */

function criarSelecaoNumeros() {
  if (!rouletteNumberGrid) {
    return;
  }

  rouletteNumberGrid.innerHTML = "";

  for (
    let numeroAtual = 0;
    numeroAtual <= 36;
    numeroAtual++
  ) {
    const button =
      document.createElement(
        "button"
      );

    button.type = "button";

    button.className =
      `roulette-number ${corRoleta(
        numeroAtual
      )}`;

    button.textContent =
      numeroAtual;

    button.dataset.number =
      numeroAtual;

    button.addEventListener(
      "click",
      () => {
        rouletteSelectedNumber =
          numeroAtual;

        rouletteNumberGrid
          .querySelectorAll(
            ".selected"
          )
          .forEach(
            (item) =>
              item.classList.remove(
                "selected"
              )
          );

        button.classList.add(
          "selected"
        );

        if (
          rouletteBetType?.value ===
          "straight"
        ) {
          atualizarTipoApostaRoleta();
        }
      }
    );

    if (numeroAtual === 0) {
      button.classList.add(
        "selected"
      );
    }

    rouletteNumberGrid.appendChild(
      button
    );
  }
}


/* =========================================================
   TIPO DE APOSTA
========================================================= */

function obterSelecaoRoleta() {
  const tipo =
    rouletteBetType?.value ||
    "straight";

  if (tipo === "straight") {
    return String(
      rouletteSelectedNumber
    );
  }

  return tipo;
}

function obterMultiplicadorRoleta() {
  const tipo =
    rouletteBetType?.value ||
    "straight";

  const payouts =
    configuracaoAtual?.payouts ||
    {};

  return numero(
    payouts[tipo],
    tipo === "straight"
      ? 35
      : (
        tipo === "dozen1" ||
        tipo === "dozen2" ||
        tipo === "dozen3" ||
        tipo === "column1" ||
        tipo === "column2" ||
        tipo === "column3"
          ? 2
          : 1
      )
  );
}

function atualizarTipoApostaRoleta() {
  const tipo =
    rouletteBetType?.value ||
    "straight";

  if (
    rouletteMultiplier
  ) {
    rouletteMultiplier.textContent =
      `${obterMultiplicadorRoleta()}x`;
  }

  const area =
    document.getElementById(
      "rouletteSelectionArea"
    );

  if (area) {
    area.style.display =
      tipo === "straight"
        ? ""
        : "none";
  }
}


/* =========================================================
   ROLETA - GIRO
========================================================= */

async function girarRoleta() {
  if (girando) {
    return;
  }

  if (!verificarUsuario()) {
    return;
  }

  if (
    !configuracaoAtual ||
    configuracaoAtual.id !==
      "roulette"
  ) {
    return;
  }

  const aposta =
    numero(
      rouletteBetInput?.value,
      0
    );

  const minimo =
    numero(
      configuracaoAtual.minBet,
      1
    );

  const maximo =
    numero(
      configuracaoAtual.maxBet,
      1000
    );

  if (
    aposta <= 0 ||
    aposta < minimo ||
    aposta > maximo
  ) {
    mostrarMensagem(
      `A aposta deve estar entre R$ ${dinheiro(
        minimo
      )} e R$ ${dinheiro(maximo)}.`,
      "error"
    );

    return;
  }

  if (
    aposta >
    obterSaldo()
  ) {
    mostrarMensagem(
      "Saldo insuficiente.",
      "error"
    );

    return;
  }

  const betType =
    rouletteBetType?.value ||
    "straight";

  const selection =
    obterSelecaoRoleta();

  girando = true;

  bloquearControlesRoleta(
    true
  );

  limparMensagem();

  try {
    const resultado =
      await apiFetch(
        "/games/roulette/spin",
        {
          method: "POST",

          body:
            JSON.stringify({
              userId:
                usuario.id,

              bet:
                Number(
                  aposta.toFixed(2)
                ),

              betType,

              selection
            })
        }
      );

    if (resultado.user) {
      atualizarUsuario(
        resultado.user
      );
    } else if (
      resultado.usuario
    ) {
      atualizarUsuario(
        resultado.usuario
      );
    } else if (
      resultado.saldoDepois !==
      undefined
    ) {
      atualizarSaldo(
        resultado.saldoDepois
      );
    } else if (
      resultado.balance !==
      undefined
    ) {
      atualizarSaldo(
        resultado.balance
      );
    }

    const numeroSorteado =
      numero(
        resultado.number ??
        resultado.result?.number,
        0
      );

    animarRoleta(
      numeroSorteado
    );

    setTimeout(
      () => {
        mostrarResultadoRoleta(
          resultado
        );
      },
      900
    );

  } catch (error) {
    console.error(
      "Erro ao girar roleta:",
      error
    );

    mostrarMensagem(
      error.message ||
      "Não foi possível realizar o giro.",
      "error"
    );
  } finally {
    setTimeout(
      () => {
        girando = false;

        bloquearControlesRoleta(
          false
        );
      },
      950
    );
  }
}


/* =========================================================
   ANIMAÇÃO ROLETA
========================================================= */

function animarRoleta(
  numeroSorteado
) {
  if (!rouletteWheel) {
    return;
  }

  rouletteWheel.classList.remove(
    "roulette-spinning"
  );

  void rouletteWheel.offsetWidth;

  rouletteWheel.classList.add(
    "roulette-spinning"
  );

  if (rouletteResult) {
    rouletteResult.textContent =
      "A roleta está girando...";
  }

  setTimeout(
    () => {
      if (rouletteResult) {
        rouletteResult.textContent =
          `Resultado: ${numeroSorteado}`;
      }
    },
    900
  );
}


/* =========================================================
   RESULTADO ROLETA
========================================================= */

function mostrarResultadoRoleta(
  resultado
) {
  const win =
    numero(
      resultado.win ??
      resultado.premio ??
      resultado.result?.win,
      0
    );

  const numeroSorteado =
    numero(
      resultado.number ??
      resultado.result?.number,
      0
    );

  const cor =
    resultado.color ||
    resultado.result?.color ||
    corRoleta(numeroSorteado);

  if (rouletteResult) {
    rouletteResult.textContent =
      `🎯 ${numeroSorteado} • ${cor}`;
  }

  if (win > 0) {
    mostrarMensagem(
      `🎉 Você ganhou R$ ${dinheiro(
        win
      )}!`,
      "win"
    );
  } else {
    mostrarMensagem(
      "Aposta realizada. Boa sorte na próxima!",
      ""
    );
  }
}


/* =========================================================
   CONTROLES ROLETA
========================================================= */

function bloquearControlesRoleta(
  bloqueado
) {
  if (rouletteSpinButton) {
    rouletteSpinButton.disabled =
      bloqueado;

    rouletteSpinButton.textContent =
      bloqueado
        ? "GIRANDO..."
        : "GIRAR ROLETA";
  }

  if (rouletteBetInput) {
    rouletteBetInput.disabled =
      bloqueado;
  }

  document
    .querySelectorAll(
      "[data-roulette-bet]"
    )
    .forEach((button) => {
      button.disabled =
        bloqueado;
    });

  if (rouletteBetType) {
    rouletteBetType.disabled =
      bloqueado;
  }

  document
    .querySelectorAll(
      ".roulette-number"
    )
    .forEach((button) => {
      button.disabled =
        bloqueado;
    });
}


/* =========================================================
   GRADE INICIAL SLOT
========================================================= */

function renderizarGradeInicial() {
  if (!slotReels) {
    return;
  }

  const reels =
    Math.max(
      1,
      Math.floor(
        numero(
          configuracaoAtual?.reels,
          3
        )
      )
    );

  const rows =
    Math.max(
      1,
      Math.floor(
        numero(
          configuracaoAtual?.rows,
          3
        )
      )
    );

  slotReels.style.setProperty(
    "--reels",
    reels
  );

  slotReels.innerHTML =
    "";

  const grade =
    configuracaoAtual?.initialGrid ||
    configuracaoAtual?.grid ||
    null;

  for (
    let reel = 0;
    reel < reels;
    reel++
  ) {
    const coluna =
      document.createElement(
        "div"
      );

    coluna.className =
      "slot-reel";

    for (
      let row = 0;
      row < rows;
      row++
    ) {
      let simbolo = "7";

      if (
        Array.isArray(grade) &&
        Array.isArray(
          grade[reel]
        ) &&
        grade[reel][row]
      ) {
        simbolo =
          grade[reel][row];
      }

      coluna.appendChild(
        criarSimbolo(simbolo)
      );
    }

    slotReels.appendChild(
      coluna
    );
  }
}


/* =========================================================
   CRIAR SÍMBOLO
========================================================= */

function criarSimbolo(
  simbolo
) {
  const elemento =
    document.createElement(
      "div"
    );

  elemento.className =
    "slot-symbol";

  elemento.dataset.symbol =
    String(simbolo ?? "");

  elemento.textContent =
    obterValorSimbolo(
      simbolo
    );

  return elemento;
}

function obterValorSimbolo(
  simbolo
) {
  if (
    simbolo &&
    typeof simbolo === "object"
  ) {
    if (
      simbolo.icon !==
      undefined
    ) {
      return simbolo.icon;
    }

    if (
      simbolo.emoji !==
      undefined
    ) {
      return simbolo.emoji;
    }

    if (
      simbolo.symbol !==
      undefined
    ) {
      return simbolo.symbol;
    }

    if (
      simbolo.name !==
      undefined
    ) {
      return simbolo.name;
    }
  }

  const mapa = {
    seven: "7️⃣",
    "7": "7️⃣",
    diamond: "💎",
    gold: "🪙",
    crown: "👑",
    star: "⭐",
    bell: "🔔",
    cherry: "🍒",
    bar: "BAR",
    wild: "WILD",
    scatter: "⭐",
    lemon: "🍋",
    orange: "🍊"
  };

  return (
    mapa[
      String(
        simbolo
      ).toLowerCase()
    ] ||
    String(
      simbolo ?? "?"
    )
  );
}


/* =========================================================
   TABELA
========================================================= */

function renderizarTabelaPremios() {
  if (!paytable) {
    return;
  }

  paytable.innerHTML = "";

  const simbolos =
    Array.isArray(
      configuracaoAtual?.symbols
    )
      ? configuracaoAtual.symbols
      : [];

  if (!simbolos.length) {
    paytable.innerHTML =
      "<p>Tabela de prêmios não disponível.</p>";

    return;
  }

  const tabela =
    document.createElement(
      "div"
    );

  tabela.className =
    "paytable-list";

  simbolos.forEach(
    (simbolo) => {
      if (
        !simbolo ||
        typeof simbolo !==
          "object"
      ) {
        return;
      }

      const nome =
        simbolo.name ||
        simbolo.id ||
        simbolo.symbol ||
        "?";

      const icone =
        simbolo.icon ||
        simbolo.emoji ||
        simbolo.symbol ||
        nome;

      const payouts =
        simbolo.payouts ||
        simbolo.paytable ||
        {};

      const linha =
        document.createElement(
          "div"
        );

      linha.className =
        "paytable-item";

      linha.innerHTML = `
        <div class="paytable-symbol">
          ${escaparHtml(icone)}
        </div>

        <div class="paytable-name">
          ${escaparHtml(nome)}
        </div>

        <div class="paytable-values">
          ${escaparHtml(
            Object.entries(
              payouts
            )
              .map(
                ([quantidade, multiplicador]) =>
                  `${quantidade}x: ${multiplicador}x`
              )
              .join(" • ") ||
              "Sem prêmio configurado"
          )}
        </div>
      `;

      tabela.appendChild(
        linha
      );
    }
  );

  paytable.appendChild(
    tabela
  );
}


/* =========================================================
   APOSTA SLOT
========================================================= */

function obterAposta() {
  return numero(
    betInput?.value,
    0
  );
}

function validarApostaLocal() {
  if (!configuracaoAtual) {
    return false;
  }

  const aposta =
    obterAposta();

  const minimo =
    numero(
      configuracaoAtual.minBet,
      1
    );

  const maximo =
    numero(
      configuracaoAtual.maxBet,
      1000
    );

  if (
    !Number.isFinite(aposta) ||
    aposta <= 0
  ) {
    mostrarMensagem(
      "Informe uma aposta válida.",
      "error"
    );

    return false;
  }

  if (aposta < minimo) {
    mostrarMensagem(
      `A aposta mínima é R$ ${dinheiro(
        minimo
      )}.`,
      "error"
    );

    return false;
  }

  if (aposta > maximo) {
    mostrarMensagem(
      `A aposta máxima é R$ ${dinheiro(
        maximo
      )}.`,
      "error"
    );

    return false;
  }

  if (aposta > obterSaldo()) {
    mostrarMensagem(
      "Saldo insuficiente.",
      "error"
    );

    return false;
  }

  return true;
}


/* =========================================================
   APOSTAS RÁPIDAS SLOT
========================================================= */

quickBetButtons.forEach(
  (button) => {
    button.addEventListener(
      "click",
      () => {
        if (!betInput) {
          return;
        }

        const valor =
          numero(
            button.dataset.bet,
            0
          );

        const minimo =
          numero(
            configuracaoAtual?.minBet,
            1
          );

        const maximo =
          numero(
            configuracaoAtual?.maxBet,
            1000
          );

        betInput.value =
          Math.min(
            Math.max(
              valor,
              minimo
            ),
            maximo
          ).toFixed(2);
      }
    );
  }
);


/* =========================================================
   GIRO SLOT
========================================================= */

async function girar() {
  if (girando) {
    return;
  }

  if (!verificarUsuario()) {
    return;
  }

  if (
    !configuracaoAtual ||
    configuracaoAtual.type ===
      "roulette"
  ) {
    return;
  }

  if (!validarApostaLocal()) {
    return;
  }

  const aposta =
    Number(
      obterAposta().toFixed(2)
    );

  girando = true;

  bloquearControles(true);

  limparMensagem();

  try {
    const resultado =
      await apiFetch(
        "/games/spin",
        {
          method: "POST",

          body:
            JSON.stringify({
              userId:
                usuario.id,

              gameId:
                configuracaoAtual.id,

              bet:
                aposta,

              freeSpin:
                false
            })
        }
      );

    if (resultado.user) {
      atualizarUsuario(
        resultado.user
      );
    } else if (
      resultado.usuario
    ) {
      atualizarUsuario(
        resultado.usuario
      );
    } else if (
      resultado.balance !==
      undefined
    ) {
      atualizarSaldo(
        resultado.balance
      );
    }

    await animarResultado(
      resultado
    );

    mostrarResultado(
      resultado
    );

  } catch (error) {
    console.error(
      "Erro ao girar:",
      error
    );

    mostrarMensagem(
      error.message ||
      "Não foi possível realizar o giro.",
      "error"
    );
  } finally {
    girando = false;

    bloquearControles(false);
  }
}


/* =========================================================
   ANIMAÇÃO SLOT
========================================================= */

function animarResultado(
  resultado
) {
  const grade =
    resultado.grid ||
    resultado.result?.grid ||
    resultado.result?.grade ||
    resultado.grade;

  if (!Array.isArray(grade)) {
    return Promise.resolve();
  }

  const reels =
    grade.length;

  const rows =
    Array.isArray(grade[0])
      ? grade[0].length
      : 1;

  if (!slotReels) {
    return Promise.resolve();
  }

  slotReels.style.setProperty(
    "--reels",
    reels
  );

  slotReels.innerHTML = "";

  const colunas = [];

  for (
    let reel = 0;
    reel < reels;
    reel++
  ) {
    const coluna =
      document.createElement(
        "div"
      );

    coluna.className =
      "slot-reel spinning";

    for (
      let row = 0;
      row < rows;
      row++
    ) {
      coluna.appendChild(
        criarSimbolo(
          grade[reel]?.[row]
        )
      );
    }

    slotReels.appendChild(
      coluna
    );

    colunas.push(coluna);
  }

  return new Promise(
    (resolve) => {
      setTimeout(
        () => {
          colunas.forEach(
            (coluna) => {
              coluna.classList.remove(
                "spinning"
              );
            }
          );

          destacarPremios(
            resultado
          );

          resolve();
        },
        900
      );
    }
  );
}


/* =========================================================
   DESTACAR PRÊMIOS
========================================================= */

function destacarPremios(
  resultado
) {
  const elementos =
    slotReels?.querySelectorAll(
      ".slot-symbol"
    );

  if (!elementos) {
    return;
  }

  const indices =
    resultado.winningPositions ||
    resultado.result?.winningPositions ||
    resultado.premios?.winningPositions ||
    [];

  if (
    Array.isArray(indices) &&
    indices.length
  ) {
    indices.forEach(
      (indice) => {
        const elemento =
          elementos[indice];

        if (elemento) {
          elemento.classList.add(
            "win"
          );
        }
      }
    );

    return;
  }

  const premio =
    numero(
      resultado.win ??
      resultado.premio ??
      resultado.result?.win ??
      0
    );

  if (premio > 0) {
    elementos.forEach(
      (elemento) => {
        elemento.classList.add(
          "win"
        );
      }
    );
  }
}


/* =========================================================
   RESULTADO SLOT
========================================================= */

function mostrarResultado(
  resultado
) {
  const premio =
    numero(
      resultado.win ??
      resultado.premio ??
      resultado.result?.win ??
      0
    );

  const aposta =
    numero(
      resultado.bet ??
      resultado.aposta ??
      obterAposta()
    );

  if (!winMessage) {
    return;
  }

  if (premio > 0) {
    winMessage.textContent =
      `🎉 Você ganhou R$ ${dinheiro(
        premio
      )}!`;

    winMessage.classList.add(
      "show",
      "win"
    );

    winMessage.classList.remove(
      "error"
    );

    return;
  }

  winMessage.textContent =
    `Aposta de R$ ${dinheiro(
      aposta
    )} realizada. Boa sorte na próxima!`;

  winMessage.classList.add(
    "show"
  );

  winMessage.classList.remove(
    "win",
    "error"
  );
}


/* =========================================================
   MENSAGENS
========================================================= */

function mostrarMensagem(
  mensagem,
  tipo = ""
) {
  if (!winMessage) {
    return;
  }

  winMessage.hidden = false;

  winMessage.textContent =
    mensagem;

  winMessage.classList.add(
    "show"
  );

  winMessage.classList.toggle(
    "error",
    tipo === "error"
  );

  winMessage.classList.toggle(
    "win",
    tipo === "win"
  );
}

function limparMensagem() {
  if (!winMessage) {
    return;
  }

  winMessage.textContent = "";

  winMessage.hidden = true;

  winMessage.classList.remove(
    "show",
    "win",
    "error"
  );
}


/* =========================================================
   CONTROLES SLOT
========================================================= */

function bloquearControles(
  bloqueado
) {
  if (spinButton) {
    spinButton.disabled =
      bloqueado;

    spinButton.textContent =
      bloqueado
        ? "Girando..."
        : "GIRAR";
  }

  if (betInput) {
    betInput.disabled =
      bloqueado;
  }

  quickBetButtons.forEach(
    (button) => {
      button.disabled =
        bloqueado;
    }
  );
}


/* =========================================================
   FECHAR
========================================================= */

function fecharJogo() {
  if (girando) {
    return;
  }

  if (gameModal) {
    gameModal.classList.remove(
      "active"
    );

    gameModal.setAttribute(
      "aria-hidden",
      "true"
    );

    gameModal.hidden = true;
  }

  document.body.classList.remove(
    "game-modal-open"
  );

  jogoAtual = null;
  configuracaoAtual = null;

  limparMensagem();
}


/* =========================================================
   EVENTOS
========================================================= */

if (spinButton) {
  spinButton.addEventListener(
    "click",
    girar
  );
}

if (rouletteSpinButton) {
  rouletteSpinButton.addEventListener(
    "click",
    girarRoleta
  );
}

if (rouletteBetType) {
  rouletteBetType.addEventListener(
    "change",
    atualizarTipoApostaRoleta
  );
}

document
  .querySelectorAll(
    "[data-roulette-bet]"
  )
  .forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        if (!rouletteBetInput) {
          return;
        }

        const valor =
          numero(
            button.dataset.rouletteBet,
            0
          );

        const minimo =
          numero(
            configuracaoAtual?.minBet,
            1
          );

        const maximo =
          numero(
            configuracaoAtual?.maxBet,
            1000
          );

        rouletteBetInput.value =
          Math.min(
            Math.max(
              valor,
              minimo
            ),
            maximo
          ).toFixed(2);
      }
    );
  });

document
  .querySelectorAll(
    ".roulette-bet-adjust"
  )
  .forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        if (!rouletteBetInput) {
          return;
        }

        const atual =
          numero(
            rouletteBetInput.value,
            1
          );

        const minimo =
          numero(
            configuracaoAtual?.minBet,
            1
          );

        const maximo =
          numero(
            configuracaoAtual?.maxBet,
            1000
          );

        const passo =
          numero(
            rouletteBetInput.step,
            1
          );

        const acao =
          button.dataset
            .rouletteAction;

        let novo =
          acao === "increase"
            ? atual + passo
            : atual - passo;

        novo =
          Math.min(
            Math.max(
              novo,
              minimo
            ),
            maximo
          );

        rouletteBetInput.value =
          novo.toFixed(2);
      }
    );
  });

document
  .querySelectorAll(
    ".bet-adjust:not(.roulette-bet-adjust)"
  )
  .forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        if (!betInput) {
          return;
        }

        const atual =
          numero(
            betInput.value,
            1
          );

        const minimo =
          numero(
            configuracaoAtual?.minBet,
            1
          );

        const maximo =
          numero(
            configuracaoAtual?.maxBet,
            1000
          );

        const passo =
          numero(
            betInput.step,
            1
          );

        const acao =
          button.dataset.action;

        let novo =
          acao === "increase"
            ? atual + passo
            : atual - passo;

        novo =
          Math.min(
            Math.max(
              novo,
              minimo
            ),
            maximo
          );

        betInput.value =
          novo.toFixed(2);
      }
    );
  });

if (closeGameButton) {
  closeGameButton.addEventListener(
    "click",
    fecharJogo
  );
}

if (backButton) {
  backButton.addEventListener(
    "click",
    () => {
      if (girando) {
        return;
      }

      window.location.href =
        "dashboard.html";
    }
  );
}

if (gameModal) {
  gameModal.addEventListener(
    "click",
    (event) => {
      if (
        event.target ===
        gameModal ||
        event.target.classList.contains(
          "modal-backdrop"
        )
      ) {
        fecharJogo();
      }
    }
  );
}

document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key === "Escape" &&
      !girando
    ) {
      fecharJogo();
    }

    if (
      event.key === "Enter" &&
      document.activeElement ===
        betInput
    ) {
      girar();
    }

    if (
      event.key === "Enter" &&
      document.activeElement ===
        rouletteBetInput
    ) {
      girarRoleta();
    }
  }
);


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

async function inicializar() {
  if (!verificarUsuario()) {
    return;
  }

  await carregarJogos();
}

inicializar();

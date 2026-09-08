const API = "/api";

let jogos = [];
let jogoAtual = null;
let configuracaoAtual = null;
let girando = false;

const usuarioSalvo = localStorage.getItem("jpbet_user");

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

const slotReels =
  document.getElementById("slotReels");

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
  document.getElementById("closeGameButton");

const backButton =
  document.getElementById("backButton");

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

function dinheiro(
  valor
) {
  return numero(
    valor
  ).toFixed(2);
}

function escaparHtml(
  valor
) {
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
    numero(
      usuario.bonusBalance
    ) +
    numero(
      usuario.cashBalance
    )
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
}

/* =========================================================
   LOGIN
========================================================= */

function verificarUsuario() {
  if (!usuario || !usuario.id) {
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

  gamesContainer.innerHTML =
    "";

  if (gamesMessage) {
    gamesMessage.textContent =
      "Carregando jogos...";
  }

  try {
    const data =
      await apiFetch(
        "/games"
      );

    jogos =
      Array.isArray(
        data.games
      )
        ? data.games
        : [];

    renderizarJogos();

    if (gamesMessage) {
      gamesMessage.textContent =
        jogos.length
          ? ""
          : "Nenhum jogo disponível.";
    }
  } catch (error) {
    console.error(
      "Erro ao carregar jogos:",
      error
    );

    if (gamesMessage) {
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

  gamesContainer.innerHTML =
    "";

  jogos.forEach(
    (jogo) => {
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
        () => abrirJogo(jogo.id)
      );

      gamesContainer.appendChild(
        card
      );
    }
  );
}

/* =========================================================
   ÍCONES DOS JOGOS
========================================================= */

function obterIconeJogo(
  gameId
) {
  const icones = {
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
      gameModal.classList.add(
        "active"
      );

      gameModal.setAttribute(
        "aria-hidden",
        "false"
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
   CONFIGURAÇÃO DO JOGO
========================================================= */

function renderizarConfiguracaoJogo() {
  if (!configuracaoAtual) {
    return;
  }

  const config =
    configuracaoAtual;

  if (gameTitle) {
    gameTitle.textContent =
      config.name ||
      config.nome ||
      "Jogo";
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
      numero(
        config.minBet,
        1
      );

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

    const apostaAtual =
      numero(
        betInput.value,
        minimo
      );

    betInput.value =
      Math.min(
        Math.max(
          apostaAtual,
          minimo
        ),
        maximo
      ).toFixed(2);
  }

  renderizarTabelaPremios();

  renderizarGradeInicial();
  atualizarSaldo();
}

/* =========================================================
   GRADE INICIAL
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
      let simbolo =
        "7";

      if (
        Array.isArray(
          grade
        ) &&
        Array.isArray(
          grade[reel]
        ) &&
        grade[reel][row]
      ) {
        simbolo =
          grade[reel][row];
      }

      coluna.appendChild(
        criarSimbolo(
          simbolo
        )
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

  const valor =
    obterValorSimbolo(
      simbolo
    );

  elemento.dataset.symbol =
    String(
      simbolo ?? ""
    );

  elemento.textContent =
    valor;

  return elemento;
}

function obterValorSimbolo(
  simbolo
) {
  if (
    simbolo &&
    typeof simbolo ===
      "object"
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
   TABELA DE PRÊMIOS
========================================================= */

function renderizarTabelaPremios() {
  if (!paytable) {
    return;
  }

  paytable.innerHTML =
    "";

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
        "paytable-row";

      const valores =
        Object.entries(
          payouts
        )
          .map(
            ([quantidade, multiplicador]) =>
              `${quantidade}x: ${multiplicador}x`
          )
          .join(" • ");

      linha.innerHTML = `
        <div class="paytable-symbol">
          ${escaparHtml(icone)}
        </div>

        <div class="paytable-name">
          ${escaparHtml(nome)}
        </div>

        <div class="paytable-values">
          ${escaparHtml(
            valores ||
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
   APOSTA
========================================================= */

function obterAposta() {
  if (!betInput) {
    return 0;
  }

  return numero(
    betInput.value,
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
    !Number.isFinite(
      aposta
    ) ||
    aposta <= 0
  ) {
    mostrarMensagem(
      "Informe uma aposta válida.",
      "error"
    );

    return false;
  }

  if (
    aposta < minimo
  ) {
    mostrarMensagem(
      `A aposta mínima é R$ ${dinheiro(
        minimo
      )}.`,
      "error"
    );

    return false;
  }

  if (
    aposta > maximo
  ) {
    mostrarMensagem(
      `A aposta máxima é R$ ${dinheiro(
        maximo
      )}.`,
      "error"
    );

    return false;
  }

  if (
    aposta > obterSaldo()
  ) {
    mostrarMensagem(
      "Saldo insuficiente.",
      "error"
    );

    return false;
  }

  return true;
}

/* =========================================================
   APOSTAS RÁPIDAS
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

        if (
          valor <= 0
        ) {
          return;
        }

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
   GIRO
========================================================= */

async function girar() {
  if (girando) {
    return;
  }

  if (!verificarUsuario()) {
    return;
  }

  if (!configuracaoAtual) {
    mostrarMensagem(
      "Nenhum jogo selecionado.",
      "error"
    );

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

    if (
      resultado.user
    ) {
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
   ANIMAÇÃO
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
    Array.isArray(
      grade[0]
    )
      ? grade[0].length
      : 1;

  if (!slotReels) {
    return Promise.resolve();
  }

  slotReels.style.setProperty(
    "--reels",
    reels
  );

  slotReels.innerHTML =
    "";

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
      const simbolo =
        grade[reel]?.[row];

      coluna.appendChild(
        criarSimbolo(
          simbolo
        )
      );
    }

    slotReels.appendChild(
      coluna
    );

    colunas.push(
      coluna
    );
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
   RESULTADO
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

function mostrarMensagem(
  mensagem,
  tipo = ""
) {
  if (!winMessage) {
    return;
  }

  winMessage.textContent =
    mensagem;

  winMessage.classList.add(
    "show"
  );

  winMessage.classList.toggle(
    "error",
    tipo === "error"
  );

  winMessage.classList.remove(
    "win"
  );
}

function limparMensagem() {
  if (!winMessage) {
    return;
  }

  winMessage.textContent =
    "";

  winMessage.classList.remove(
    "show",
    "win",
    "error"
  );
}

/* =========================================================
   CONTROLES
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
   FECHAR JOGO
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
  }

  jogoAtual =
    null;

  configuracaoAtual =
    null;

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
        gameModal
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

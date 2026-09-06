const API = "/api";

let jogos = [];
let jogoAtual = null;
let configuracaoAtual = null;
let girando = false;

const usuarioSalvo =
  localStorage.getItem("jpbet_user");

const token =
  localStorage.getItem("jpbet_token");

let usuario = null;

try {
  usuario = usuarioSalvo
    ? JSON.parse(usuarioSalvo)
    : null;
} catch (_) {
  usuario = null;
}


/* =========================================================
   ELEMENTOS
========================================================= */

const gamesContainer =
  document.getElementById(
    "gamesContainer"
  );

const gamesMessage =
  document.getElementById(
    "gamesMessage"
  );

const balanceElement =
  document.getElementById(
    "balance"
  );

const gameModal =
  document.getElementById(
    "gameModal"
  );

const gameTitle =
  document.getElementById(
    "gameTitle"
  );

const gameEyebrow =
  document.getElementById(
    "gameEyebrow"
  );

const gameBalance =
  document.getElementById(
    "gameBalance"
  );

const slotReels =
  document.getElementById(
    "slotReels"
  );

const betInput =
  document.getElementById(
    "betInput"
  );

const spinButton =
  document.getElementById(
    "spinButton"
  );

const winMessage =
  document.getElementById(
    "winMessage"
  );

const paytable =
  document.getElementById(
    "paytable"
  );

const minBet =
  document.getElementById(
    "minBet"
  );

const maxBet =
  document.getElementById(
    "maxBet"
  );

const closeGameButton =
  document.getElementById(
    "closeGameButton"
  );

const backButton =
  document.getElementById(
    "backButton"
  );


/* =========================================================
   FORMATAÇÃO
========================================================= */

function moeda(valor) {
  const numero =
    Number(valor);

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  ).format(
    Number.isFinite(numero)
      ? numero
      : 0
  );
}

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

function escaparHTML(valor) {
  return String(
    valor ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================================================
   MENSAGENS
========================================================= */

function mostrarMensagem(
  mensagem
) {
  if (!gamesMessage) {
    return;
  }

  gamesMessage.textContent =
    mensagem;

  gamesMessage.hidden =
    false;
}

function esconderMensagem() {
  if (!gamesMessage) {
    return;
  }

  gamesMessage.hidden =
    true;

  gamesMessage.textContent =
    "";
}


/* =========================================================
   USUÁRIO
========================================================= */

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
    usuario.balance !== undefined
  ) {
    return numero(
      usuario.balance
    );
  }

  const bonus =
    numero(
      usuario.bonusBalance
    );

  const cash =
    numero(
      usuario.cashBalance
    );

  return bonus + cash;
}

function atualizarSaldo() {
  const saldo =
    obterSaldo();

  if (balanceElement) {
    balanceElement.textContent =
      moeda(saldo);
  }

  if (gameBalance) {
    gameBalance.textContent =
      moeda(saldo);
  }
}


/* =========================================================
   REQUISIÇÃO
========================================================= */

async function apiFetch(
  url,
  options = {}
) {
  const headers = {
    ...(options.headers || {})
  };

  if (
    options.body &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] =
      "application/json";
  }

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  const response =
    await fetch(
      `${API}${url}`,
      {
        ...options,
        headers
      }
    );

  let data = null;

  try {
    data =
      await response.json();
  } catch (_) {
    data = null;
  }

  if (!response.ok) {
    const erro =
      new Error(
        data?.message ||
        "Não foi possível concluir a operação."
      );

    erro.status =
      response.status;

    erro.data =
      data;

    throw erro;
  }

  return data;
}


/* =========================================================
   VERIFICAR LOGIN
========================================================= */

function verificarUsuario() {
  if (!usuario) {
    window.location.href =
      "/index.html";
    return false;
  }

  return true;
}


/* =========================================================
   ÍCONES DOS JOGOS
========================================================= */

function obterIconeJogo(
  gameId
) {
  const id =
    String(gameId || "")
      .toLowerCase();

  if (
    id.includes("fortune")
  ) {
    return "🎰";
  }

  if (
    id.includes("diamond")
  ) {
    return "💎";
  }

  if (
    id.includes("royal")
  ) {
    return "👑";
  }

  if (
    id.includes("lucky")
  ) {
    return "7️⃣";
  }

  return "🎰";
}


/* =========================================================
   DESCRIÇÃO DOS JOGOS
========================================================= */

function obterDescricaoJogo(
  game
) {
  const id =
    String(game?.id || "")
      .toLowerCase();

  if (
    id === "fortune7"
  ) {
    return "Máquina clássica de 3 rolos com símbolos 7, BAR e cerejas.";
  }

  if (
    id === "diamondgold"
  ) {
    return "Máquina de 5 rolos com diamantes, ouro, coroas e bônus.";
  }

  if (
    id === "royaljackpot"
  ) {
    return "Máquina de 5 rolos com símbolos Royal, Jackpot e bônus.";
  }

  if (
    id === "lucky7"
  ) {
    return "Clássico Lucky 7 de 3 rolos com símbolos tradicionais.";
  }

  return "Escolha sua aposta e gire os rolos.";
}


/* =========================================================
   CARDS
========================================================= */

function renderizarJogos() {
  if (!gamesContainer) {
    return;
  }

  gamesContainer.innerHTML =
    "";

  if (
    !Array.isArray(jogos) ||
    jogos.length === 0
  ) {
    gamesContainer.innerHTML = `
      <div class="loading">
        Nenhum jogo disponível no momento.
      </div>
    `;

    return;
  }

  jogos.forEach(
    (game) => {
      const card =
        document.createElement(
          "article"
        );

      card.className =
        "game-card";

      const nome =
        escaparHTML(
          game.name ||
          game.id
        );

      const descricao =
        escaparHTML(
          obterDescricaoJogo(
            game
          )
        );

      card.innerHTML = `
        <div>
          <div class="game-icon">
            ${obterIconeJogo(
              game.id
            )}
          </div>

          <h3>
            ${nome}
          </h3>

          <p>
            ${descricao}
          </p>
        </div>

        <button
          type="button"
          class="game-card-button"
        >
          JOGAR
        </button>
      `;

      const button =
        card.querySelector(
          ".game-card-button"
        );

      button.addEventListener(
        "click",
        () => {
          abrirJogo(
            game.id
          );
        }
      );

      gamesContainer.appendChild(
        card
      );
    }
  );
}


/* =========================================================
   CARREGAR JOGOS
========================================================= */

async function carregarJogos() {
  try {
    esconderMensagem();

    if (gamesContainer) {
      gamesContainer.innerHTML = `
        <div class="loading">
          Carregando jogos...
        </div>
      `;
    }

    const data =
      await apiFetch(
        "/games"
      );

    jogos =
      Array.isArray(
        data?.games
      )
        ? data.games
        : [];

    renderizarJogos();
  } catch (error) {
    console.error(
      "Erro ao carregar jogos:",
      error
    );

    if (gamesContainer) {
      gamesContainer.innerHTML =
        "";
    }

    mostrarMensagem(
      error.message ||
      "Não foi possível carregar os jogos."
    );
  }
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
    esconderMensagem();

    const data =
      await apiFetch(
        `/games/${encodeURIComponent(
          gameId
        )}`
      );

    configuracaoAtual =
      data?.game || null;

    if (!configuracaoAtual) {
      throw new Error(
        "Configuração do jogo não encontrada."
      );
    }

    jogoAtual =
      gameId;

    gameTitle.textContent =
      configuracaoAtual.name ||
      gameId;

    gameEyebrow.textContent =
      "JPBET";

    minBet.textContent =
      moeda(
        configuracaoAtual.minBet
      );

    maxBet.textContent =
      moeda(
        configuracaoAtual.maxBet
      );

    const apostaMinima =
      numero(
        configuracaoAtual.minBet,
        1
      );

    const apostaAtual =
      numero(
        betInput.value,
        apostaMinima
      );

    betInput.min =
      apostaMinima;

    betInput.max =
      numero(
        configuracaoAtual.maxBet,
        1000
      );

    betInput.step =
      "0.01";

    betInput.value =
      Math.max(
        apostaMinima,
        Math.min(
          apostaAtual,
          numero(
            configuracaoAtual.maxBet,
            1000
          )
        )
      );

    slotReels.style
      .setProperty(
        "--reels",
        configuracaoAtual.reels
      );

    renderizarGradeInicial();

    renderizarTabelaPremios();

    limparMensagemPremio();

    atualizarSaldo();

    gameModal.hidden =
      false;

    document.body.style.overflow =
      "hidden";
  } catch (error) {
    console.error(
      "Erro ao abrir jogo:",
      error
    );

    mostrarMensagem(
      error.message ||
      "Não foi possível abrir o jogo."
    );
  }
}


/* =========================================================
   FECHAR JOGO
========================================================= */

function fecharJogo() {
  if (girando) {
    return;
  }

  gameModal.hidden =
    true;

  document.body.style.overflow =
    "";

  jogoAtual =
    null;

  configuracaoAtual =
    null;
}


/* =========================================================
   GRADE INICIAL
========================================================= */

function criarSimboloVisual(
  symbol
) {
  const element =
    document.createElement(
      "div"
    );

  element.className =
    "slot-symbol";

  const label =
    symbol?.label ??
    symbol?.id ??
    "?";

  const texto =
    String(label);

  if (
    texto.length > 7
  ) {
    element.classList.add(
      "small"
    );
  }

  element.textContent =
    texto;

  return element;
}

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
          5
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

  const symbols =
    Array.isArray(
      configuracaoAtual?.symbols
    )
      ? configuracaoAtual.symbols
      : [];

  slotReels.innerHTML =
    "";

  slotReels.style
    .setProperty(
      "--reels",
      reels
    );

  for (
    let reel = 0;
    reel < reels;
    reel++
  ) {
    const reelElement =
      document.createElement(
        "div"
      );

    reelElement.className =
      "reel";

    for (
      let row = 0;
      row < rows;
      row++
    ) {
      const symbol =
        symbols.length > 0
          ? symbols[
              Math.floor(
                Math.random() *
                symbols.length
              )
            ]
          : {
              id: "blank",
              label: "?"
            };

      reelElement.appendChild(
        criarSimboloVisual(
          symbol
        )
      );
    }

    slotReels.appendChild(
      reelElement
    );
  }
}


/* =========================================================
   RENDERIZAR RESULTADO
========================================================= */

function renderizarResultado(
  resultado
) {
  if (!resultado) {
    return;
  }

  const grid =
    Array.isArray(
      resultado.grid
    )
      ? resultado.grid
      : [];

  slotReels.innerHTML =
    "";

  const reels =
    Math.max(
      1,
      Math.floor(
        numero(
          resultado.reels,
          configuracaoAtual?.reels ||
          5
        )
      )
    );

  const rows =
    Math.max(
      1,
      Math.floor(
        numero(
          resultado.rows,
          configuracaoAtual?.rows ||
          3
        )
      )
    );

  slotReels.style
    .setProperty(
      "--reels",
      reels
    );

  const winningPositions =
    new Set();

  if (
    Array.isArray(
      resultado.prizes
    )
  ) {
    resultado.prizes.forEach(
      (prize) => {
        if (
          Array.isArray(
            prize.positions
          )
        ) {
          /*
           * positions informa a posição
           * na linha, então aqui apenas
           * destacamos os símbolos
           * vencedores da linha central
           * quando possível.
           */
        }
      }
    );
  }

  for (
    let reel = 0;
    reel < reels;
    reel++
  ) {
    const reelElement =
      document.createElement(
        "div"
      );

    reelElement.className =
      "reel";

    const coluna =
      Array.isArray(
        grid[reel]
      )
        ? grid[reel]
        : [];

    for (
      let row = 0;
      row < rows;
      row++
    ) {
      const symbol =
        coluna[row] || {
          id: "blank",
          label: "?"
        };

      const element =
        criarSimboloVisual(
          symbol
        );

      if (
        winningPositions.has(
          `${reel}:${row}`
        )
      ) {
        element.classList.add(
          "win"
        );
      }

      reelElement.appendChild(
        element
      );
    }

    slotReels.appendChild(
      reelElement
    );
  }

  /*
   * Destaca as posições dos prêmios.
   */
  if (
    Array.isArray(
      resultado.prizes
    ) &&
    Array.isArray(
      resultado.lines
    )
  ) {
    resultado.prizes.forEach(
      (prize) => {
        const linhaIndex =
          numero(
            prize.line,
            1
          ) - 1;

        const linha =
          resultado.lines[
            linhaIndex
          ];

        if (
          !Array.isArray(
            linha
          )
        ) {
          return;
        }

        const positions =
          Array.isArray(
            prize.positions
          )
            ? prize.positions
            : [];

        positions.forEach(
          (reelIndex) => {
            const row =
              numero(
                linha[
                  reelIndex
                ],
                0
              );

            const reelElement =
              slotReels.children[
                reelIndex
              ];

            if (
              !reelElement
            ) {
              return;
            }

            const symbolElement =
              reelElement.children[
                row
              ];

            if (
              symbolElement
            ) {
              symbolElement.classList.add(
                "win"
              );
            }
          }
        );
      }
    );
  }
}


/* =========================================================
   MENSAGEM DE PRÊMIO
========================================================= */

function limparMensagemPremio() {
  if (!winMessage) {
    return;
  }

  winMessage.hidden =
    true;

  winMessage.classList.remove(
    "lose"
  );

  winMessage.textContent =
    "";
}

function mostrarResultadoPremio(
  resultado
) {
  if (!winMessage) {
    return;
  }

  const premio =
    numero(
      resultado?.win,
      0
    );

  const scatter =
    numero(
      resultado?.scatterCount,
      0
    );

  const freeSpins =
    numero(
      resultado?.freeSpinsAwarded,
      0
    );

  winMessage.hidden =
    false;

  winMessage.classList.remove(
    "lose"
  );

  if (premio > 0) {
    let texto =
      `Você ganhou ${moeda(
        premio
      )}!`;

    if (
      freeSpins > 0
    ) {
      texto +=
        ` + ${freeSpins} giros grátis`;
    }

    winMessage.textContent =
      texto;

    return;
  }

  if (
    freeSpins > 0
  ) {
    winMessage.textContent =
      `Você ganhou ${freeSpins} giros grátis!`;

    return;
  }

  if (
    scatter > 0
  ) {
    winMessage.textContent =
      "Boa! Você conseguiu símbolos bônus.";
  } else {
    winMessage.classList.add(
      "lose"
    );

    winMessage.textContent =
      "Não foi dessa vez. Tente novamente.";
  }
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

  const tabela =
    configuracaoAtual?.paytable;

  const symbols =
    Array.isArray(
      configuracaoAtual?.symbols
    )
      ? configuracaoAtual.symbols
      : [];

  if (
    !tabela ||
    typeof tabela !== "object"
  ) {
    paytable.innerHTML = `
      <div class="paytable-item">
        Consulte os pagamentos disponíveis.
      </div>
    `;

    return;
  }

  Object.entries(
    tabela
  ).forEach(
    ([symbolId, valores]) => {
      const symbol =
        symbols.find(
          (item) =>
            item?.id ===
            symbolId
        );

      const label =
        symbol?.label ||
        symbolId;

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "paytable-item";

      const pagamentos =
        [];

      if (
        valores &&
        typeof valores ===
          "object"
      ) {
        Object.entries(
          valores
        ).forEach(
          ([quantidade, multiplicador]) => {
            pagamentos.push(
              `${quantidade} = ${numero(
                multiplicador
              )}x`
            );
          }
        );
      }

      item.innerHTML = `
        <div class="paytable-symbol">
          ${escaparHTML(
            label
          )}
        </div>

        <div class="paytable-values">
          ${escaparHTML(
            pagamentos.join(
              " • "
            )
          )}
        </div>
      `;

      paytable.appendChild(
        item
      );
    }
  );
}


/* =========================================================
   APOSTA
========================================================= */

function obterAposta() {
  let valor =
    Number(
      String(
        betInput.value
      ).replace(
        ",",
        "."
      )
    );

  if (
    !Number.isFinite(
      valor
    )
  ) {
    valor =
      numero(
        configuracaoAtual?.minBet,
        1
      );
  }

  return Math.round(
    valor *
      100
  ) / 100;
}

function definirAposta(
  valor
) {
  if (
    !configuracaoAtual
  ) {
    return;
  }

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

  const novoValor =
    Math.max(
      minimo,
      Math.min(
        maximo,
        numero(
          valor,
          minimo
        )
      )
    );

  betInput.value =
    novoValor.toFixed(
      2
    );
}

function ajustarAposta(
  direcao
) {
  const atual =
    obterAposta();

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

  const incremento =
    atual < 10
      ? 1
      : atual < 100
        ? 5
        : 10;

  definirAposta(
    direcao ===
      "increase"
      ? atual +
          incremento
      : atual -
          incremento
  );

  if (
    numero(
      betInput.value
    ) < minimo
  ) {
    definirAposta(
      minimo
    );
  }

  if (
    numero(
      betInput.value
    ) > maximo
  ) {
    definirAposta(
      maximo
    );
  }
}


/* =========================================================
   ANIMAÇÃO
========================================================= */

function iniciarAnimacao() {
  slotReels.classList.add(
    "spinning"
  );
}

function pararAnimacao() {
  slotReels.classList.remove(
    "spinning"
  );
}

function gerarGradeAnimacao() {
  if (
    !configuracaoAtual
  ) {
    return;
  }

  const reels =
    Math.max(
      1,
      Math.floor(
        numero(
          configuracaoAtual.reels,
          5
        )
      )
    );

  const rows =
    Math.max(
      1,
      Math.floor(
        numero(
          configuracaoAtual.rows,
          3
        )
      )
    );

  const symbols =
    Array.isArray(
      configuracaoAtual.symbols
    )
      ? configuracaoAtual.symbols
      : [];

  if (
    symbols.length === 0
  ) {
    return;
  }

  slotReels.innerHTML =
    "";

  for (
    let reel = 0;
    reel < reels;
    reel++
  ) {
    const reelElement =
      document.createElement(
        "div"
      );

    reelElement.className =
      "reel";

    for (
      let row = 0;
      row < rows;
      row++
    ) {
      const symbol =
        symbols[
          Math.floor(
            Math.random() *
            symbols.length
          )
        ];

      reelElement.appendChild(
        criarSimboloVisual(
          symbol
        )
      );
    }

    slotReels.appendChild(
      reelElement
    );
  }
}

let animationTimer =
  null;

function iniciarVisualizacao() {
  if (
    animationTimer
  ) {
    clearInterval(
      animationTimer
    );
  }

  animationTimer =
    setInterval(
      gerarGradeAnimacao,
      90
    );
}

function pararVisualizacao() {
  if (
    animationTimer
  ) {
    clearInterval(
      animationTimer
    );

    animationTimer =
      null;
  }
}


/* =========================================================
   GIRAR
========================================================= */

async function girar() {
  if (
    girando ||
    !configuracaoAtual ||
    !jogoAtual
  ) {
    return;
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
    aposta < minimo
  ) {
    mostrarMensagem(
      `A aposta mínima é ${moeda(
        minimo
      )}.`
    );

    definirAposta(
      minimo
    );

    return;
  }

  if (
    aposta > maximo
  ) {
    mostrarMensagem(
      `A aposta máxima é ${moeda(
        maximo
      )}.`
    );

    definirAposta(
      maximo
    );

    return;
  }

  const saldo =
    obterSaldo();

  if (
    saldo < aposta
  ) {
    mostrarMensagem(
      "Saldo insuficiente para realizar esta aposta."
    );

    return;
  }

  girando =
    true;

  spinButton.disabled =
    true;

  betInput.disabled =
    true;

  document
    .querySelectorAll(
      ".bet-adjust, .quick-bets button"
    )
    .forEach(
      (button) => {
        button.disabled =
          true;
      }
    );

  esconderMensagem();

  limparMensagemPremio();

  iniciarAnimacao();

  iniciarVisualizacao();

  try {
    /*
     * Mantemos a animação por alguns segundos
     * para que a máquina tenha aparência real
     * antes de revelar o resultado vindo do servidor.
     */
    const requisicao =
      apiFetch(
        "/games/spin",
        {
          method:
            "POST",

          body:
            JSON.stringify({
              userId:
                usuario.id,

              gameId:
                jogoAtual,

              bet:
                aposta,

              freeSpin:
                false
            })
        }
      );

    const minimoAnimacao =
      new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            1300
          )
      );

    const [
      data
    ] =
      await Promise.all([
        requisicao,
        minimoAnimacao
      ]);

    pararVisualizacao();

    pararAnimacao();

    const resultado =
      data?.round;

    if (!resultado) {
      throw new Error(
        "O servidor não retornou o resultado da rodada."
      );
    }

    renderizarResultado(
      resultado
    );

    if (
      data.user
    ) {
      atualizarUsuario(
        data.user
      );
    } else {
      /*
       * Compatibilidade com respostas
       * que retornem apenas saldo.
       */
      if (
        data.balance !==
        undefined
      ) {
        atualizarUsuario({
          balance:
            data.balance
        });
      }
    }

    mostrarResultadoPremio(
      resultado
    );
  } catch (error) {
    console.error(
      "Erro ao girar:",
      error
    );

    pararVisualizacao();

    pararAnimacao();

    /*
     * Se a operação falhou,
     * voltamos a mostrar a grade.
     */
    renderizarGradeInicial();

    if (
      error.status === 401
    ) {
      mostrarMensagem(
        "Sua sessão não está mais disponível. Faça login novamente."
      );
    } else {
      mostrarMensagem(
        error.message ||
        "Não foi possível realizar a aposta."
      );
    }
  } finally {
    girando =
      false;

    spinButton.disabled =
      false;

    betInput.disabled =
      false;

    document
      .querySelectorAll(
        ".bet-adjust, .quick-bets button"
      )
      .forEach(
        (button) => {
          button.disabled =
            false;
        }
      );

    atualizarSaldo();
  }
}


/* =========================================================
   EVENTOS
========================================================= */

if (
  spinButton
) {
  spinButton.addEventListener(
    "click",
    girar
  );
}

if (
  closeGameButton
) {
  closeGameButton.addEventListener(
    "click",
    fecharJogo
  );
}

if (
  gameModal
) {
  const backdrop =
    gameModal.querySelector(
      ".modal-backdrop"
    );

  if (backdrop) {
    backdrop.addEventListener(
      "click",
      fecharJogo
    );
  }
}

if (
  backButton
) {
  backButton.addEventListener(
    "click",
    () => {
      window.location.href =
        "/dashboard";
    }
  );
}

document
  .querySelectorAll(
    ".bet-adjust"
  )
  .forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          ajustarAposta(
            button.dataset.action
          );
        }
      );
    }
  );

document
  .querySelectorAll(
    ".quick-bets button"
  )
  .forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          definirAposta(
            numero(
              button.dataset.bet,
              1
            )
          );
        }
      );
    }
  );

if (
  betInput
) {
  betInput.addEventListener(
    "change",
    () => {
      definirAposta(
        obterAposta()
      );
    }
  );
}

document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key === "Escape" &&
      gameModal &&
      !gameModal.hidden &&
      !girando
    ) {
      fecharJogo();
    }

    if (
      event.code ===
        "Space" &&
      gameModal &&
      !gameModal.hidden &&
      !girando
    ) {
      event.preventDefault();

      girar();
    }
  }
);


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

async function iniciar() {
  if (
    !verificarUsuario()
  ) {
    return;
  }

  atualizarSaldo();

  await carregarJogos();
}

iniciar();

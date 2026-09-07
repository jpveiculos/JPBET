const API_URL = "/api";

/* =========================
   USUÁRIO
========================= */

function getUser() {
  try {
    const user = localStorage.getItem("jpbet_user");

    return user
      ? JSON.parse(user)
      : null;
  } catch (error) {
    console.error("Erro ao obter usuário:", error);
    return null;
  }
}


/* =========================
   TOKEN
========================= */

function getToken() {
  return localStorage.getItem("jpbet_token");
}


/* =========================
   VERIFICAR SESSÃO
========================= */

function verificarSessao() {
  const user = getUser();
  const token = getToken();

  if (!user || !token) {
    window.location.href = "index.html";
    return false;
  }

  return true;
}


/* =========================
   FORMATAR DINHEIRO
========================= */

function formatarDinheiro(valor) {
  const numero = Number(valor) || 0;

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}


/* =========================
   FORMATAR NÚMERO
========================= */

function formatarNumero(valor) {
  const numero = Number(valor) || 0;

  return numero.toLocaleString("pt-BR");
}


/* =========================
   LOCALIZAR ELEMENTO
========================= */

function encontrarElemento(...ids) {
  for (const id of ids) {
    const elemento = document.getElementById(id);

    if (elemento) {
      return elemento;
    }
  }

  return null;
}


/* =========================
   MOSTRAR DADOS DO USUÁRIO
========================= */

function mostrarDadosUsuario() {
  const user = getUser();

  if (!user) {
    return;
  }

  const nome =
    user.username ||
    user.nome ||
    user.name ||
    "Usuário";

  const saldo =
    user.balance ??
    user.saldo ??
    user.balanceAmount ??
    0;

  const bonusBalance =
    user.bonusBalance ??
    user.bonus_balance ??
    user.bonus ??
    0;

  const cashBalance =
    user.cashBalance ??
    user.cash_balance ??
    0;

  const reservedBalance =
    user.reservedBalance ??
    user.reserved_balance ??
    0;

  const bonusWagerProgress =
    user.bonusWagerProgress ??
    user.bonus_wager_progress ??
    0;

  const rouletteFreeSpins =
    user.rouletteFreeSpins ??
    user.roulette_free_spins ??
    0;

  const rouletteFreeSpinBet =
    user.rouletteFreeSpinBet ??
    user.roulette_free_spin_bet ??
    0;

  const userName = encontrarElemento(
    "userName",
    "username",
    "profileName",
    "playerName"
  );

  if (userName) {
    userName.textContent = nome;
  }

  const welcomeMessage = encontrarElemento(
    "welcomeMessage",
    "welcome",
    "welcomeText"
  );

  if (welcomeMessage) {
    welcomeMessage.textContent = `Bem-vindo, ${nome}!`;
  }

  const userBalance = encontrarElemento(
    "userBalance",
    "balance",
    "saldo",
    "saldoUsuario",
    "playerBalance"
  );

  if (userBalance) {
    userBalance.textContent =
      formatarDinheiro(saldo);
  }

  [
    "bonusBalance",
    "bonus_balance",
    "bonusSaldo",
    "saldoBonus",
    "userBonus",
    "playerBonus",
    "bonusAmount"
  ].forEach((id) => {
    const elemento =
      document.getElementById(id);

    if (elemento) {
      elemento.textContent =
        formatarDinheiro(bonusBalance);
    }
  });

  [
    "cashBalance",
    "cash_balance",
    "saldoCash",
    "saldoDinheiro",
    "realBalance"
  ].forEach((id) => {
    const elemento =
      document.getElementById(id);

    if (elemento) {
      elemento.textContent =
        formatarDinheiro(cashBalance);
    }
  });

  [
    "reservedBalance",
    "reserved_balance",
    "saldoReservado"
  ].forEach((id) => {
    const elemento =
      document.getElementById(id);

    if (elemento) {
      elemento.textContent =
        formatarDinheiro(reservedBalance);
    }
  });

  [
    "bonusWagerProgress",
    "bonus_wager_progress",
    "bonusProgress",
    "progressoBonus"
  ].forEach((id) => {
    const elemento =
      document.getElementById(id);

    if (elemento) {
      elemento.textContent =
        formatarDinheiro(bonusWagerProgress);
    }
  });

  const bonusMessage =
    document.getElementById("bonusMessage");

  if (bonusMessage) {
    const bonusNumero =
      Number(bonusBalance) || 0;

    bonusMessage.textContent =
      bonusNumero > 0
        ? `Você possui ${formatarDinheiro(
            bonusNumero
          )} em bônus.`
        : "Você não possui bônus disponível no momento.";
  }

  [
    "rouletteFreeSpins",
    "roulette_free_spins",
    "freeSpins",
    "girosGratis",
    "girosRoleta"
  ].forEach((id) => {
    const elemento =
      document.getElementById(id);

    if (elemento) {
      elemento.textContent =
        formatarNumero(rouletteFreeSpins);
    }
  });

  [
    "rouletteFreeSpinBet",
    "roulette_free_spin_bet",
    "freeSpinBet",
    "valorGiroGratis"
  ].forEach((id) => {
    const elemento =
      document.getElementById(id);

    if (elemento) {
      elemento.textContent =
        formatarDinheiro(rouletteFreeSpinBet);
    }
  });

  document
    .querySelectorAll("[data-user-field]")
    .forEach((elemento) => {
      const campo =
        elemento.getAttribute(
          "data-user-field"
        );

      let valor = "";

      switch (campo) {
        case "username":
        case "nome":
        case "name":
          valor = nome;
          break;

        case "balance":
        case "saldo":
          valor = formatarDinheiro(saldo);
          break;

        case "bonusBalance":
        case "bonus_balance":
        case "bonus":
          valor =
            formatarDinheiro(bonusBalance);
          break;

        case "cashBalance":
        case "cash_balance":
          valor =
            formatarDinheiro(cashBalance);
          break;

        case "reservedBalance":
        case "reserved_balance":
          valor =
            formatarDinheiro(reservedBalance);
          break;

        case "bonusWagerProgress":
        case "bonus_wager_progress":
          valor =
            formatarDinheiro(
              bonusWagerProgress
            );
          break;

        case "rouletteFreeSpins":
        case "roulette_free_spins":
          valor =
            formatarNumero(
              rouletteFreeSpins
            );
          break;

        case "rouletteFreeSpinBet":
        case "roulette_free_spin_bet":
          valor =
            formatarDinheiro(
              rouletteFreeSpinBet
            );
          break;
      }

      elemento.textContent = valor;
    });

  document
    .querySelectorAll("[data-bonus-balance]")
    .forEach((elemento) => {
      elemento.textContent =
        formatarDinheiro(bonusBalance);
    });

  document
    .querySelectorAll("[data-user-balance]")
    .forEach((elemento) => {
      elemento.textContent =
        formatarDinheiro(saldo);
    });

  document
    .querySelectorAll("[data-user-name]")
    .forEach((elemento) => {
      elemento.textContent = nome;
    });
}


/* =========================
   CORRIGIR BOTÃO INÍCIO
========================= */

function configurarBotaoInicio() {
  const botoes =
    document.querySelectorAll(
      ".home-button, [data-home-button]"
    );

  botoes.forEach((botao) => {
    botao.textContent = "Início";

    botao.onclick = () => {
      window.location.href = "index.html";
    };
  });
}


/* =========================
   CARREGAR JOGOS
========================= */

async function carregarJogos() {
  const container =
    document.getElementById(
      "gamesContainer"
    );

  const message =
    document.getElementById(
      "gamesMessage"
    );

  if (!container) {
    return;
  }

  try {
    const token = getToken();

    const response =
      await fetch(`${API_URL}/games`, {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${token}`
        }
      });

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message ||
        "Não foi possível carregar os jogos."
      );
    }

    const jogos =
      Array.isArray(data)
        ? data
        : (
          data.games ||
          data.jogos ||
          []
        );

    container.innerHTML = "";

    const jogosAtivos =
      jogos.filter(
        (jogo) =>
          jogo &&
          jogo.enabled !== false
      );

    if (!jogosAtivos.length) {
      if (message) {
        message.textContent =
          "Nenhum jogo disponível no momento.";
      }

      return;
    }

    if (message) {
      message.textContent = "";
    }

    jogosAtivos.forEach((jogo) => {
      const card =
        document.createElement("article");

      card.className =
        "dashboard-game-card";

      const gameId =
        String(jogo.id || "");

      const nome =
        jogo.name ||
        jogo.title ||
        gameId;

      const descricao =
        jogo.description ||
        "Escolha este jogo para jogar.";

      const tipo =
        jogo.type === "roulette"
          ? "🎡 Roleta"
          : "🎰 Máquina";

      card.innerHTML = `
        <div class="dashboard-game-image">
          <span>${tipo}</span>
        </div>

        <div class="dashboard-game-content">
          <h3>${nome}</h3>

          <p>${descricao}</p>

          <button
            type="button"
            class="dashboard-game-button"
            data-game-id="${gameId}"
          >
            JOGAR
          </button>
        </div>
      `;

      const button =
        card.querySelector(
          ".dashboard-game-button"
        );

      if (button) {
        button.addEventListener(
          "click",
          () => {
            /*
             * Abre diretamente o jogo escolhido.
             * games.js identifica o gameId e
             * abre a interface correspondente.
             */
            window.location.href =
              `games.html?game=${encodeURIComponent(
                gameId
              )}`;
          }
        );
      }

      container.appendChild(card);
    });
  } catch (error) {
    console.error(
      "Erro ao carregar jogos:",
      error
    );

    if (message) {
      message.textContent =
        error.message ||
        "Não foi possível carregar os jogos.";
    }
  }
}


/* =========================
   ATUALIZAR PERFIL
========================= */

async function atualizarPerfil() {
  const token = getToken();

  if (!token) {
    return;
  }

  try {
    const response =
      await fetch(
        `${API_URL}/auth/me`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${token}`,
            "Content-Type":
              "application/json"
          }
        }
      );

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      await sair();
      return;
    }

    if (!response.ok) {
      console.error(
        "Não foi possível atualizar o perfil.",
        response.status
      );
      return;
    }

    const data =
      await response
        .json()
        .catch(() => null);

    if (!data) {
      return;
    }

    const user =
      data.user ||
      data.usuario ||
      data.player ||
      data.data ||
      data;

    if (
      user &&
      typeof user === "object"
    ) {
      localStorage.setItem(
        "jpbet_user",
        JSON.stringify(user)
      );

      mostrarDadosUsuario();
    }
  } catch (error) {
    console.error(
      "Erro ao atualizar perfil:",
      error
    );
  }
}


/* =========================
   ATUALIZAÇÃO AUTOMÁTICA
========================= */

let intervaloAtualizacao = null;

function iniciarAtualizacaoAutomatica() {
  if (intervaloAtualizacao) {
    clearInterval(
      intervaloAtualizacao
    );
  }

  intervaloAtualizacao =
    setInterval(
      atualizarPerfil,
      15000
    );
}


/* =========================
   SAIR
========================= */

async function sair() {
  if (intervaloAtualizacao) {
    clearInterval(
      intervaloAtualizacao
    );

    intervaloAtualizacao = null;
  }

  const token = getToken();

  if (token) {
    try {
      await fetch(
        `${API_URL}/auth/logout`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${token}`,
            "Content-Type":
              "application/json"
          }
        }
      );
    } catch (error) {
      console.error(
        "Erro ao encerrar sessão no servidor:",
        error
      );
    }
  }

  localStorage.removeItem(
    "jpbet_user"
  );

  localStorage.removeItem(
    "jpbet_token"
  );

  window.location.replace(
    "index.html"
  );
}


/* =========================
   EXPOR FUNÇÕES
========================= */

window.getUser = getUser;
window.getToken = getToken;
window.mostrarDadosUsuario =
  mostrarDadosUsuario;
window.atualizarPerfil =
  atualizarPerfil;
window.sair = sair;
window.formatarDinheiro =
  formatarDinheiro;
window.carregarJogos =
  carregarJogos;


/* =========================
   INICIAR DASHBOARD
========================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    if (!verificarSessao()) {
      return;
    }

    window.scrollTo(0, 0);

    configurarBotaoInicio();

    mostrarDadosUsuario();

    await atualizarPerfil();

    await carregarJogos();

    iniciarAtualizacaoAutomatica();
  }
);


/* =========================
   TOPO AO VOLTAR
========================= */

window.addEventListener(
  "pageshow",
  () => {
    window.scrollTo(0, 0);
  }
);

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
    console.error(
      "Erro ao obter usuário:",
      error
    );
    return null;
  }
}
/* =========================
   TOKEN
========================= */
function getToken() {
  return localStorage.getItem(
    "jpbet_token"
  );
}
/* =========================
   VERIFICAR SESSÃO
========================= */
function verificarSessao() {
  const user = getUser();
  const token = getToken();
  if (!user || !token) {
    window.location.href =
      "index.html";
    return false;
  }
  return true;
}
/* =========================
   FORMATAR DINHEIRO
========================= */
function formatarDinheiro(valor) {
  const numero = Number(valor) || 0;
  return numero.toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  );
}
/* =========================
   FORMATAR NÚMERO
========================= */
function formatarNumero(valor) {
  const numero = Number(valor) || 0;
  return numero.toLocaleString(
    "pt-BR"
  );
}
/* =========================
   LOCALIZAR ELEMENTO
========================= */
function encontrarElemento(...ids) {
  for (const id of ids) {
    const elemento =
      document.getElementById(id);
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
  /* =========================
     NOME
  ========================= */
  const userName =
    encontrarElemento(
      "userName",
      "username",
      "profileName",
      "playerName"
    );
  if (userName) {
    userName.textContent = nome;
  }
  /* =========================
     BOAS-VINDAS
  ========================= */
  const welcomeMessage =
    encontrarElemento(
      "welcomeMessage",
      "welcome",
      "welcomeText"
    );
  if (welcomeMessage) {
    welcomeMessage.textContent =
      `Bem-vindo, ${nome}!`;
  }
  /* =========================
     SALDO PRINCIPAL
  ========================= */
  const userBalance =
    encontrarElemento(
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
  /* =========================
     SALDO DE BÔNUS
  ========================= */
  const bonusElements = [
    "bonusBalance",
    "bonus_balance",
    "bonusSaldo",
    "saldoBonus",
    "userBonus",
    "playerBonus",
    "bonusAmount"
  ];
  bonusElements.forEach((id) => {
    const elemento =
      document.getElementById(id);
    if (elemento) {
      elemento.textContent =
        formatarDinheiro(
          bonusBalance
        );
    }
  });
  /* =========================
     SALDO EM DINHEIRO
  ========================= */
  const cashElements = [
    "cashBalance",
    "cash_balance",
    "saldoCash",
    "saldoDinheiro",
    "realBalance"
  ];
  cashElements.forEach((id) => {
    const elemento =
      document.getElementById(id);
    if (elemento) {
      elemento.textContent =
        formatarDinheiro(
          cashBalance
        );
    }
  });
  /* =========================
     SALDO RESERVADO
  ========================= */
  const reservedElements = [
    "reservedBalance",
    "reserved_balance",
    "saldoReservado"
  ];
  reservedElements.forEach((id) => {
    const elemento =
      document.getElementById(id);
    if (elemento) {
      elemento.textContent =
        formatarDinheiro(
          reservedBalance
        );
    }
  });
  /* =========================
     PROGRESSO DO BÔNUS
  ========================= */
  const progressElements = [
    "bonusWagerProgress",
    "bonus_wager_progress",
    "bonusProgress",
    "progressoBonus"
  ];
  progressElements.forEach((id) => {
    const elemento =
      document.getElementById(id);
    if (elemento) {
      elemento.textContent =
        formatarDinheiro(
          bonusWagerProgress
        );
    }
  });
  /* =========================
     MENSAGEM DO BÔNUS
  ========================= */
  const bonusMessage =
    document.getElementById(
      "bonusMessage"
    );
  if (bonusMessage) {
    const bonusNumero =
      Number(bonusBalance) || 0;
    if (bonusNumero > 0) {
      bonusMessage.textContent =
        `Você possui ${formatarDinheiro(
          bonusNumero
        )} em bônus.`;
    } else {
      bonusMessage.textContent =
        "Você não possui bônus disponível no momento.";
    }
  }
  /* =========================
     GIROS GRÁTIS DA ROLETA
  ========================= */
  const freeSpinElements = [
    "rouletteFreeSpins",
    "roulette_free_spins",
    "freeSpins",
    "girosGratis",
    "girosRoleta"
  ];
  freeSpinElements.forEach((id) => {
    const elemento =
      document.getElementById(id);
    if (elemento) {
      elemento.textContent =
        formatarNumero(
          rouletteFreeSpins
        );
    }
  });
  /* =========================
     VALOR DOS GIROS GRÁTIS
  ========================= */
  const freeSpinBetElements = [
    "rouletteFreeSpinBet",
    "roulette_free_spin_bet",
    "freeSpinBet",
    "valorGiroGratis"
  ];
  freeSpinBetElements.forEach(
    (id) => {
      const elemento =
        document.getElementById(id);
      if (elemento) {
        elemento.textContent =
          formatarDinheiro(
            rouletteFreeSpinBet
          );
      }
    }
  );
  /* =========================
     ATRIBUTOS DATA-USER-FIELD
  ========================= */
  document
    .querySelectorAll(
      "[data-user-field]"
    )
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
          valor =
            formatarDinheiro(
              saldo
            );
          break;
        case "bonusBalance":
        case "bonus_balance":
        case "bonus":
          valor =
            formatarDinheiro(
              bonusBalance
            );
          break;
        case "cashBalance":
        case "cash_balance":
          valor =
            formatarDinheiro(
              cashBalance
            );
          break;
        case "reservedBalance":
        case "reserved_balance":
          valor =
            formatarDinheiro(
              reservedBalance
            );
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
        default:
          valor = "";
      }
      elemento.textContent = valor;
    });
  /* =========================
     ATRIBUTOS DATA-BONUS
  ========================= */
  document
    .querySelectorAll(
      "[data-bonus-balance]"
    )
    .forEach((elemento) => {
      elemento.textContent =
        formatarDinheiro(
          bonusBalance
        );
    });
  /* =========================
     ATRIBUTOS DATA-SALDO
  ========================= */
  document
    .querySelectorAll(
      "[data-user-balance]"
    )
    .forEach((elemento) => {
      elemento.textContent =
        formatarDinheiro(
          saldo
        );
    });
  /* =========================
     ATRIBUTOS DATA-NOME
  ========================= */
  document
    .querySelectorAll(
      "[data-user-name]"
    )
    .forEach((elemento) => {
      elemento.textContent = nome;
    });
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
    const response = await fetch(
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
    /* =========================
       SESSÃO INVÁLIDA
    ========================= */
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
      () => {
        atualizarPerfil();
      },
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
  /*
    Informa ao servidor que a sessão
    do jogador deve ser encerrada.
  */
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
  /*
    Remove os dados locais
    independentemente de o servidor
    responder ou não.
  */
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
window.getUser =
  getUser;
window.getToken =
  getToken;
window.mostrarDadosUsuario =
  mostrarDadosUsuario;
window.atualizarPerfil =
  atualizarPerfil;
window.sair =
  sair;
window.formatarDinheiro =
  formatarDinheiro;
/* =========================
   INICIAR DASHBOARD
========================= */
document.addEventListener(
  "DOMContentLoaded",
  async () => {
    if (!verificarSessao()) {
      return;
    }
    /*
      Mostra imediatamente os dados
      salvos localmente.
    */
    mostrarDadosUsuario();
    /*
      Busca os dados reais e atualizados
      diretamente do servidor.
    */
    await atualizarPerfil();
    /*
      Mantém a página atualizada.
    */
    iniciarAtualizacaoAutomatica();
  }
);

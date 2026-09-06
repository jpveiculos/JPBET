const API_URL = "/api";

/* =========================
   USUÁRIO
========================= */

function getUser() {
  try {
    const user = localStorage.getItem("jpbet_user");

    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error(error);
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
   MOSTRAR DADOS
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

  const userName =
    document.getElementById("userName");

  const welcomeMessage =
    document.getElementById("welcomeMessage");

  const userBalance =
    document.getElementById("userBalance");

  if (userName) {
    userName.textContent = nome;
  }

  if (welcomeMessage) {
    welcomeMessage.textContent =
      `Bem-vindo, ${nome}!`;
  }

  if (userBalance) {
    userBalance.textContent =
      formatarDinheiro(saldo);
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
    const response = await fetch(
      `${API_URL}/auth/me`,
      {
        method: "GET",

        headers: {
          "Authorization": `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      return;
    }

    const data = await response
      .json()
      .catch(() => null);

    if (!data) {
      return;
    }

    const user =
      data.user ||
      data.usuario ||
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
   SAIR
========================= */

function sair() {
  localStorage.removeItem(
    "jpbet_user"
  );

  localStorage.removeItem(
    "jpbet_token"
  );

  window.location.href =
    "index.html";
}


/* =========================
   INICIAR DASHBOARD
========================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    if (!verificarSessao()) {
      return;
    }

    mostrarDadosUsuario();

    atualizarPerfil();
  }
);

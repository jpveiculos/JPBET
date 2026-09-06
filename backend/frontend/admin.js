const API_URL = "/api";

/* =========================
   TOKEN
========================= */

function obterTokenAdmin() {
  return localStorage.getItem("jpbet_token");
}


/* =========================
   USUÁRIO
========================= */

function obterUsuarioAdmin() {
  try {
    const usuario =
      localStorage.getItem("jpbet_user");

    return usuario
      ? JSON.parse(usuario)
      : null;

  } catch (error) {
    console.error(error);
    return null;
  }
}


/* =========================
   REQUISIÇÃO ADMIN
========================= */

async function requisicaoAdmin(
  endpoint,
  options = {}
) {
  const token =
    obterTokenAdmin();

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
      `${API_URL}${endpoint}`,
      {
        ...options,
        headers
      }
    );

  const data =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
      data.error ||
      "Não foi possível concluir a operação."
    );
  }

  return data;
}


/* =========================
   VERIFICAR ADMIN
========================= */

async function verificarAdmin() {
  const token =
    obterTokenAdmin();

  const usuario =
    obterUsuarioAdmin();

  if (!token || !usuario) {
    window.location.href =
      "index.html";

    return false;
  }

  try {
    const data =
      await requisicaoAdmin(
        "/admin"
      );

    return data;

  } catch (error) {
    console.error(error);

    const message =
      document.getElementById(
        "adminMessage"
      );

    if (message) {
      message.textContent =
        "Acesso administrativo não autorizado.";
    }

    setTimeout(() => {
      window.location.href =
        "dashboard.html";
    }, 1200);

    return false;
  }
}


/* =========================
   CARREGAR DASHBOARD ADMIN
========================= */

async function carregarDashboardAdmin() {
  const message =
    document.getElementById(
      "adminMessage"
    );

  try {
    const data =
      await requisicaoAdmin(
        "/admin/dashboard"
      );

    const totalUsers =
      document.getElementById(
        "totalUsers"
      );

    const totalBalance =
      document.getElementById(
        "totalBalance"
      );

    const usuarios =
      data.totalUsers ??
      data.users ??
      data.usuarios ??
      0;

    const saldo =
      data.totalBalance ??
      data.balance ??
      data.saldo ??
      0;

    if (totalUsers) {
      totalUsers.textContent =
        usuarios;
    }

    if (totalBalance) {
      totalBalance.textContent =
        Number(saldo).toLocaleString(
          "pt-BR",
          {
            style: "currency",
            currency: "BRL"
          }
        );
    }

    if (message) {
      message.textContent =
        "Painel carregado.";
    }

  } catch (error) {
    console.error(error);

    if (message) {
      message.textContent =
        error.message ||
        "Não foi possível carregar o painel.";
    }
  }
}


/* =========================
   CONFIGURAÇÕES
========================= */

async function carregarConfiguracoes() {
  const container =
    document.getElementById(
      "settingsContainer"
    );

  if (!container) {
    return;
  }

  try {
    const data =
      await requisicaoAdmin(
        "/admin/settings"
      );

    const settings =
      data.settings ||
      data.config ||
      data.configuracoes ||
      data;

    if (
      !settings ||
      typeof settings !== "object" ||
      Array.isArray(settings)
    ) {
      return;
    }

    container.innerHTML = "";

    Object.entries(settings)
      .forEach(
        ([key, value]) => {

          const row =
            document.createElement(
              "div"
            );

          row.className =
            "setting-row";

          const label =
            document.createElement(
              "label"
            );

          label.textContent =
            key;

          const input =
            document.createElement(
              "input"
            );

          input.type =
            typeof value === "boolean"
              ? "checkbox"
              : "text";

          if (
            typeof value === "boolean"
          ) {
            input.checked = value;
          } else {
            input.value =
              value ?? "";
          }

          input.dataset.key =
            key;

          row.appendChild(label);
          row.appendChild(input);

          container.appendChild(row);
        }
      );

  } catch (error) {
    console.error(error);

    container.innerHTML =
      "<p>Não foi possível carregar as configurações.</p>";
  }
}


/* =========================
   SAIR
========================= */

function sairAdmin() {
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
   INICIALIZAÇÃO
========================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    const autorizado =
      await verificarAdmin();

    if (!autorizado) {
      return;
    }

    await carregarDashboardAdmin();

    await carregarConfiguracoes();
  }
);

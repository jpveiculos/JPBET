const API_URL = "/api";

/* =========================
   SESSÃO ADMINISTRATIVA
========================= */

async function requisicaoAdmin(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include"
  });

  const data = await response.json().catch(() => ({}));

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
   VERIFICAR SESSÃO
========================= */

async function verificarAdmin() {
  try {
    const data = await requisicaoAdmin(
      "/admin-session"
    );

    if (
      data &&
      data.authenticated === true
    ) {
      return true;
    }

    throw new Error(
      "Sessão administrativa inválida."
    );

  } catch (error) {
    console.error(
      "Falha na sessão administrativa:",
      error
    );

    const message =
      document.getElementById("adminMessage");

    if (message) {
      message.textContent =
        "Sessão administrativa inválida. Faça o login novamente.";
    }

    return false;
  }
}

/* =========================
   DASHBOARD
========================= */

async function carregarDashboardAdmin() {
  const message =
    document.getElementById("adminMessage");

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
    console.error(
      "Erro ao carregar dashboard:",
      error
    );

    if (message) {
      message.textContent =
        "Painel administrativo conectado.";
    }
  }
}

/* =========================
   CONFIGURAÇÕES DA HOME
========================= */

const CONFIGURACOES_HOME = {
  home_hero_label:
    "Texto pequeno do topo",

  home_hero_title:
    "Título principal",

  home_hero_description:
    "Descrição principal",

  home_games_label:
    "Texto acima de Jogos",

  home_games_title:
    "Título da seção Jogos",

  home_roulette_title:
    "Nome da Roleta",

  home_roulette_description:
    "Descrição da Roleta",

  home_coming_title:
    "Título dos próximos jogos",

  home_coming_description:
    "Descrição dos próximos jogos",

  home_about_label:
    "Texto pequeno da seção Sobre",

  home_about_title:
    "Título da seção Sobre",

  home_about_description:
    "Descrição da seção Sobre",

  home_cta_title:
    "Título do convite final",

  home_cta_description:
    "Descrição do convite final",

  home_cta_button:
    "Texto do botão Jogar Agora",

  home_footer:
    "Texto do rodapé",

  home_hero_image:
    "Imagem principal da página inicial"
};

let configuracoesAtuais = {};

/* =========================
   CARREGAR CONFIGURAÇÕES
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
      {};

    if (
      !settings ||
      typeof settings !== "object" ||
      Array.isArray(settings)
    ) {
      container.innerHTML =
        "<p>Não foi possível encontrar as configurações.</p>";

      return;
    }

    configuracoesAtuais = {
      ...settings
    };

    renderizarConfiguracoes(
      configuracoesAtuais
    );

  } catch (error) {
    console.error(
      "Erro ao carregar configurações:",
      error
    );

    container.innerHTML =
      "<p>Não foi possível carregar as configurações.</p>";
  }
}

/* =========================
   RENDERIZAR CONFIGURAÇÕES
========================= */

function renderizarConfiguracoes(settings) {
  const container =
    document.getElementById(
      "settingsContainer"
    );

  if (!container) {
    return;
  }

  container.innerHTML = "";

  const tituloHome =
    document.createElement("h3");

  tituloHome.textContent =
    "Página inicial";

  tituloHome.style.margin =
    "25px 0 15px";

  container.appendChild(
    tituloHome
  );

  Object.entries(
    CONFIGURACOES_HOME
  ).forEach(
    ([key, descricao]) => {
      if (
        !Object.prototype.hasOwnProperty.call(
          settings,
          key
        )
      ) {
        return;
      }

      const row =
        document.createElement("div");

      row.className =
        "setting-row";

      const area =
        document.createElement("div");

      area.style.flex = "1";

      const label =
        document.createElement("label");

      label.textContent =
        descricao;

      label.htmlFor =
        `setting-${key}`;

      label.style.display =
        "block";

      label.style.marginBottom =
        "7px";

      const input =
        document.createElement(
          key === "home_hero_image"
            ? "input"
            : "textarea"
        );

      input.id =
        `setting-${key}`;

      input.dataset.key =
        key;

      input.value =
        settings[key] ?? "";

      input.style.width =
        "100%";

      input.style.maxWidth =
        "100%";

      input.style.padding =
        "12px";

      input.style.borderRadius =
        "8px";

      input.style.border =
        "1px solid #303945";

      input.style.background =
        "#0b0f14";

      input.style.color =
        "#fff";

      input.style.resize =
        "vertical";

      if (
        key === "home_hero_image"
      ) {
        input.placeholder =
          "Ex.: assets/lamborghini.png";
      } else {
        input.rows =
          key.includes("description")
            ? 3
            : 2;
      }

      area.appendChild(label);
      area.appendChild(input);

      row.appendChild(area);

      container.appendChild(row);
    }
  );

  const actions =
    document.createElement("div");

  actions.style.marginTop =
    "25px";

  actions.style.display =
    "flex";

  actions.style.justifyContent =
    "flex-end";

  const salvarButton =
    document.createElement("button");

  salvarButton.type =
    "button";

  salvarButton.textContent =
    "Salvar alterações";

  salvarButton.style.border =
    "none";

  salvarButton.style.borderRadius =
    "8px";

  salvarButton.style.padding =
    "14px 24px";

  salvarButton.style.background =
    "#fff";

  salvarButton.style.color =
    "#080b10";

  salvarButton.style.fontWeight =
    "800";

  salvarButton.style.cursor =
    "pointer";

  salvarButton.addEventListener(
    "click",
    salvarConfiguracoes
  );

  actions.appendChild(
    salvarButton
  );

  container.appendChild(
    actions
  );
}

/* =========================
   SALVAR CONFIGURAÇÕES
========================= */

async function salvarConfiguracoes() {
  const container =
    document.getElementById(
      "settingsContainer"
    );

  if (!container) {
    return;
  }

  const inputs =
    container.querySelectorAll(
      "[data-key]"
    );

  const settings = {};

  inputs.forEach(input => {
    settings[input.dataset.key] =
      input.value;
  });

  const button =
    container.querySelector("button");

  if (button) {
    button.disabled = true;
    button.textContent =
      "Salvando...";
  }

  try {
    const data =
      await requisicaoAdmin(
        "/admin/settings",
        {
          method: "PUT",
          body: JSON.stringify({
            settings
          })
        }
      );

    configuracoesAtuais = {
      ...configuracoesAtuais,
      ...settings
    };

    if (button) {
      button.textContent =
        "Salvo com sucesso!";
    }

    const message =
      document.getElementById(
        "adminMessage"
      );

    if (message) {
      message.textContent =
        data.message ||
        "Configurações salvas com sucesso.";
    }

    setTimeout(() => {
      if (button) {
        button.disabled = false;
        button.textContent =
          "Salvar alterações";
      }
    }, 1800);

  } catch (error) {
    console.error(error);

    if (button) {
      button.disabled = false;
      button.textContent =
        "Salvar alterações";
    }

    const message =
      document.getElementById(
        "adminMessage"
      );

    if (message) {
      message.textContent =
        error.message ||
        "Erro ao salvar configurações.";
    }

    alert(
      error.message ||
      "Erro ao salvar configurações."
    );
  }
}

/* =========================
   SAIR
========================= */

async function sairAdmin() {
  try {
    await requisicaoAdmin(
      "/admin-logout",
      {
        method: "POST"
      }
    );
  } catch (error) {
    console.error(
      "Erro ao sair:",
      error
    );
  } finally {
    localStorage.removeItem(
      "jpbet_user"
    );

    localStorage.removeItem(
      "jpbet_token"
    );

    window.location.href =
      "/admin";
  }
}

window.sairAdmin =
  sairAdmin;

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

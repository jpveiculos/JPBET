const API_URL = "/api";

/* =========================
   ABRIR LOGIN
========================= */

function abrirLogin() {
  const modal =
    document.getElementById("loginModal");

  if (!modal) {
    return;
  }

  modal.classList.add("show");

  mostrarLogin();

  setTimeout(() => {
    document
      .getElementById("username")
      ?.focus();
  }, 100);
}


/* =========================
   FECHAR LOGIN
========================= */

function fecharLogin() {
  const modal =
    document.getElementById("loginModal");

  if (modal) {
    modal.classList.remove("show");
  }
}


/* =========================
   MOSTRAR LOGIN
========================= */

function mostrarLogin() {
  const loginForm =
    document.getElementById("loginForm");

  const registerForm =
    document.getElementById("registerForm");

  const loginMessage =
    document.getElementById("loginMessage");

  const registerMessage =
    document.getElementById("registerMessage");


  if (loginForm) {
    loginForm.style.display = "block";
  }

  if (registerForm) {
    registerForm.style.display = "none";
  }

  if (loginMessage) {
    loginMessage.textContent = "";
  }

  if (registerMessage) {
    registerMessage.textContent = "";
  }


  setTimeout(() => {
    document
      .getElementById("username")
      ?.focus();
  }, 100);
}


/* =========================
   MOSTRAR CADASTRO
========================= */

function mostrarCadastro() {
  const loginForm =
    document.getElementById("loginForm");

  const registerForm =
    document.getElementById("registerForm");

  const loginMessage =
    document.getElementById("loginMessage");

  const registerMessage =
    document.getElementById("registerMessage");


  if (loginForm) {
    loginForm.style.display = "none";
  }

  if (registerForm) {
    registerForm.style.display = "block";
  }

  if (loginMessage) {
    loginMessage.textContent = "";
  }

  if (registerMessage) {
    registerMessage.textContent = "";
  }


  setTimeout(() => {
    document
      .getElementById("registerUsername")
      ?.focus();
  }, 100);
}


/* =========================
   LOGIN DO USUÁRIO
========================= */

async function entrar() {

  const username =
    document
      .getElementById("username")
      ?.value
      .trim();

  const password =
    document
      .getElementById("password")
      ?.value;

  const message =
    document.getElementById(
      "loginMessage"
    );


  if (!username || !password) {

    if (message) {
      message.textContent =
        "Digite usuário e senha.";
    }

    return;
  }


  if (message) {
    message.textContent =
      "Entrando...";
  }


  try {

    const response =
      await fetch(
        `${API_URL}/auth/login`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            username,
            password
          })
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
        "Usuário ou senha inválidos."
      );
    }


    /* =========================
       SALVAR USUÁRIO
    ========================= */

    if (data.user) {

      localStorage.setItem(
        "jpbet_user",
        JSON.stringify(data.user)
      );

    }


    /* =========================
       TOKEN
    ========================= */

    if (data.token) {

      localStorage.setItem(
        "jpbet_token",
        data.token
      );

    }


    if (message) {

      message.textContent =
        "Login realizado com sucesso!";

    }


    /* =========================
       REDIRECIONAMENTO
    ========================= */

    setTimeout(() => {

      if (data.redirect) {

        window.location.href =
          data.redirect;

      } else {

        window.location.href =
          "dashboard.html";

      }

    }, 500);


  } catch (error) {

    console.error(error);

    if (message) {

      message.textContent =
        error.message ||
        "Não foi possível entrar.";

    }
  }
}


/* =========================
   CADASTRO DE USUÁRIO
========================= */

async function cadastrar() {

  const username =
    document
      .getElementById(
        "registerUsername"
      )
      ?.value
      .trim();

  const password =
    document
      .getElementById(
        "registerPassword"
      )
      ?.value;

  const passwordConfirm =
    document
      .getElementById(
        "registerPasswordConfirm"
      )
      ?.value;

  const message =
    document.getElementById(
      "registerMessage"
    );


  /* =========================
     VALIDAR CAMPOS
  ========================= */

  if (
    !username ||
    !password ||
    !passwordConfirm
  ) {

    if (message) {

      message.textContent =
        "Preencha todos os campos.";

    }

    return;
  }


  /* =========================
     VALIDAR USUÁRIO
  ========================= */

  if (username.length < 3) {

    if (message) {

      message.textContent =
        "O usuário deve ter pelo menos 3 caracteres.";

    }

    return;
  }


  /* =========================
     VALIDAR SENHA
  ========================= */

  if (password.length < 4) {

    if (message) {

      message.textContent =
        "A senha deve ter pelo menos 4 caracteres.";

    }

    return;
  }


  /* =========================
     CONFIRMAR SENHA
  ========================= */

  if (
    password !== passwordConfirm
  ) {

    if (message) {

      message.textContent =
        "As senhas não são iguais.";

    }

    return;
  }


  if (message) {

    message.textContent =
      "Criando sua conta...";

  }


  try {

    const response =
      await fetch(
        `${API_URL}/auth/register`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            username,
            password
          })
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
        "Não foi possível criar a conta."
      );

    }


    /* =========================
       GUARDAR USUÁRIO
    ========================= */

    if (data.user) {

      localStorage.setItem(
        "jpbet_user",
        JSON.stringify(data.user)
      );

    }


    if (message) {

      message.textContent =
        "Conta criada com sucesso! Entrando...";

    }


    /* =========================
       IR PARA DASHBOARD
    ========================= */

    setTimeout(() => {

      if (data.redirect) {

        window.location.href =
          data.redirect;

      } else {

        window.location.href =
          "dashboard.html";

      }

    }, 700);


  } catch (error) {

    console.error(error);

    if (message) {

      message.textContent =
        error.message ||
        "Não foi possível criar a conta.";

    }
  }
}


/* =========================
   FECHAR CLICANDO FORA
========================= */

document.addEventListener(
  "click",
  (event) => {

    const modal =
      document.getElementById(
        "loginModal"
      );


    if (
      modal &&
      event.target === modal
    ) {

      fecharLogin();

    }

  }
);


/* =========================
   TECLA ESC E ENTER
========================= */

document.addEventListener(
  "keydown",
  (event) => {

    /* =========================
       ESC
    ========================= */

    if (event.key === "Escape") {

      fecharLogin();

    }


    /* =========================
       ENTER
    ========================= */

    if (event.key !== "Enter") {
      return;
    }


    const loginForm =
      document.getElementById(
        "loginForm"
      );

    const registerForm =
      document.getElementById(
        "registerForm"
      );

    const activeElement =
      document.activeElement;


    /* =========================
       ENTER NO LOGIN
    ========================= */

    if (
      loginForm &&
      loginForm.style.display !== "none" &&
      (
        activeElement?.id ===
          "username" ||

        activeElement?.id ===
          "password"
      )
    ) {

      event.preventDefault();

      entrar();

      return;
    }


    /* =========================
       ENTER NO CADASTRO
    ========================= */

    if (
      registerForm &&
      registerForm.style.display !== "none" &&
      (
        activeElement?.id ===
          "registerUsername" ||

        activeElement?.id ===
          "registerPassword" ||

        activeElement?.id ===
          "registerPasswordConfirm"
      )
    ) {

      event.preventDefault();

      cadastrar();

    }

  }
);

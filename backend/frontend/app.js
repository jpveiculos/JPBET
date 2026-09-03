const API_URL = "/api";

function abrirLogin() {
  const modal = document.getElementById("loginModal");

  if (modal) {
    modal.classList.add("show");

    setTimeout(() => {
      document.getElementById("username")?.focus();
    }, 100);
  }
}

function fecharLogin() {
  const modal = document.getElementById("loginModal");

  if (modal) {
    modal.classList.remove("show");
  }
}

async function entrar() {
  const username = document.getElementById("username")?.value.trim();
  const password = document.getElementById("password")?.value;
  const message = document.getElementById("loginMessage");

  if (!username || !password) {
    if (message) {
      message.textContent = "Digite usuário e senha.";
    }
    return;
  }

  if (message) {
    message.textContent = "Entrando...";
  }

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || data.error || "Usuário ou senha inválidos.");
    }

    if (data.token) {
      localStorage.setItem("jpbet_token", data.token);
    }

    if (message) {
      message.textContent = "Login realizado com sucesso!";
    }

    setTimeout(() => {
      if (data.redirect) {
        window.location.href = data.redirect;
      } else {
        window.location.href = "dashboard.html";
      }
    }, 500);

  } catch (error) {
    console.error(error);

    if (message) {
      message.textContent = error.message || "Não foi possível entrar.";
    }
  }
}

document.addEventListener("click", (event) => {
  const modal = document.getElementById("loginModal");

  if (modal && event.target === modal) {
    fecharLogin();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    fecharLogin();
  }

  if (event.key === "Enter") {
    const modal = document.getElementById("loginModal");

    if (modal?.classList.contains("show")) {
      const activeElement = document.activeElement;

      if (
        activeElement?.id === "username" ||
        activeElement?.id === "password"
      ) {
        entrar();
      }
    }
  }
});

const API_URL = "";

function abrirLogin() {
  document.getElementById("loginModal").classList.add("active");
  document.getElementById("loginMessage").textContent = "";
}

function fecharLogin() {
  document.getElementById("loginModal").classList.remove("active");
}

async function entrar() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const message = document.getElementById("loginMessage");

  if (!username || !password) {
    message.textContent = "Informe usuário e senha.";
    return;
  }

  message.textContent = "Conectando...";

  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      message.textContent = data.message || "Usuário ou senha inválidos.";
      return;
    }

    localStorage.setItem("jpbet_user", JSON.stringify(data.user));

    message.textContent = "Login realizado!";

    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 500);

  } catch (error) {
    console.error(error);
    message.textContent =
      "Não foi possível conectar ao servidor.";
  }
}

document.getElementById("loginModal").addEventListener("click", (event) => {
  if (event.target.id === "loginModal") {
    fecharLogin();
  }
});

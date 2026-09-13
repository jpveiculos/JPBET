const API_URL = "/api";

function sessaoJogadorAtiva() {
  return !!localStorage.getItem("jpbet_user");
}

function destinoJogo(gameId) {
  const id = String(gameId || "").trim();
  if (!id || id === "roulette") return "/dashboard.html";
  return `/games.html?game=${encodeURIComponent(id)}`;
}

function abrirJogoComLogin(gameId) {
  const destino = destinoJogo(gameId);

  if (sessaoJogadorAtiva()) {
    window.location.href = destino;
    return;
  }

  localStorage.setItem("jpbet_pending_game", destino);
  abrirLogin();
}

function abrirLogin() {
  if (sessaoJogadorAtiva()) {
    window.location.href = "/dashboard.html";
    return;
  }
  const modal = document.getElementById("loginModal");
  if (!modal) return;
  modal.classList.add("show");
  mostrarLogin();
  setTimeout(() => document.getElementById("username")?.focus(), 100);
}

function fecharLogin() {
  const modal = document.getElementById("loginModal");
  if (modal) modal.classList.remove("show");
}

function mostrarLogin() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginMessage = document.getElementById("loginMessage");
  const registerMessage = document.getElementById("registerMessage");
  if (loginForm) loginForm.style.display = "block";
  if (registerForm) registerForm.style.display = "none";
  if (loginMessage) loginMessage.textContent = "";
  if (registerMessage) registerMessage.textContent = "";
  setTimeout(() => document.getElementById("username")?.focus(), 100);
}

function mostrarCadastro() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginMessage = document.getElementById("loginMessage");
  const registerMessage = document.getElementById("registerMessage");
  if (loginForm) loginForm.style.display = "none";
  if (registerForm) registerForm.style.display = "block";
  if (loginMessage) loginMessage.textContent = "";
  if (registerMessage) registerMessage.textContent = "";
  setTimeout(() => document.getElementById("registerUsername")?.focus(), 100);
}

function redirecionarDepoisDoLogin() {
  const destino = localStorage.getItem("jpbet_pending_game");
  localStorage.removeItem("jpbet_pending_game");
  window.location.href = destino || "/dashboard.html";
}

async function entrar() {
  const username = document.getElementById("username")?.value.trim();
  const password = document.getElementById("password")?.value;
  const message = document.getElementById("loginMessage");
  if (!username || !password) { if (message) message.textContent = "Digite usuário e senha."; return; }
  if (message) message.textContent = "Entrando...";
  try {
    const response = await fetch(`${API_URL}/auth/login`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.message || data.error || "Usuário ou senha inválidos.");
    if (data.user) localStorage.setItem("jpbet_user",JSON.stringify(data.user));
    if (data.token) localStorage.setItem("jpbet_token",data.token);
    if (message) message.textContent = "Login realizado com sucesso!";
    setTimeout(redirecionarDepoisDoLogin,500);
  } catch(error) { console.error(error); if(message) message.textContent=error.message||"Não foi possível entrar."; }
}

async function cadastrar() {
  const username=document.getElementById("registerUsername")?.value.trim();
  const password=document.getElementById("registerPassword")?.value;
  const passwordConfirm=document.getElementById("registerPasswordConfirm")?.value;
  const message=document.getElementById("registerMessage");
  if(!username||!password||!passwordConfirm){if(message)message.textContent="Preencha todos os campos.";return;}
  if(username.length<3){if(message)message.textContent="O usuário deve ter pelo menos 3 caracteres.";return;}
  if(password.length<4){if(message)message.textContent="A senha deve ter pelo menos 4 caracteres.";return;}
  if(password!==passwordConfirm){if(message)message.textContent="As senhas não são iguais.";return;}
  if(message)message.textContent="Criando sua conta...";
  try{
    const response=await fetch(`${API_URL}/auth/register`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message||data.error||"Não foi possível criar a conta.");
    if(data.user)localStorage.setItem("jpbet_user",JSON.stringify(data.user));
    if(data.token)localStorage.setItem("jpbet_token",data.token);
    if(message)message.textContent="Conta criada com sucesso! Entrando...";
    setTimeout(redirecionarDepoisDoLogin,700);
  }catch(error){console.error(error);if(message)message.textContent=error.message||"Não foi possível criar a conta.";}
}

document.addEventListener("click",event=>{const modal=document.getElementById("loginModal");if(modal&&event.target===modal)fecharLogin();});
document.addEventListener("keydown",event=>{if(event.key==="Escape")fecharLogin();if(event.key!=="Enter")return;const loginForm=document.getElementById("loginForm"),registerForm=document.getElementById("registerForm"),activeElement=document.activeElement;if(loginForm&&loginForm.style.display!=="none"&&(activeElement?.id==="username"||activeElement?.id==="password")){event.preventDefault();entrar();return;}if(registerForm&&registerForm.style.display!=="none"&&(activeElement?.id==="registerUsername"||activeElement?.id==="registerPassword"||activeElement?.id==="registerPasswordConfirm")){event.preventDefault();cadastrar();}});

document.addEventListener("DOMContentLoaded",()=>{
  const user=localStorage.getItem("jpbet_user");
  const brand=document.querySelector(".brand");
  const footerBrand=document.querySelector(".footer-brand");
  if(brand){brand.setAttribute("href","/");brand.onclick=()=>{window.location.href="/";return false;};}
  if(footerBrand){footerBrand.setAttribute("role","link");footerBrand.setAttribute("tabindex","0");footerBrand.style.cursor="pointer";footerBrand.onclick=()=>{window.location.href="/";};footerBrand.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();window.location.href="/";}};}

  const params=new URLSearchParams(window.location.search);
  const pendingFromUrl=params.get("game");
  if(params.get("login")==="1" && pendingFromUrl && !user){
    localStorage.setItem("jpbet_pending_game",destinoJogo(pendingFromUrl));
    abrirLogin();
    return;
  }

  if(!user)return;
  const accountButton=document.getElementById("homeAccountButton");
  const platformButton=document.getElementById("heroPlatformButton");
  const registerButton=document.getElementById("heroRegisterButton");
  const rouletteButton=document.getElementById("rouletteHomeButton");
  if(accountButton){accountButton.textContent="MINHA CONTA";accountButton.onclick=()=>window.location.href="/dashboard.html";}
  if(platformButton){platformButton.innerHTML="IR PARA MINHA CONTA <span>→</span>";platformButton.onclick=()=>window.location.href="/dashboard.html";}
  if(registerButton){registerButton.textContent="CONTINUAR JOGANDO";registerButton.onclick=()=>window.location.href="/dashboard.html";}
  if(rouletteButton){rouletteButton.onclick=()=>window.location.href="/dashboard.html";}
});

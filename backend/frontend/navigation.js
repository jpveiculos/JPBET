(() => {
  function voltarPagina() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  }

  function instalarBotaoVoltar() {
    if (document.querySelector(".global-back-button, .header-back, .stage-back")) return;

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "global-back-button";
    botao.textContent = "← Voltar";
    botao.setAttribute("aria-label", "Voltar para a página anterior");
    botao.addEventListener("click", voltarPagina);
    document.body.appendChild(botao);

    const style = document.createElement("style");
    style.textContent = `
      .global-back-button {
        position: fixed;
        left: 14px;
        bottom: 16px;
        z-index: 9999;
        border: 1px solid rgba(245,197,66,.35);
        border-radius: 12px;
        padding: 10px 14px;
        background: rgba(12,14,19,.94);
        color: #ffd75c;
        font: 800 14px Arial, sans-serif;
        box-shadow: 0 8px 24px rgba(0,0,0,.35);
        backdrop-filter: blur(10px);
      }
      .global-back-button:active { transform: scale(.96); }
    `;
    document.head.appendChild(style);
  }

  window.voltarPaginaMyBets = voltarPagina;
  document.addEventListener("DOMContentLoaded", instalarBotaoVoltar);
})();

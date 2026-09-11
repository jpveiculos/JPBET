(() => {
  function voltarPagina() {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/";
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
      .global-back-button{position:fixed;left:14px;bottom:16px;z-index:9999;border:1px solid rgba(245,197,66,.35);border-radius:12px;padding:10px 14px;background:rgba(12,14,19,.94);color:#ffd75c;font:800 14px Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);backdrop-filter:blur(10px)}
      .global-back-button:active{transform:scale(.96)}
    `;
    document.head.appendChild(style);
  }

  function aplicarModeloJogador() {
    if (!document.querySelector(".container") || !document.querySelector(".games")) return;
    if (document.documentElement.dataset.mybetsPlayerDesign === "1") return;
    document.documentElement.dataset.mybetsPlayerDesign = "1";

    const style = document.createElement("style");
    style.textContent = `
      .mybets-logo{display:inline-flex!important;align-items:baseline;position:relative;text-decoration:none!important;font-style:italic!important;font-weight:1000!important;letter-spacing:-2px!important;line-height:1!important}
      .mybets-logo span{color:#f4f4f4!important}.mybets-logo b{color:#f5c542!important;font-weight:1000}.mybets-logo:after{content:"";position:absolute;left:18%;right:0;bottom:-7px;height:4px;background:#f5c542;border-radius:50%;transform:skewX(-18deg)}
      .player-back-button{border:1px solid rgba(245,197,66,.45)!important;background:#171710!important;color:#ffd75c!important;border-radius:16px!important;width:82px!important;height:54px!important;font-size:29px!important;font-weight:900!important;cursor:pointer}
      .welcome p{margin:8px 0 0;color:#9ca3af;font-size:clamp(18px,4.6vw,25px)}
      .balance-card{padding:18px!important;background:linear-gradient(145deg,rgba(41,35,18,.9),rgba(19,19,16,.96))!important}
      .balance-summary{display:grid!important;grid-template-columns:1fr 1fr;gap:12px}
      .balance-stat{min-width:0;padding:17px 14px!important;border-radius:18px!important;background:rgba(255,255,255,.025)!important;border:1px solid rgba(245,197,66,.55)!important;display:flex!important;align-items:center;gap:12px}
      .balance-stat>div{min-width:0}.balance-stat span:not(.balance-icon){display:block;color:#a7adb8;font-size:16px;margin-bottom:4px}.balance-stat strong{display:block;color:#ffd34d;font-size:clamp(27px,7vw,39px);font-weight:1000;white-space:nowrap}.bonus-stat strong{color:#e3b32d}
      .balance-icon{width:44px;height:44px;display:grid;place-items:center;flex:0 0 44px;font-size:30px}.wallet-icon{color:#4df0b1;border:2px solid #4df0b1;border-radius:9px;font-size:22px}
      .balance-actions{display:grid!important;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.balance-actions button{min-height:64px!important;border-radius:17px!important;font-size:24px!important;font-weight:900!important}.action-icon{font-size:30px;vertical-align:-2px;margin-right:6px}
      .roulette-section-heading{display:flex;align-items:end;justify-content:space-between;gap:10px}.roulette-section-heading>span{color:#d9a923;font-size:14px;font-weight:900;letter-spacing:1.5px;padding-bottom:8px;text-align:right}
      .games{grid-template-columns:1fr!important;gap:18px}.roulette-feature-card{padding:0 0 16px!important;overflow:hidden;border:1px solid rgba(245,197,66,.75)!important;background:linear-gradient(145deg,#17130a,#090b0e 60%,#111)!important}
      .roulette-promo{min-height:355px;display:grid;grid-template-columns:42% 58%;align-items:center;padding:12px 18px 0;background:linear-gradient(120deg,#17140d,#0b0d10 55%,#12120f)}
      .roulette-promo-copy{align-self:center;position:relative;height:100%;display:flex;flex-direction:column;justify-content:center}.roulette-brand{font-size:39px;line-height:.9;font-weight:1000;font-style:italic}.roulette-brand i{display:block;color:#f5bd35}.roulette-brand strong{display:block;color:#f4f4f4}.roulette-promo-copy p{color:#bfc3cb;font-size:13px;line-height:1.35;font-weight:800;margin:20px 0 0}
      .chip-stack{position:absolute;bottom:5px;left:8px;width:120px;height:45px}.chip-stack span{position:absolute;width:55px;height:14px;border:3px solid #dba82b;border-radius:50%;background:#17120a;box-shadow:0 4px 0 #8d6515}.chip-stack span:nth-child(1){left:5px;bottom:4px}.chip-stack span:nth-child(2){left:38px;bottom:14px}.chip-stack span:nth-child(3){left:70px;bottom:3px}
      .roulette-art{position:relative;display:grid;place-items:center;height:100%}.roulette-pointer{position:absolute;top:0;z-index:5;color:#e51e25;font-size:42px;line-height:1;text-shadow:none}.roulette-wheel-art{position:relative;width:min(250px,45vw);aspect-ratio:1;border-radius:50%;border:10px solid #b77b0b;background:conic-gradient(#080808 0deg 22.5deg,#dca728 22.5deg 45deg,#080808 45deg 67.5deg,#dca728 67.5deg 90deg,#080808 90deg 112.5deg,#dca728 112.5deg 135deg,#080808 135deg 157.5deg,#dca728 157.5deg 180deg,#080808 180deg 202.5deg,#dca728 202.5deg 225deg,#080808 225deg 247.5deg,#dca728 247.5deg 270deg,#080808 270deg 292.5deg,#dca728 292.5deg 315deg,#080808 315deg 337.5deg,#dca728 337.5deg 360deg);box-shadow:0 0 0 5px #6c4709,0 7px 15px rgba(0,0,0,.5)}
      .roulette-wheel-art:before{content:"";position:absolute;inset:9%;border-radius:50%;border:2px solid rgba(255,220,100,.7)}.wheel-label{position:absolute;color:#54f2b1;font-size:clamp(21px,5vw,31px);font-weight:1000;text-shadow:none;z-index:2}.label-3x{top:25%;left:18%}.label-5x{top:25%;right:17%}.label-2x{bottom:22%;left:19%}.label-10x{bottom:22%;right:14%}
      .wheel-center{position:absolute;z-index:4;left:50%;top:50%;transform:translate(-50%,-50%);width:38%;aspect-ratio:1;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle,#282828,#050505 72%);border:5px solid #c9901b;box-shadow:none}.wheel-center b{font-size:clamp(12px,3vw,18px);font-style:italic;color:#f4f4f4}.wheel-center b span{color:#f2bd38}.wheel-center strong{font-size:clamp(11px,2.8vw,16px);color:#ffd34d;margin-top:2px}
      .roulette-feature-card h3{padding:0 18px;margin:10px 0 12px;font-size:26px}.roulette-feature-card .game-button{margin:0 18px;width:calc(100% - 36px);min-height:62px;border-radius:18px;font-size:25px;font-weight:1000}
      @media(max-width:600px){.player-back-button{width:80px!important;height:54px!important}.roulette-promo{min-height:315px;padding:8px 8px 0}.roulette-brand{font-size:30px}.roulette-promo-copy p{font-size:11px;margin-top:15px}.roulette-wheel-art{width:min(220px,48vw)}.roulette-feature-card h3{font-size:23px}.balance-stat{padding:15px 10px!important;gap:8px}.balance-icon{width:36px;height:36px;flex-basis:36px;font-size:25px}.balance-stat strong{font-size:clamp(24px,7vw,33px)}}
    `;
    document.head.appendChild(style);

    const logo = document.querySelector(".logo");
    if (logo) {
      logo.outerHTML = '<a class="logo mybets-logo" href="/" aria-label="MyBets início"><span>My</span><b>Bets</b></a>';
    }

    document.querySelectorAll(".header-balance, #headerBalance").forEach(el => {
      if (el.classList.contains("header-balance") || el.tagName === "SPAN") el.style.display = "none";
    });

    const header = document.querySelector(".header");
    if (header && !header.querySelector(".player-back-button")) {
      const btn = document.createElement("button");
      btn.className = "player-back-button";
      btn.type = "button";
      btn.textContent = "←";
      btn.setAttribute("aria-label", "Voltar");
      btn.onclick = voltarPagina;
      const right = header.querySelector(".header-right");
      header.insertBefore(btn, right || null);
    }

    const welcome = document.querySelector(".welcome");
    if (welcome) welcome.innerHTML = '<h1>Olá, <span id="userName">Jogador</span> 👋</h1><p>Bora jogar? Boa sorte!</p>';

    const balance = document.querySelector(".balance-card");
    if (balance) balance.innerHTML = `
      <div class="balance-summary">
        <div class="balance-stat balance-main-stat"><span class="balance-icon wallet-icon">▣</span><div><span>Saldo</span><strong id="mainBalance">0,00</strong></div></div>
        <div class="balance-stat bonus-stat"><span class="balance-icon bonus-icon">🎁</span><div><span>Bônus</span><strong id="bonusBalanceValue">R$ 0,00</strong></div></div>
      </div>
      <div class="balance-actions">
        <button class="primary-button" onclick="abrirDeposito()"><span class="action-icon">+</span> Depositar</button>
        <button class="secondary-button" onclick="abrirSaque()"><span class="action-icon">♜</span> Sacar</button>
      </div>`;

    const title = document.querySelector(".section-title");
    if (title && title.textContent.includes("Roletas")) {
      const heading = title.parentElement;
      if (!heading.classList.contains("roulette-section-heading")) {
        const wrap = document.createElement("div");
        wrap.className = "roulette-section-heading";
        title.replaceWith(wrap);
        wrap.appendChild(title);
        const tag = document.createElement("span");
        tag.textContent = "GIRE E MULTIPLIQUE";
        wrap.appendChild(tag);
      }
    }

    const game = document.querySelector(".games .game-card");
    if (game) {
      game.className = "game-card roulette-feature-card";
      game.innerHTML = `
        <div class="roulette-promo">
          <div class="roulette-promo-copy"><div class="roulette-brand"><i>Roleta</i><strong>MyBets</strong></div><p>GIRE, DIVIRTA-SE<br>E MULTIPLIQUE<br>SUAS CHANCES!</p><div class="chip-stack"><span></span><span></span><span></span></div></div>
          <div class="roulette-art"><div class="roulette-pointer">▼</div><div class="roulette-wheel-art"><div class="wheel-label label-3x">3X</div><div class="wheel-label label-5x">5X</div><div class="wheel-label label-2x">2X</div><div class="wheel-label label-10x">10X</div><div class="wheel-center"><b>My<span>Bets</span></b><strong>GIRAR</strong></div></div></div>
        </div>
        <h3>Roleta MyBets</h3>
        <button class="game-button" onclick="abrirRoleta('sorte')">▶&nbsp;&nbsp; JOGAR</button>`;
    }
  }

  window.voltarPaginaMyBets = voltarPagina;
  document.addEventListener("DOMContentLoaded", () => {
    instalarBotaoVoltar();
    aplicarModeloJogador();
  });
})();

(() => {
  function addManifest() {
    if (location.pathname !== "/admin-settings.html") return;
    const manifest = document.createElement("link");
    manifest.rel = "manifest";
    manifest.href = "/admin-manifest.json";
    document.head.appendChild(manifest);
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/svg+xml";
    icon.href = "/assets/admin-icon.svg";
    document.head.appendChild(icon);
  }

  async function atualizarReservaJogador() {
    if (location.pathname !== "/dashboard.html") return;
    const user = (() => { try { return JSON.parse(localStorage.getItem("jpbet_user") || "null"); } catch (_) { return null; } })();
    if (!user?.id) return;
    let card = document.getElementById("reservedBalanceCard");
    if (!card) {
      const playerCard = document.querySelector(".player-card");
      if (!playerCard) return;
      card = document.createElement("div");
      card.id = "reservedBalanceCard";
      card.style.cssText = "margin-top:12px;padding:16px;border-radius:16px;background:linear-gradient(145deg,#17120a,#0b0d12);border:1px solid rgba(245,197,66,.28);box-shadow:0 8px 22px rgba(0,0,0,.25)";
      card.innerHTML = '<div style="color:#aeb5c2;font-size:13px">Saldo reservado</div><div id="reservedBalanceValue" style="font-size:27px;font-weight:900;color:#ffd84a;margin-top:4px">R$ 0,00</div><div id="reservedBalanceText" style="color:#9aa3b0;font-size:12px;margin-top:5px">Nenhum valor reservado para saque.</div>';
      playerCard.insertAdjacentElement("afterend", card);
    }
    try {
      const r = await fetch(`/api/account/${encodeURIComponent(user.id)}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      const u = d.user || d.account || d;
      const reserved = Number(u.reservedBalance || 0);
      const value = document.getElementById("reservedBalanceValue");
      const text = document.getElementById("reservedBalanceText");
      if (value) value.textContent = "R$ " + reserved.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (text) text.textContent = reserved > 0 ? "Valor separado para saque e indisponível para novas apostas ou outro saque." : "Nenhum valor reservado para saque.";
    } catch (_) {}
  }

  function instalarPagamentosAdmin() {
    if (location.pathname !== "/admin.html") return;
    const panel = document.getElementById("panel");
    if (!panel || document.getElementById("approvedWithdrawalsCard")) return;
    const card = document.createElement("section");
    card.id = "approvedWithdrawalsCard";
    card.className = "card";
    card.innerHTML = '<div class="section-title"><h2>💸 Saques aprovados — aguardando pagamento</h2><button class="btn btn-dark" onclick="window.carregarPagamentosAprovados && window.carregarPagamentosAprovados()">🔄</button></div><div class="muted">Depois de fazer o pagamento, use o botão abaixo para retirar o valor da reserva do jogador.</div><div id="approvedWithdrawalsList" class="request-list" style="margin-top:12px"><div class="empty">Carregando...</div></div>';
    panel.appendChild(card);
    window.carregarPagamentosAprovados = async function() {
      const list = document.getElementById("approvedWithdrawalsList");
      if (!list) return;
      try {
        const r = await fetch("/api/admin/withdrawals", { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.message || "Erro ao carregar saques aprovados.");
        const items = (d.withdrawals || []).filter(w => w.status === "approved");
        if (!items.length) { list.innerHTML = '<div class="empty">✅ Nenhum saque aprovado aguardando pagamento.</div>'; return; }
        list.innerHTML = items.map(w => `<article class="request"><div class="request-head"><div><div class="player">👤 ${escSafe(w.username)}</div><div class="id">Saque #${w.id} · Jogador #${w.user_id}</div></div><div class="amount">${moedaSafe(w.amount)}</div></div><div class="info"><div><b>Status:</b> <span class="status">APROVADO — AGUARDANDO PAGAMENTO</span></div><div><b>Chave Pix:</b> ${escSafe(w.pix_key || "Não informada")}</div><div><b>Aprovado em:</b> ${dataSafe(w.approved_at)}</div></div><div class="actions approve-complete"><button class="btn btn-green" onclick="confirmarPagamentoSaque(${w.id})">💸 PAGAMENTO FEITO — RETIRAR DA RESERVA</button></div></article>`).join("");
      } catch (e) { list.innerHTML = `<div class="empty">${escSafe(e.message)}</div>`; }
    };
    window.confirmarPagamentoSaque = async function(id) {
      if (!confirm("Confirma que o Pix foi pago? O valor será retirado definitivamente da reserva do jogador.")) return;
      try {
        const r = await fetch(`/api/admin/withdrawals/${id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" } });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.message || "Não foi possível concluir o saque.");
        alert(d.message || "Pagamento registrado e reserva retirada.");
        window.carregarPagamentosAprovados();
      } catch (e) { alert(e.message || "Erro ao concluir pagamento."); }
    };
    function escSafe(v) { return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
    function moedaSafe(v) { return Number(v || 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" }); }
    function dataSafe(v) { try { return new Date(v).toLocaleString("pt-BR"); } catch (_) { return v || "-"; } }
    window.carregarPagamentosAprovados();
  }

  function carregarInterfaceDeposito() {
    if (location.pathname !== "/dashboard.html") return;
    if (document.getElementById("deposit-ui-script")) return;
    const script = document.createElement("script");
    script.id = "deposit-ui-script";
    script.src = "/deposit-ui.js?v=1";
    document.body.appendChild(script);
  }

  addManifest();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { atualizarReservaJogador(); instalarPagamentosAdmin(); carregarInterfaceDeposito(); });
  else { atualizarReservaJogador(); instalarPagamentosAdmin(); carregarInterfaceDeposito(); }
})();

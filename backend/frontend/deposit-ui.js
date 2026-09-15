(() => {
  if (location.pathname !== "/dashboard.html") return;
  let pix = { key: "", keyType: "", receiver: "", city: "", description: "" };
  let loaded = false;
  function crc16(str) { let crc = 0xFFFF; for (let i = 0; i < str.length; i++) { crc ^= str.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF; } return crc.toString(16).toUpperCase().padStart(4, "0"); }
  function tlv(id, value) { const v = String(value ?? ""); return id + String(v.length).padStart(2, "0") + v; }
  function montarPix(valor) {
    const key = String(pix.key || "").trim(); if (!key) return "";
    const nome = String(pix.receiver || "MyBets").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 25) || "MYBETS";
    const cidade = String(pix.city || "BRASILIA").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 15) || "BRASILIA";
    const desc = String(pix.description || "MyBets").replace(/[^A-Za-z0-9 ]/g, "").slice(0, 20);
    const gui = tlv("00", "BR.GOV.BCB.PIX") + tlv("01", tlv("01", key) + (desc ? tlv("02", desc) : ""));
    let payload = tlv("00", "01") + tlv("26", gui) + tlv("52", "0000") + tlv("53", "986");
    const amount = Number(valor || 0); if (amount > 0) payload += tlv("54", amount.toFixed(2));
    payload += tlv("58", "BR") + tlv("59", nome) + tlv("60", cidade) + tlv("62", tlv("05", "***")) + "6304";
    return payload + crc16(payload);
  }
  function qrUrl(code) { return "https://quickchart.io/qr?size=320&margin=2&ecLevel=M&text=" + encodeURIComponent(code || ""); }
  async function carregarPix() { if (loaded) return; try { const r = await fetch("/api/settings/public", { cache: "no-store" }); const d = await r.json(); const s = d.settings || {}; pix = { key: s.pix_key || "", keyType: s.pix_key_type || "", receiver: s.pix_receiver_name || "MyBets", city: s.pix_city || "Brasilia", description: s.pix_description || "MyBets" }; loaded = true; } catch (_) {} }
  function abrir() {
    let modal = document.getElementById("depositModal");
    if (!modal) {
      modal = document.createElement("div"); modal.id = "depositModal"; modal.style.cssText = "position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(0,0,0,.86);overflow:auto";
      modal.innerHTML = `<div style="width:min(560px,100%);max-height:94vh;overflow:auto;padding:20px 15px;border-radius:22px;background:#0b1119;border:1px solid rgba(245,197,66,.25);box-shadow:0 20px 60px rgba(0,0,0,.6);color:#fff;text-align:center"><button id="depositPixClose" style="float:right;width:44px;height:44px;border:0;border-radius:13px;background:#151d27;color:#fff;font-size:28px">×</button><h2 style="margin:5px 45px 5px;color:#ffdc60;font-size:27px">💰 Depositar via Pix</h2><p style="color:#aeb5c2;margin:0 0 14px">Escaneie o QR Code ou copie o código Pix.</p><div style="background:#fff;border-radius:16px;padding:10px;width:250px;height:250px;margin:0 auto"><img id="depositQr" alt="QR Code Pix" style="width:100%;height:100%;display:block"></div><label style="display:block;text-align:left;margin-top:16px;font-weight:900;color:#fff">Valor que você vai enviar no Pix</label><input id="depositAmount" class="field" type="number" min="1" step="0.01" placeholder="R$ 0,00" style="width:100%;padding:14px;border-radius:13px;border:1px solid rgba(245,197,66,.25);background:#090b10;color:#fff;margin-top:8px;font-size:18px"><div style="text-align:left;margin-top:9px;color:#9aa3b0;font-size:13px;line-height:1.45">Digite exatamente o valor que você pretende enviar. Esse valor ficará registrado no pedido para conferência.</div><button id="copyPixCode" style="width:100%;height:48px;margin-top:13px;border:1px solid rgba(245,197,66,.5);border-radius:13px;background:#151d27;color:#fff;font-weight:900">📋 COPIAR CÓDIGO PIX</button><button id="sendDeposit" style="width:100%;height:50px;margin-top:10px;border:0;border-radius:13px;background:linear-gradient(180deg,#ffe47b,#e0a51a);color:#07090d;font-weight:900">JÁ ENVIEI — SOLICITAR CONFERÊNCIA</button><div id="depositPixMessage" style="min-height:24px;margin-top:10px;color:#ffcf3f;font-size:13px"></div><div style="text-align:left;margin-top:13px;padding:12px;border-radius:12px;background:#121923;color:#aeb5c2;font-size:12px;line-height:1.45">O saldo só será liberado após a conferência do administrador. Se o extrato mostrar valor diferente, o administrador deverá considerar somente o valor realmente recebido.</div></div>`;
      document.body.appendChild(modal);
      document.getElementById("depositPixClose").onclick = () => modal.remove();
      modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
      document.getElementById("depositAmount").addEventListener("input", atualizar);
      document.getElementById("copyPixCode").onclick = copiar;
      document.getElementById("sendDeposit").onclick = enviar;
    }
    modal.style.display = "flex"; carregarPix().then(atualizar); const amount = document.getElementById("depositAmount"); if (amount) { amount.value = ""; amount.focus(); } atualizar();
  }
  function atualizar() { const input = document.getElementById("depositAmount"), img = document.getElementById("depositQr"); if (!input || !img) return; const code = montarPix(Number(input.value || 0)); img.src = code ? qrUrl(code) : qrUrl(montarPix(0)); img.style.opacity = code ? "1" : ".45"; img.dataset.pixCode = code; }
  async function copiar() { const code = document.getElementById("depositQr")?.dataset.pixCode || montarPix(0), msg = document.getElementById("depositPixMessage"); if (!code) { if (msg) msg.textContent = "A chave Pix ainda não está configurada."; return; } try { await navigator.clipboard.writeText(code); if (msg) msg.textContent = "✅ Código Pix copiado."; } catch (_) { if (msg) msg.textContent = "Não foi possível copiar automaticamente. Use o QR Code."; } }
  async function enviar() {
    const amount = Number(document.getElementById("depositAmount")?.value || 0), msg = document.getElementById("depositPixMessage");
    if (!Number.isFinite(amount) || amount <= 0) { if (msg) msg.textContent = "Informe o valor que você vai enviar no Pix."; return; }
    const old = window.requestDeposit;
    if (typeof old !== "function") { if (msg) msg.textContent = "Não foi possível abrir o pedido de depósito."; return; }
    try { await old(); const modal = document.getElementById("depositModal"); if (modal) modal.remove(); } catch (_) {}
  }
  window.openDeposit = abrir;
})();

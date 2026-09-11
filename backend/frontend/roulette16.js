/* My Bets — Roleta visual de 16 fatias.
 * Compatibilidade: o servidor antigo continua usando 20 posições,
 * mas as posições 16–19 são reservadas com peso 0. Assim a roleta
 * operacional fica realmente com 16 resultados visíveis.
 */
(function () {
  const SEGMENTS = [
    { label: "2X", type: "prize", multiplier: 2 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "3X", type: "prize", multiplier: 3 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "2X", type: "prize", multiplier: 2 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "5X", type: "prize", multiplier: 5 }
  ];

  function $(id) { return document.getElementById(id); }
  function numero(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  function moeda(v) {
    return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  function user() {
    try { return JSON.parse(localStorage.getItem("jpbet_user") || "null") || {}; }
    catch (_) { return {}; }
  }

  window.criarRoletaSorte = function () {
    const wheel = $("rouletteWheel");
    if (!wheel) return;

    const angle = 360 / SEGMENTS.length;
    wheel.innerHTML = "";

    SEGMENTS.forEach((seg, i) => {
      const el = document.createElement("span");
      el.className = `roulette-label ${seg.type === "zero" ? "zero" : "prize"}`;
      el.textContent = seg.label;
      const mid = i * angle + angle / 2;
      el.style.transform = `translate(-50%,-50%) rotate(${mid}deg) translateY(-40%) rotate(${-mid}deg)`;
      el.dataset.index = String(i);
      wheel.appendChild(el);
    });

    const faixas = SEGMENTS.map((seg, i) => {
      const color = seg.type === "prize" ? "#d4af37" : (i % 2 ? "#111111" : "#242424");
      return `${color} ${i * angle}deg ${(i + 1) * angle}deg`;
    });

    wheel.style.background = `
      repeating-conic-gradient(
        from -${angle / 2}deg,
        transparent 0deg ${angle - 1.15}deg,
        rgba(255,221,105,.9) ${angle - 1.15}deg ${angle}deg
      ),
      conic-gradient(from -${angle / 2}deg, ${faixas.join(",")})
    `;
  };

  function prepararPonteiro() {
    const machine = document.querySelector(".custom-roulette-machine");
    if (!machine) return;
    let pointer = machine.querySelector(".roulette-pointer");
    if (!pointer) {
      pointer = document.createElement("div");
      pointer.className = "roulette-pointer";
      machine.insertBefore(pointer, machine.firstChild);
    }
    pointer.setAttribute("aria-hidden", "true");
  }

  window.girarRoleta = async function () {
    if (window.__myBetsRouletteSpinning) return;

    const u = user();
    const userId = u?.id ?? u?.userId ?? null;
    if (!userId) return window.mostrarToast?.("Faça login novamente.");

    const config = {};
    const hasFree = numero(u.rouletteFreeSpins, 0) > 0 && numero(u.rouletteFreeSpinBet, 0) > 0;
    const textoAposta = $("rouletteBetValue")?.textContent || "";
    const apostaDaTela = Number(textoAposta.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", "."));
    const bet = hasFree ? numero(u.rouletteFreeSpinBet, 0) : numero(apostaDaTela, 0.5);
    const min = 0.5;
    const max = 100;

    if (!hasFree && (bet < min || bet > max)) return window.mostrarToast?.("Aposta fora dos limites.");
    if (!hasFree && bet > numero(u.balance, 0)) return window.mostrarToast?.("Saldo insuficiente.");

    const btn = $("rouletteSpinButton");
    const wheel = $("rouletteWheel");
    window.__myBetsRouletteSpinning = true;
    if (btn) { btn.disabled = true; btn.textContent = "GIRANDO..."; }

    try {
      const response = await fetch("/api/roulette/spin", {
        method: "POST",
        headers: typeof window.headersJSON === "function" ? window.headersJSON() : { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, betAmount: bet, betType: "roulette", rouletteId: "sorte", freeSpin: hasFree })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível girar.");

      const r = data.spin || data.result || data;
      const serverIndex = numero(r.index, -1);
      if (serverIndex < 0 || serverIndex >= SEGMENTS.length) throw new Error("Resultado inválido.");

      const angle = 360 / SEGMENTS.length;
      const target = 360 - (serverIndex * angle + angle / 2);
      const rotations = 7 + Math.floor(Math.random() * 3);
      const animationMs = 4800;

      if (wheel) {
        wheel.style.transition = `transform ${animationMs}ms cubic-bezier(.12,.72,.12,1)`;
        wheel.style.transform = `rotate(${rotations * 360 + target}deg)`;
      }

      await new Promise(resolve => setTimeout(resolve, animationMs + 100));

      const seg = SEGMENTS[serverIndex];
      const prize = numero(r.prize, 0);

      if (data.user) {
        if (typeof window.atualizarSaldos === "function") window.atualizarSaldos(data.user.balance);
        localStorage.setItem("jpbet_user", JSON.stringify({ ...u, ...data.user }));
      }

      const win = $("winDisplay");
      if (win) win.textContent = moeda(prize);
      const result = $("rouletteResult");
      if (result) {
        result.textContent = prize > 0
          ? `🎉 ${seg.label} — Prêmio ${moeda(prize)}${hasFree ? " (giro grátis)" : ""}`
          : "❌ PERDEU — Prêmio R$ 0,00";
      }

      window.criarRoletaSorte();
      if (wheel) wheel.style.transform = `rotate(${rotations * 360 + target}deg)`;
      prepararPonteiro();
      if (typeof window.atualizarGiroGratis === "function") window.atualizarGiroGratis();
    } catch (error) {
      const result = $("rouletteResult");
      if (result) result.textContent = "Defina sua aposta e gire.";
      window.mostrarToast?.(error.message || "Erro ao girar.");
    } finally {
      window.__myBetsRouletteSpinning = false;
      if (btn) btn.disabled = false;
      if (typeof window.atualizarGiroGratis === "function") window.atualizarGiroGratis();
    }
  };

  document.addEventListener("DOMContentLoaded", prepararPonteiro);
})();

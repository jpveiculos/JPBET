/* MyBets Roulette 16 — substitui a implementação antiga de Roda da Sorte */
(() => {
  const SEGMENTS = [
    { label: "X", type: "zero", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "5X", type: "prize", multiplier: 5 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "10X", type: "prize", multiplier: 10 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "2X", type: "prize", multiplier: 2 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "3X", type: "prize", multiplier: 3 },
    { label: "X", type: "zero", multiplier: 0 }
  ];

  const $ = id => document.getElementById(id);
  const number = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const money = v => number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const user = () => {
    try { return JSON.parse(localStorage.getItem("jpbet_user") || "null"); }
    catch (_) { return null; }
  };
  const headers = () => {
    const h = { "Content-Type": "application/json" };
    const token = localStorage.getItem("jpbet_token");
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  };
  const toast = msg => {
    if (typeof window.mostrarToast === "function") return window.mostrarToast(msg);
    const el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(window.__mybetsRouletteToast);
    window.__mybetsRouletteToast = setTimeout(() => el.classList.remove("show"), 2600);
  };

  let spinning = false;
  let rotation = 0;

  function polar(cx, cy, r, deg) {
    const a = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function path(cx, cy, r, start, end) {
    const a = polar(cx, cy, r, start);
    const b = polar(cx, cy, r, end);
    return `M ${cx} ${cy} L ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y} Z`;
  }

  function renderWheel() {
    const wheel = $("rouletteWheel");
    if (!wheel) return;
    wheel.innerHTML = "";
    wheel.style.background = "none";
    wheel.style.position = "relative";
    wheel.style.transform = `rotate(${rotation}deg)`;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 500 500");
    svg.setAttribute("aria-label", "Roleta MyBets com 16 fatias");
    svg.setAttribute("role", "img");

    const ns = "http://www.w3.org/2000/svg";
    const angle = 360 / 16;
    const cx = 250, cy = 250, r = 238;
    const prizes = new Set([2, 6, 10, 14]);

    SEGMENTS.forEach((seg, i) => {
      const g = document.createElementNS(ns, "g");
      const p = document.createElementNS(ns, "path");
      const start = i * angle;
      p.setAttribute("d", path(cx, cy, r, start, start + angle));
      p.setAttribute("fill", prizes.has(i) ? "#090909" : (i % 2 ? "#dba528" : "#c7931d"));
      p.setAttribute("stroke", "#f2ca55");
      p.setAttribute("stroke-width", "2");
      g.appendChild(p);

      if (prizes.has(i)) {
        const mid = start + angle / 2;
        const q = polar(cx, cy, 157, mid);
        const t = document.createElementNS(ns, "text");
        t.textContent = seg.label;
        t.setAttribute("x", q.x);
        t.setAttribute("y", q.y);
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("dominant-baseline", "middle");
        t.setAttribute("font-family", "Arial, Helvetica, sans-serif");
        t.setAttribute("font-size", seg.multiplier === 10 ? "50" : "58");
        t.setAttribute("font-weight", "900");
        t.setAttribute("fill", "#25e66b");
        t.setAttribute("stroke", "#06150a");
        t.setAttribute("stroke-width", "4");
        t.setAttribute("paint-order", "stroke fill");
        g.appendChild(t);
      }
      svg.appendChild(g);
    });

    const ring = document.createElementNS(ns, "circle");
    ring.setAttribute("cx", cx); ring.setAttribute("cy", cy); ring.setAttribute("r", r);
    ring.setAttribute("fill", "none"); ring.setAttribute("stroke", "#a66f08"); ring.setAttribute("stroke-width", "11");
    svg.appendChild(ring);

    const highlight = document.createElementNS(ns, "circle");
    highlight.setAttribute("cx", cx); highlight.setAttribute("cy", cy); highlight.setAttribute("r", r - 7);
    highlight.setAttribute("fill", "none"); highlight.setAttribute("stroke", "#f5d66a"); highlight.setAttribute("stroke-width", "2");
    svg.appendChild(highlight);

    wheel.appendChild(svg);
  }

  window.abrirInterfaceRoleta = function(config = {}) {
    if ($("gameTypeLabel")) $("gameTypeLabel").textContent = "ROLETA MYBETS";
    if ($("slotPanel")) $("slotPanel").hidden = true;
    if ($("roulettePanel")) $("roulettePanel").hidden = false;
    if ($("winDisplay")) $("winDisplay").textContent = "R$ 0,00";
    if ($("rouletteResult")) $("rouletteResult").textContent = "Defina sua aposta e gire.";
    const min = Math.max(0.5, number(config.minBet, 0.5));
    const max = Math.max(min, number(config.maxBet, 100));
    window.__mybetsRouletteMin = min;
    window.__mybetsRouletteMax = max;
    if (typeof window.definirRouletteBet === "function") window.definirRouletteBet(min);
    else if ($("rouletteBetValue")) $("rouletteBetValue").textContent = money(min);
    const free = $("rouletteFreeSpinStatus");
    if (free) { free.hidden = true; free.textContent = ""; }
    renderWheel();
  };

  window.criarRoletaSorte = renderWheel;
  window.criarRoletaMyBets = renderWheel;
  window.atualizarGiroGratis = () => {};

  window.girarRoleta = async function() {
    if (spinning) return;
    const u = user();
    const userId = u?.id ?? u?.userId;
    if (!userId) return toast("Faça login novamente.");

    const bet = number(window.rouletteBet, number($("rouletteBetValue")?.textContent.replace(/[^0-9,.-]/g, "").replace(",", "."), 0.5));
    const min = number(window.__mybetsRouletteMin, 0.5);
    const max = number(window.__mybetsRouletteMax, 100);
    if (bet < min || bet > max) return toast("Aposta fora dos limites.");
    if (bet > number(u.balance, 0)) return toast("Saldo insuficiente.");

    spinning = true;
    const btn = $("rouletteSpinButton");
    const hub = $("rouletteHubButton");
    if (btn) { btn.disabled = true; btn.textContent = "GIRANDO..."; }
    if (hub) hub.disabled = true;

    try {
      const response = await fetch("/api/roulette/spin", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ userId, betAmount: bet, betType: "roulette", rouletteId: "roleta" })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Não foi possível girar a roleta.");

      const r = data.spin || data.result || data;
      const index = number(r.index, -1);
      if (index < 0 || index >= SEGMENTS.length) throw new Error("Resultado inválido da roleta.");

      const angle = 360 / 16;
      const target = 360 - (index * angle + angle / 2);
      const turns = 7 + Math.floor(Math.random() * 3);
      const ms = Math.max(1800, number(window.configuracaoAtual?.animationMs ?? window.configuracoes?.roulette_animation_ms, 4800));
      const wheel = $("rouletteWheel");
      rotation = turns * 360 + target;
      if (wheel) {
        wheel.style.transition = `transform ${ms}ms cubic-bezier(.12,.72,.12,1)`;
        wheel.style.transform = `rotate(${rotation}deg)`;
      }
      await new Promise(resolve => setTimeout(resolve, ms + 100));

      const seg = SEGMENTS[index];
      const prize = number(r.prize, 0);
      if (data.user) {
        const merged = { ...u, ...data.user };
        localStorage.setItem("jpbet_user", JSON.stringify(merged));
        if (typeof window.atualizarSaldos === "function") window.atualizarSaldos(merged.balance);
      }
      if ($("winDisplay")) $("winDisplay").textContent = money(prize);
      if ($("rouletteResult")) {
        $("rouletteResult").textContent = prize > 0
          ? `🎉 ${seg.label} — Prêmio ${money(prize)}`
          : "Resultado: sem prêmio nesta rodada.";
      }
    } catch (e) {
      if ($("rouletteResult")) $("rouletteResult").textContent = "Defina sua aposta e gire.";
      toast(e.message || "Erro ao girar a roleta.");
    } finally {
      spinning = false;
      if (btn) { btn.disabled = false; btn.textContent = "GIRAR ROLETA"; }
      if (hub) hub.disabled = false;
    }
  };

  const style = document.createElement("style");
  style.textContent = `
    .roulette-machine{position:relative;width:min(470px,calc(100vw - 42px));aspect-ratio:1;margin:18px auto 10px;filter:drop-shadow(0 15px 25px rgba(0,0,0,.58))}
    .roulette-machine .roulette-wheel{position:absolute;inset:0;border-radius:50%;will-change:transform}
    .roulette-machine .roulette-wheel svg{width:100%;height:100%;display:block;overflow:visible}
    .roulette-machine .roulette-pointer{position:absolute;z-index:20;top:-30px;left:50%;width:64px;height:78px;transform:translateX(-50%);background:linear-gradient(145deg,#fff6bd,#ffd24a,#9a5200);clip-path:polygon(4% 0,96% 0,83% 56%,50% 100%,17% 56%);filter:drop-shadow(0 6px 8px rgba(0,0,0,.9));pointer-events:none}
    .roulette-machine .roulette-pointer::after{content:"";position:absolute;left:50%;top:12px;width:40px;height:51px;transform:translateX(-50%);background:linear-gradient(155deg,#ff7373,#ff1717,#710000);clip-path:polygon(50% 100%,0 0,100% 0)}
    .roulette-machine .roulette-hub{position:absolute;z-index:30;left:50%;top:50%;transform:translate(-50%,-50%);width:30%;aspect-ratio:1;border-radius:50%;border:7px solid #d89a12;background:radial-gradient(circle at 42% 35%,#4b3a16,#050403 62%);color:#ffd33d;font-weight:1000;font-size:clamp(18px,4vw,25px);box-shadow:0 0 0 4px #5c3b0b,0 0 18px rgba(255,204,55,.45),inset 0 0 22px rgba(255,190,30,.2);padding:0}
    .roulette-machine .roulette-hub::before{content:"MyBets";display:block;color:#f4f4f4;font-style:italic;font-size:clamp(16px,3.8vw,22px);line-height:1;margin-bottom:3px}
    #rouletteFreeSpinStatus{display:none!important}
  `;
  document.head.appendChild(style);
})();
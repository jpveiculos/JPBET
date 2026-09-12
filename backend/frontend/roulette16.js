/* MyBets Roulette 16 — visual final preto e dourado */
(() => {
  const $ = id => document.getElementById(id);
  const n = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
  const money = v => n(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const user = () => { try { return JSON.parse(localStorage.getItem('jpbet_user') || 'null'); } catch (_) { return null; } };
  const headers = () => { const h = { 'Content-Type': 'application/json' }; const t = localStorage.getItem('jpbet_token'); if (t) h.Authorization = `Bearer ${t}`; return h; };
  let spinning = false;
  let rotation = 0;

  function wheel() { return $('rouletteWheel') || $('wheel'); }
  function spinBtn() { return $('rouletteSpinButton') || $('spinButton'); }
  function betEl() { return $('rouletteBetValue') || $('betAmount'); }
  function polar(r, deg) { const a = (deg - 90) * Math.PI / 180; return { x: 250 + r * Math.cos(a), y: 250 + r * Math.sin(a) }; }
  function path(r, start, end) { const p = polar(r, start), q = polar(r, end), large = end - start > 180 ? 1 : 0; return `M250 250 L${p.x} ${p.y} A${r} ${r} 0 ${large} 1 ${q.x} ${q.y} Z`; }

  function renderWheel() {
    const el = wheel();
    if (!el) return;
    el.innerHTML = '';
    el.style.background = 'none';
    el.style.transform = `rotate(${rotation}deg)`;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 500 500');
    svg.setAttribute('aria-label', 'Roleta MyBets com 16 resultados');
    svg.style.cssText = 'width:100%;height:100%;display:block;overflow:visible';

    // Visual baseado no modelo aprovado: 4 grandes áreas pretas de prêmio
    // e 4 divisórias douradas estreitas. Cada área dourada representa as 3 perdas.
    const prizes = [
      { label: '3X', center: 315 },
      { label: '5X', center: 45 },
      { label: '10X', center: 135 },
      { label: '2X', center: 225 }
    ];
    const goldCenters = [0, 90, 180, 270];

    for (let g = 0; g < 4; g++) {
      const goldCenter = goldCenters[g];
      const blackCenter = prizes[g].center;
      const blackStart = blackCenter - 37.5;
      const blackEnd = blackCenter + 37.5;
      const goldStart = goldCenter - 7.5;
      const goldEnd = goldCenter + 7.5;

      const black = document.createElementNS(ns, 'path');
      black.setAttribute('d', path(238, blackStart, blackEnd));
      black.setAttribute('fill', '#030303');
      black.setAttribute('stroke', '#f3b91f');
      black.setAttribute('stroke-width', '2');
      svg.appendChild(black);

      const gold = document.createElementNS(ns, 'path');
      gold.setAttribute('d', path(238, goldStart, goldEnd));
      gold.setAttribute('fill', '#f3b21b');
      gold.setAttribute('stroke', '#ffd65a');
      gold.setAttribute('stroke-width', '2');
      svg.appendChild(gold);

      const q = polar(154, blackCenter);
      const text = document.createElementNS(ns, 'text');
      text.textContent = prizes[g].label;
      text.setAttribute('x', q.x);
      text.setAttribute('y', q.y);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
      text.setAttribute('font-size', g === 2 ? '45' : '55');
      text.setAttribute('font-weight', '900');
      text.setAttribute('font-style', 'italic');
      text.setAttribute('fill', '#28ee76');
      text.setAttribute('stroke', '#062713');
      text.setAttribute('stroke-width', '4');
      text.setAttribute('paint-order', 'stroke fill');
      svg.appendChild(text);
    }

    const outer = document.createElementNS(ns, 'circle');
    outer.setAttribute('cx', '250'); outer.setAttribute('cy', '250'); outer.setAttribute('r', '239');
    outer.setAttribute('fill', 'none'); outer.setAttribute('stroke', '#8f5a05'); outer.setAttribute('stroke-width', '12');
    svg.appendChild(outer);

    const bright = document.createElementNS(ns, 'circle');
    bright.setAttribute('cx', '250'); bright.setAttribute('cy', '250'); bright.setAttribute('r', '232');
    bright.setAttribute('fill', 'none'); bright.setAttribute('stroke', '#ffc92f'); bright.setAttribute('stroke-width', '3');
    svg.appendChild(bright);

    const inner = document.createElementNS(ns, 'circle');
    inner.setAttribute('cx', '250'); inner.setAttribute('cy', '250'); inner.setAttribute('r', '118');
    inner.setAttribute('fill', '#070707'); inner.setAttribute('stroke', '#d9940e'); inner.setAttribute('stroke-width', '5');
    svg.appendChild(inner);

    el.appendChild(svg);
  }

  function setBalance(v) {
    const x = n(v), s = x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    ['headerBalance', 'mainBalance'].forEach(id => { const e = $(id); if (e) e.textContent = s; });
    ['rouletteLiveBalance', 'rouletteBalance'].forEach(id => { const e = $(id); if (e) e.textContent = money(x); });
  }

  function animateBalance(a, b, ms = 850) {
    const from = n(a), to = n(b), t0 = performance.now();
    const frame = t => { const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3); setBalance(from + (to - from) * e); if (p < 1) requestAnimationFrame(frame); else setBalance(to); };
    requestAnimationFrame(frame);
  }

  async function refreshBalance() {
    const u = user(), id = u?.id ?? u?.userId;
    if (!id) return;
    try {
      const r = await fetch(`/api/user/${encodeURIComponent(id)}`, { headers: headers() });
      if (!r.ok) return;
      const d = await r.json(), v = d.user || d, old = n(u.balance), next = n(v.balance);
      localStorage.setItem('jpbet_user', JSON.stringify({ ...u, ...v }));
      Math.abs(next - old) > .001 ? animateBalance(old, next) : setBalance(next);
    } catch (_) {}
  }

  function applyVisualStyle() {
    const style = document.createElement('style');
    style.textContent = `
      .roulette-area{width:min(540px,calc(100vw - 18px));margin:8px auto 14px;filter:drop-shadow(0 20px 34px rgba(0,0,0,.72))}
      .roulette-area:before{inset:-9px;border:9px solid #9b6509;box-shadow:0 0 0 3px #3b2505,0 0 34px rgba(255,197,48,.42)}
      #wheel,#rouletteWheel{overflow:visible;backface-visibility:hidden}
      .roulette-pointer{z-index:100;top:-21px;border-left:18px solid transparent;border-right:18px solid transparent;border-top:42px solid #ffd43f;filter:drop-shadow(0 5px 6px rgba(0,0,0,.8))}
      .roulette-pointer:after{content:"";position:absolute;left:-8px;top:-35px;width:16px;height:16px;border-radius:50%;background:#ff2028;border:3px solid #ffd43f;box-shadow:0 0 14px rgba(255,210,45,.9)}
      .roulette-center-cover{width:40%;border:6px solid #e1a019;box-shadow:0 0 0 3px #6f4507,0 0 26px rgba(255,190,30,.7),inset 0 0 25px rgba(255,190,30,.18);background:radial-gradient(circle at 45% 30%,#1d1d1d,#050505 70%)}
      .roulette-center-button{width:29%;min-width:125px;max-width:155px;border:6px solid #d99a13;background:radial-gradient(circle at 45% 30%,#2a2110,#050505 72%);color:#ffd23d;font-weight:1000;font-size:clamp(19px,4vw,25px);box-shadow:0 0 0 3px #5b3a09,0 0 0 7px rgba(255,203,52,.45),inset 0 0 20px rgba(255,190,30,.2),0 8px 22px rgba(0,0,0,.7)}
      .roulette-center-button:before{content:"MyBets";display:block;color:#fff;font-size:clamp(17px,4vw,24px);font-style:italic;line-height:1;margin-bottom:4px;text-shadow:0 2px 10px rgba(255,210,45,.25)}
      .roulette-bet{margin-top:18px;gap:12px}.roulette-bet-field{max-width:none}.roulette-bet-field label{font-size:13px;text-align:center;margin:0 0 7px}.roulette-bet-field input{height:64px;border-radius:16px;border:1px solid #5b4a1c;background:#05070b;font-size:30px;text-align:center;padding:0 18px}
      .roulette-bet button{width:52px;height:64px;border-radius:16px;border:1px solid #705617;background:#151a22;color:#fff;font-size:31px;font-weight:900}
      .quick-bets{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:10px}.quick-bets button{height:55px;border:1px solid #303743;border-radius:14px;background:#151a22;color:#fff;font-size:18px;font-weight:900}
      .spin-button{height:66px;border-radius:16px;background:linear-gradient(180deg,#ffe278,#d99a17);font-size:31px;letter-spacing:1px;box-shadow:0 8px 20px rgba(218,155,22,.28)}
      .roulette-result{min-height:24px;margin:8px 0;text-align:center;font-weight:900}.roulette-note{display:none}
      @media(max-width:600px){.modal-content{padding:18px 10px}.roulette-area{width:min(520px,calc(100vw - 18px))}.roulette-center-button{min-width:108px}}
    `;
    document.head.appendChild(style);
  }

  window.abrirInterfaceRoleta = function(config = {}) {
    if ($('gameTypeLabel')) $('gameTypeLabel').textContent = 'ROLETA MYBETS';
    if ($('slotPanel')) $('slotPanel').hidden = true;
    if ($('roulettePanel')) $('roulettePanel').hidden = false;
    const min = Math.max(.5, n(config.minBet, .5)), max = Math.max(min, n(config.maxBet, 100));
    window.__mybetsRouletteMin = min;
    window.__mybetsRouletteMax = max;
    const b = betEl();
    if (b) { b.min = String(min); b.max = String(max); if (n(b.value, min) < min) b.value = String(min); }
    renderWheel();
    refreshBalance();
  };

  window.criarRoletaSorte = renderWheel;
  window.criarRoletaMyBets = renderWheel;
  window.atualizarGiroGratis = () => {};

  window.girarRoleta = async function() {
    if (spinning) return;
    const u = user(), userId = u?.id ?? u?.userId;
    if (!userId) return alert('Faça login novamente.');
    const b = betEl(), bet = n(b?.value ?? window.rouletteBet, .5), min = n(window.__mybetsRouletteMin, .5), max = n(window.__mybetsRouletteMax, 100);
    if (bet < min || bet > max) return alert('Aposta fora dos limites.');
    if (bet > n(u.balance)) return alert('Saldo insuficiente.');
    spinning = true;
    window.__mybetsRouletteSpinning = true;
    const btn = spinBtn();
    if (btn) { btn.disabled = true; btn.textContent = 'GIRANDO...'; }
    try {
      const res = await fetch('/api/roulette/spin', { method: 'POST', headers: headers(), body: JSON.stringify({ userId, betAmount: bet, betType: 'roulette', rouletteId: 'sorte' }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || 'Não foi possível girar a roleta.');
      const r = data.spin || data.result || data, index = n(r.index, -1);
      if (index < 0 || index >= 16) throw new Error('Resultado inválido da roleta.');

      const group = Math.floor(index / 4);
      const isPrize = index % 4 === 2;
      const prizeCenters = [315, 45, 135, 225];
      const lossCenters = [0, 90, 180, 270];
      const center = isPrize ? prizeCenters[group] : lossCenters[group];
      const current = ((rotation % 360) + 360) % 360;
      const target = ((360 - center - current) % 360 + 360) % 360;
      const turns = 7 + Math.floor(Math.random() * 3);
      const ms = Math.max(1800, n(window.configuracaoAtual?.animationMs ?? window.configuracoes?.roulette_animation_ms, 4800));
      const w = wheel();
      rotation = rotation + turns * 360 + target;
      if (w) { w.style.transition = `transform ${ms}ms cubic-bezier(.12,.72,.12,1)`; w.style.transform = `rotate(${rotation}deg)`; }
      await new Promise(resolve => setTimeout(resolve, ms + 100));

      const old = n(u.balance), next = n(data.user?.balance, old - bet + n(r.prize));
      if (data.user) localStorage.setItem('jpbet_user', JSON.stringify({ ...u, ...data.user }));
      animateBalance(old, next);
      const result = $('rouletteResult');
      if (result) result.textContent = n(r.prize) > 0 ? `🎉 ${r.label || ['3X','5X','10X','2X'][group]} — Prêmio ${money(r.prize)}` : 'Resultado: sem prêmio nesta rodada.';
    } catch (e) {
      const result = $('rouletteResult');
      if (result) result.textContent = 'Defina sua aposta e gire.';
      alert(e.message || 'Erro ao girar a roleta.');
    } finally {
      spinning = false;
      window.__mybetsRouletteSpinning = false;
      if (btn) { btn.disabled = false; btn.textContent = 'GIRAR'; }
    }
  };

  window.spinRoulette = window.girarRoleta;
  applyVisualStyle();
  renderWheel();
  refreshBalance();
  document.addEventListener('DOMContentLoaded', () => { renderWheel(); refreshBalance(); });
})();
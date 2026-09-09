(() => {
  "use strict";

  const API = "/api";

  const ROULETTE_SEGMENTS = [
    { label: "2×", type: "prize", multiplier: 2 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "3×", type: "prize", multiplier: 3 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "4×", type: "prize", multiplier: 4 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "🍀", type: "sorte", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "5×", type: "prize", multiplier: 5 },
    { label: "X", type: "zero", multiplier: 0 }
  ];

  const MIN = 0.5;
  const STEP = 0.5;

  let user = null;
  let bet = 0.5;
  let busy = false;
  let rotation = 0;
  let freeSpin = false;

  const $ = id => document.getElementById(id);

  const money = value =>
    Number(value || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  function toast(message) {
    const el = $("toast");
    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      el.classList.remove("show");
    }, 2600);
  }

  function stored() {
    try {
      return JSON.parse(localStorage.getItem("jpbet_user") || "null");
    } catch {
      return null;
    }
  }

  function save(u) {
    if (!u) return;

    user = u;

    try {
      localStorage.setItem("jpbet_user", JSON.stringify(u));
    } catch {}
  }

  function uid() {
    return user?.id ?? user?.userId ?? user?.user_id;
  }

  function bal() {
    if (!user) return 0;

    const bonus = Number(
      user.bonusBalance ??
      user.bonus_balance ??
      0
    );

    const cash = Number(
      user.cashBalance ??
      user.cash_balance ??
      0
    );

    if (
      user.bonusBalance !== undefined ||
      user.bonus_balance !== undefined ||
      user.cashBalance !== undefined ||
      user.cash_balance !== undefined
    ) {
      return bonus + cash;
    }

    return Number(
      user.balance ??
      user.saldo ??
      user.cash ??
      0
    );
  }

  function balances() {
    const value = money(bal());

    if ($("balance")) {
      $("balance").textContent = value;
    }

    if ($("stageBalance")) {
      $("stageBalance").textContent = value;
    }
  }

  async function api(path, options = {}) {
    const headers = {
      "Content-Type": "application/json"
    };

    try {
      const token = localStorage.getItem("jpbet_token");

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {}

    const response = await fetch(API + path, {
      ...options,
      credentials: "include",
      headers
    });

    const text = await response.text();

    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {}

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        `Erro HTTP ${response.status}`
      );
    }

    return data;
  }

  async function loadUser() {
    user = stored();

    const id = uid();

    if (!id) {
      balances();
      return;
    }

    try {
      const data = await api(
        `/user/${encodeURIComponent(id)}`
      );

      const freshUser =
        data.user ||
        data.usuario ||
        data.player ||
        data;

      if (
        freshUser?.id ||
        freshUser?.userId ||
        freshUser?.user_id
      ) {
        save(freshUser);
      }
    } catch {}

    balances();
  }

  async function refreshUser() {
    const id = uid();

    if (!id) return;

    try {
      const data = await api(
        `/user/${encodeURIComponent(id)}`
      );

      const freshUser =
        data.user ||
        data.usuario ||
        data.player ||
        data;

      if (
        freshUser?.id ||
        freshUser?.userId ||
        freshUser?.user_id
      ) {
        save(freshUser);
        balances();
      }
    } catch {}
  }

  function lobby() {
    const container = $("gamesContainer");

    if (!container) return;

    container.innerHTML = `
      <button class="game-card" id="rouletteCard" type="button">
        <div class="game-card-icon">♛</div>
        <div>
          <strong>Roleta da Sorte</strong>
          <span>10 setores • Multiplicadores • 🍀 Giro grátis</span>
        </div>
        <b>JOGAR →</b>
      </button>
    `;

    $("rouletteCard").onclick = openRoulette;
  }

  function openRoulette() {
    $("gamesLobby").hidden = true;
    $("gameStage").hidden = false;
    $("roulettePanel").hidden = false;

    $("gameTitle").textContent = "Roleta da Sorte";
    $("gameTypeLabel").textContent = "ROLETA";

    createWheel();
    updateBet();
    balances();
  }

  function back() {
    $("gameStage").hidden = true;
    $("gamesLobby").hidden = false;
    $("roulettePanel").hidden = true;
  }

  function createWheel() {
    const wheel = $("rouletteWheel");

    if (!wheel) return;

    const bulbs = $("rouletteBulbs");
    const pointer = document.querySelector(".roulette-pointer");
    const innerRing = document.querySelector(".roulette-inner-ring");
    const oldHub = $("rouletteCenterButton");

    if (bulbs) {
      bulbs.style.display = "none";
    }

    if (pointer) {
      pointer.style.display = "none";
    }

    if (innerRing) {
      innerRing.style.display = "none";
    }

    wheel.innerHTML = `
      <img
        src="/Roleta%20da%20Sorte.png"
        alt="Roleta da Sorte MyBets"
        class="roulette-wheel-image"
        draggable="false"
      >
    `;

    wheel.style.background = "transparent";
    wheel.style.overflow = "hidden";
    wheel.style.boxShadow = "none";
    wheel.style.border = "none";
    wheel.style.transform = `rotate(${rotation}deg)`;

    const image = wheel.querySelector(
      ".roulette-wheel-image"
    );

    if (image) {
      image.style.position = "absolute";
      image.style.inset = "0";
      image.style.width = "100%";
      image.style.height = "100%";
      image.style.objectFit = "contain";
      image.style.display = "block";
      image.style.userSelect = "none";
      image.style.pointerEvents = "none";
    }

    if (oldHub) {
      oldHub.style.position = "absolute";
      oldHub.style.inset = "36%";
      oldHub.style.width = "28%";
      oldHub.style.height = "28%";
      oldHub.style.margin = "0";
      oldHub.style.padding = "0";
      oldHub.style.border = "0";
      oldHub.style.borderRadius = "50%";
      oldHub.style.background = "transparent";
      oldHub.style.boxShadow = "none";
      oldHub.style.color = "transparent";
      oldHub.style.zIndex = "30";
      oldHub.style.fontSize = "0";
    }
  }

  function updateBet() {
    const value = $("rouletteBetValue");

    if (value) {
      value.textContent = `R$ ${money(bet)}`;
    }

    document
      .querySelectorAll("[data-roulette-bet]")
      .forEach(button => {
        button.classList.toggle(
          "active",
          Number(button.dataset.rouletteBet) === bet
        );
      });
  }

  function setBet(value) {
    value = Number(value);

    if (!Number.isFinite(value) || value < MIN) {
      return;
    }

    bet = Math.round(value * 100) / 100;

    updateBet();
  }

  function other() {
    const value = prompt(
      "Digite o valor da aposta em reais:",
      String(bet).replace(".", ",")
    );

    if (value === null) return;

    const number = Number(
      value
        .replace(/\./g, "")
        .replace(",", ".")
    );

    if (!Number.isFinite(number) || number < MIN) {
      return toast(
        "Digite um valor a partir de R$ 0,50."
      );
    }

    setBet(number);
  }

  function indexOf(result) {
    if (Number.isInteger(result?.index)) {
      return result.index;
    }

    if (Number.isInteger(result?.segmentIndex)) {
      return result.segmentIndex;
    }

    const multiplier = Number(
      result?.multiplier ??
      result?.resultado?.multiplier ??
      0
    );

    const type =
      result?.type ??
      result?.resultado?.type;

    const candidates = ROULETTE_SEGMENTS
      .map((segment, index) => ({
        segment,
        index
      }))
      .filter(item => {
        if (
          type &&
          item.segment.type !== type
        ) {
          return false;
        }

        if (
          item.segment.type === "prize" &&
          item.segment.multiplier !== multiplier
        ) {
          return false;
        }

        return true;
      });

    return candidates.length
      ? candidates[0].index
      : 0;
  }

  function labelOf(result) {
    return (
      result?.label ||
      result?.resultLabel ||
      result?.resultado?.label ||
      ROULETTE_SEGMENTS[indexOf(result)]?.label ||
      "X"
    );
  }

  function animate(index) {
    const wheel = $("rouletteWheel");

    if (!wheel) {
      return Promise.resolve();
    }

    const sliceAngle =
      360 / ROULETTE_SEGMENTS.length;

    const target =
      -(index * sliceAngle + sliceAngle / 2);

    const current =
      ((rotation % 360) + 360) % 360;

    let distance = target - current;

    while (distance < 0) {
      distance += 360;
    }

    rotation += 7 * 360 + distance;

    wheel.style.transition =
      "transform 5.8s cubic-bezier(.12,.78,.16,1)";

    wheel.style.transform =
      `rotate(${rotation}deg)`;

    return new Promise(resolve => {
      setTimeout(resolve, 6000);
    });
  }

  async function spin() {
    if (busy) return;

    if (!uid()) {
      return toast("Faça login para jogar.");
    }

    await refreshUser();

    const serverFreeSpins = Number(
      user?.rouletteFreeSpins ??
      user?.roulette_free_spins ??
      0
    );

    const hasFreeSpin =
      serverFreeSpins > 0 || freeSpin;

    if (!hasFreeSpin && bal() < bet) {
      return toast("Saldo insuficiente.");
    }

    busy = true;

    if ($("rouletteSpinButton")) {
      $("rouletteSpinButton").disabled = true;
    }

    if ($("rouletteCenterButton")) {
      $("rouletteCenterButton").disabled = true;
    }

    $("rouletteResult").textContent =
      "Girando...";

    try {
      const data = await api(
        "/roulette/spin",
        {
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            userId: uid(),
            betAmount: bet,
            betType: "roulette",
            rouletteId: "popular",
            freeSpin: hasFreeSpin
          })
        }
      );

      const result =
        data.result ||
        data.resultado ||
        data;

      const index = indexOf(result);

      await animate(index);

      if (data.user || data.usuario) {
        save(data.user || data.usuario);
      } else {
        await refreshUser();
      }

      const prize = Number(
        data.prize ??
        data.payout ??
        result.prize ??
        result.payout ??
        0
      );

      const label = labelOf(result);

      const isFree =
        result.type === "sorte" ||
        label.includes("🍀");

      $("rouletteResult").textContent =
        isFree
          ? "🍀 GIRO GRÁTIS!"
          : prize > 0
            ? `${label} — Você ganhou R$ ${money(prize)}`
            : `${label} — Boa sorte na próxima!`;

      $("winDisplay").textContent =
        prize > 0
          ? `R$ ${money(prize)}`
          : "R$ 0,00";

      if (isFree) {
        freeSpin = true;

        $("rouletteFreeSpinStatus").hidden = false;

        $("rouletteFreeSpinStatus").textContent =
          `🍀 Você ganhou 1 giro grátis de R$ ${money(bet)}.`;

        $("rouletteFreeBadge").hidden = false;
      } else {
        freeSpin = false;

        $("rouletteFreeSpinStatus").hidden = true;
        $("rouletteFreeBadge").hidden = true;
      }

      await refreshUser();
      balances();

    } catch (error) {
      toast(
        error.message ||
        "Erro ao girar a roleta."
      );

      $("rouletteResult").textContent =
        "Não foi possível realizar o giro.";
    } finally {
      busy = false;

      if ($("rouletteSpinButton")) {
        $("rouletteSpinButton").disabled = false;
      }

      if ($("rouletteCenterButton")) {
        $("rouletteCenterButton").disabled = false;
      }
    }
  }

  function events() {
    $("backButton").onclick = () => {
      if (history.length > 1) {
        history.back();
      } else {
        location.href = "index.html";
      }
    };

    $("stageBack").onclick = back;

    $("rouletteBetMinus").onclick = () => {
      setBet(
        Math.max(MIN, bet - STEP)
      );
    };

    $("rouletteBetPlus").onclick = () => {
      setBet(bet + STEP);
    };

    $("rouletteOtherValue").onclick = other;

    $("rouletteSpinButton").onclick = spin;

    $("rouletteCenterButton").onclick = spin;

    document
      .querySelectorAll("[data-roulette-bet]")
      .forEach(button => {
        button.onclick = () => {
          setBet(
            button.dataset.rouletteBet
          );
        };
      });
  }

  lobby();
  events();
  loadUser();

})();

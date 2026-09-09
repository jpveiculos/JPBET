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

  const QUICK = [0.5, 1, 2, 5, 10, 50];
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
    const element = $("toast");
    if (!element) return;

    element.textContent = message;
    element.classList.add("show");

    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      element.classList.remove("show");
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
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    try {
      const token = localStorage.getItem("jpbet_token");

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {}

    const response = await fetch(API + path, {
      ...options,
      headers,
      credentials: "include"
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
      const data = await api(`/user/${encodeURIComponent(id)}`);

      const freshUser =
        data.user ||
        data.usuario ||
        data.player ||
        data;

      if (
        freshUser &&
        (
          freshUser.id !== undefined ||
          freshUser.userId !== undefined ||
          freshUser.user_id !== undefined
        )
      ) {
        save(freshUser);
      }
    } catch {}

    balances();

    syncFreeSpinFromServer();
  }

  async function refreshUser() {
    const id = uid();

    if (!id) return;

    const data = await api(`/user/${encodeURIComponent(id)}`);

    const freshUser =
      data.user ||
      data.usuario ||
      data.player ||
      data;

    if (freshUser) {
      save(freshUser);
      balances();
    }
  }

  function syncFreeSpinFromServer() {
    const spins = Number(
      user?.rouletteFreeSpins ??
      user?.roulette_free_spins ??
      0
    );

    freeSpin = spins > 0;

    const status = $("rouletteFreeSpinStatus");
    const badge = $("rouletteFreeBadge");

    if (freeSpin) {
      if (status) {
        status.hidden = false;
        status.textContent = "🍀 Você possui um giro grátis.";
      }

      if (badge) {
        badge.hidden = false;
      }
    } else {
      if (status) status.hidden = true;
      if (badge) badge.hidden = true;
    }
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
    syncFreeSpinFromServer();
  }

  function back() {
    $("gameStage").hidden = true;
    $("gamesLobby").hidden = false;
    $("roulettePanel").hidden = true;
  }

  function createWheel() {
    const wheel = $("rouletteWheel");

    if (!wheel) return;

    wheel.innerHTML = `
      <img
        src="/Roleta%20da%20Sorte.png"
        alt="Roleta da Sorte MyBets"
        class="roulette-wheel-image"
        draggable="false"
      >
      <button
        type="button"
        id="rouletteImageCenterButton"
        class="roulette-image-center-button"
        aria-label="Girar roleta"
      ></button>
    `;

    wheel.style.transform = `rotate(${rotation}deg)`;

    const centerButton = $("rouletteImageCenterButton");

    if (centerButton) {
      centerButton.onclick = spin;
    }

    const oldCenter = $("rouletteCenterButton");

    if (oldCenter) {
      oldCenter.style.display = "none";
    }
  }

  function updateBet() {
    if ($("rouletteBetValue")) {
      $("rouletteBetValue").textContent = `R$ ${money(bet)}`;
    }

    document
      .querySelectorAll("[data-roulette-bet]")
      .forEach(element => {
        element.classList.toggle(
          "active",
          Number(element.dataset.rouletteBet) === bet
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
      value.replace(/\./g, "").replace(",", ".")
    );

    if (!Number.isFinite(number) || number < MIN) {
      return toast("Digite um valor a partir de R$ 0,50.");
    }

    setBet(number);
  }

  function resultIndex(result) {
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
        if (type && item.segment.type !== type) {
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

  function resultLabel(result) {
    return (
      result?.label ||
      result?.resultLabel ||
      result?.resultado?.label ||
      ROULETTE_SEGMENTS[resultIndex(result)]?.label ||
      "X"
    );
  }

  function animate(index) {
    const wheel = $("rouletteWheel");

    if (!wheel) {
      return Promise.resolve();
    }

    const angle = 360 / ROULETTE_SEGMENTS.length;

    const target =
      -(index * angle + angle / 2);

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

    try {
      await refreshUser();
    } catch {}

    syncFreeSpinFromServer();

    if (!freeSpin && bal() < bet) {
      return toast("Saldo insuficiente.");
    }

    busy = true;

    if ($("rouletteSpinButton")) {
      $("rouletteSpinButton").disabled = true;
    }

    if ($("rouletteCenterButton")) {
      $("rouletteCenterButton").disabled = true;
    }

    if ($("rouletteImageCenterButton")) {
      $("rouletteImageCenterButton").disabled = true;
    }

    $("rouletteResult").textContent = "Girando...";

    try {
      const data = await api("/roulette/spin", {
        method: "POST",
        body: JSON.stringify({
          userId: uid(),
          betAmount: bet,
          betType: "roulette",
          rouletteId: "popular",
          freeSpin
        })
      });

      const result =
        data.result ||
        data.resultado ||
        data;

      const index = resultIndex(result);

      await animate(index);

      if (data.user || data.usuario) {
        save(data.user || data.usuario);
      } else if (data.balance !== undefined) {
        user.balance = data.balance;
        save(user);
      }

      const prize = Number(
        data.prize ??
        data.payout ??
        result.prize ??
        result.payout ??
        0
      );

      const label = resultLabel(result);

      const gotFreeSpin =
        result.type === "sorte" ||
        label.includes("🍀");

      if (gotFreeSpin) {
        $("rouletteResult").textContent =
          "🍀 GIRO GRÁTIS!";

        $("winDisplay").textContent =
          "Giro grátis";
      } else if (prize > 0) {
        $("rouletteResult").textContent =
          `${label} — Você ganhou R$ ${money(prize)}`;

        $("winDisplay").textContent =
          `R$ ${money(prize)}`;
      } else {
        $("rouletteResult").textContent =
          `${label} — Boa sorte na próxima!`;

        $("winDisplay").textContent =
          "R$ 0,00";
      }

      try {
        await refreshUser();
      } catch {}

      syncFreeSpinFromServer();
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

      if ($("rouletteImageCenterButton")) {
        $("rouletteImageCenterButton").disabled = false;
      }
    }
  }

  function events() {
    if ($("backButton")) {
      $("backButton").onclick = () => {
        if (history.length > 1) {
          history.back();
        } else {
          location.href = "index.html";
        }
      };
    }

    if ($("stageBack")) {
      $("stageBack").onclick = back;
    }

    if ($("rouletteBetMinus")) {
      $("rouletteBetMinus").onclick = () => {
        setBet(Math.max(MIN, bet - STEP));
      };
    }

    if ($("rouletteBetPlus")) {
      $("rouletteBetPlus").onclick = () => {
        setBet(bet + STEP);
      };
    }

    if ($("rouletteOtherValue")) {
      $("rouletteOtherValue").onclick = other;
    }

    if ($("rouletteSpinButton")) {
      $("rouletteSpinButton").onclick = spin;
    }

    document
      .querySelectorAll("[data-roulette-bet]")
      .forEach(element => {
        element.onclick = () => {
          setBet(element.dataset.rouletteBet);
        };
      });
  }

  lobby();
  events();
  loadUser();

})();

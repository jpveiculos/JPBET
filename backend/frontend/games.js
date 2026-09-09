(() => {
  "use strict";

  const API = "/api";

  /*
   * Ordem lógica oficial da Roleta da Sorte:
   * 2× → X → 3× → X → 4× → X → 🍀 → X → 5× → X
   */
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

  const QUICK_BETS = [0.5, 1, 2, 5, 10, 50];
  const MIN_BET = 0.5;
  const BET_STEP = 0.5;

  let user = null;
  let bet = 0.5;
  let busy = false;
  let rotation = 0;
  let freeSpin = false;

  const $ = (id) => document.getElementById(id);

  function money(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function toast(message) {
    const element = $("toast");

    if (!element) {
      return;
    }

    element.textContent = message;
    element.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      element.classList.remove("show");
    }, 2600);
  }

  function storedUser() {
    try {
      return JSON.parse(
        localStorage.getItem("jpbet_user") || "null"
      );
    } catch {
      return null;
    }
  }

  function saveUser(value) {
    if (!value) {
      return;
    }

    user = {
      ...(user || {}),
      ...value
    };

    try {
      localStorage.setItem(
        "jpbet_user",
        JSON.stringify(user)
      );
    } catch {}
  }

  function userId() {
    return (
      user?.id ??
      user?.userId ??
      user?.user_id
    );
  }

  function balance() {
    if (!user) {
      return 0;
    }

    if (
      user.cash_balance !== undefined ||
      user.bonus_balance !== undefined
    ) {
      return (
        Number(user.cash_balance || 0) +
        Number(user.bonus_balance || 0)
      );
    }

    return Number(
      user.balance ??
      user.saldo ??
      user.cash ??
      0
    );
  }

  function updateBalances() {
    const value = money(balance());

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
    user = storedUser();

    const endpoints = [
      "/user/me",
      "/me",
      "/profile"
    ];

    for (const endpoint of endpoints) {
      try {
        const data = await api(endpoint);

        const loadedUser =
          data.user ||
          data.usuario ||
          data.player ||
          data;

        if (
          loadedUser?.id ||
          loadedUser?.userId ||
          loadedUser?.user_id
        ) {
          saveUser(loadedUser);
          break;
        }
      } catch {}
    }

    updateBalances();
  }

  function lobby() {
    const container = $("gamesContainer");

    if (!container) {
      return;
    }

    container.innerHTML = `
      <button
        class="game-card"
        id="rouletteCard"
        type="button"
      >
        <div class="game-card-icon">♛</div>

        <div>
          <strong>Roleta da Sorte</strong>
          <span>
            10 setores • Multiplicadores • 🍀 Giro grátis
          </span>
        </div>

        <b>JOGAR →</b>
      </button>
    `;

    const rouletteCard = $("rouletteCard");

    if (rouletteCard) {
      rouletteCard.onclick = openRoulette;
    }

    const message = $("gamesMessage");

    if (message) {
      message.textContent = "";
    }
  }

  function openRoulette() {
    if ($("gamesLobby")) {
      $("gamesLobby").hidden = true;
    }

    if ($("gameStage")) {
      $("gameStage").hidden = false;
    }

    if ($("roulettePanel")) {
      $("roulettePanel").hidden = false;
    }

    if ($("gameTitle")) {
      $("gameTitle").textContent = "Roleta da Sorte";
    }

    if ($("gameTypeLabel")) {
      $("gameTypeLabel").textContent = "ROLETA";
    }

    updateBet();
    updateBalances();
  }

  function back() {
    if ($("gameStage")) {
      $("gameStage").hidden = true;
    }

    if ($("gamesLobby")) {
      $("gamesLobby").hidden = false;
    }

    if ($("roulettePanel")) {
      $("roulettePanel").hidden = true;
    }

    if ($("rouletteResult")) {
      $("rouletteResult").textContent = "Faça sua aposta";
    }

    if ($("winDisplay")) {
      $("winDisplay").textContent = "R$ 0,00";
    }
  }

  function updateBet() {
    if ($("rouletteBetValue")) {
      $("rouletteBetValue").textContent =
        `R$ ${money(bet)}`;
    }

    document
      .querySelectorAll("[data-roulette-bet]")
      .forEach((element) => {
        element.classList.toggle(
          "active",
          Number(element.dataset.rouletteBet) === bet
        );
      });
  }

  function setBet(value) {
    value = Number(value);

    if (!Number.isFinite(value) || value < MIN_BET) {
      return;
    }

    bet = Math.round(value * 100) / 100;

    updateBet();
  }

  function otherValue() {
    const value = prompt(
      "Digite o valor da aposta em reais:",
      String(bet).replace(".", ",")
    );

    if (value === null) {
      return;
    }

    const parsed = Number(
      value
        .replace(/\./g, "")
        .replace(",", ".")
    );

    if (
      !Number.isFinite(parsed) ||
      parsed < MIN_BET
    ) {
      toast(
        "Digite um valor a partir de R$ 0,50."
      );
      return;
    }

    setBet(parsed);
  }

  function resultIndex(result) {
    if (
      Number.isInteger(result?.index)
    ) {
      return result.index;
    }

    if (
      Number.isInteger(result?.segmentIndex)
    ) {
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

    const possible = ROULETTE_SEGMENTS
      .map((segment, index) => ({
        segment,
        index
      }))
      .filter((item) => {
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

    return possible.length
      ? possible[0].index
      : 0;
  }

  function resultLabel(result) {
    const index = resultIndex(result);

    return (
      result?.label ||
      result?.resultLabel ||
      result?.resultado?.label ||
      ROULETTE_SEGMENTS[index]?.label ||
      "X"
    );
  }

  function animateWheel(index) {
    const wheel = $("rouletteWheel");

    if (!wheel) {
      return Promise.resolve();
    }

    /*
     * A imagem original é mantida intacta.
     * Apenas o elemento <img> gira.
     */
    const sliceAngle =
      360 / ROULETTE_SEGMENTS.length;

    /*
     * O centro do setor selecionado é levado
     * para o ponteiro superior.
     */
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

    return new Promise((resolve) => {
      setTimeout(resolve, 6000);
    });
  }

  async function spin() {
    if (busy) {
      return;
    }

    if (!userId()) {
      toast("Faça login para jogar.");
      return;
    }

    if (!freeSpin && balance() < bet) {
      toast("Saldo insuficiente.");
      return;
    }

    busy = true;

    if ($("rouletteSpinButton")) {
      $("rouletteSpinButton").disabled = true;
    }

    if ($("rouletteCenterButton")) {
      $("rouletteCenterButton").disabled = true;
    }

    if ($("rouletteResult")) {
      $("rouletteResult").textContent =
        "Girando...";
    }

    try {
      const data = await api(
        "/roulette/spin",
        {
          method: "POST",

          body: JSON.stringify({
            userId: userId(),
            betAmount: bet,
            betType: "roulette",
            rouletteId: "popular",
            freeSpin
          })
        }
      );

      const result =
        data.result ||
        data.resultado ||
        data;

      const index = resultIndex(result);

      await animateWheel(index);

      if (data.user || data.usuario) {
        saveUser(
          data.user ||
          data.usuario
        );
      } else if (
        data.balance !== undefined
      ) {
        user.balance = data.balance;
        saveUser(user);
      } else if (
        data.saldo !== undefined
      ) {
        user.saldo = data.saldo;
        saveUser(user);
      } else {
        if (data.cashBalance !== undefined) {
          user.cash_balance =
            data.cashBalance;
        }

        if (data.cash_balance !== undefined) {
          user.cash_balance =
            data.cash_balance;
        }

        if (data.bonusBalance !== undefined) {
          user.bonus_balance =
            data.bonusBalance;
        }

        if (data.bonus_balance !== undefined) {
          user.bonus_balance =
            data.bonus_balance;
        }

        saveUser(user);
      }

      const prize = Number(
        data.prize ??
        data.payout ??
        result.prize ??
        result.payout ??
        0
      );

      const label = resultLabel(result);

      const isFree =
        result.type === "sorte" ||
        result?.resultado?.type === "sorte" ||
        label.includes("🍀");

      if ($("rouletteResult")) {
        if (isFree) {
          $("rouletteResult").textContent =
            "🍀 GIRO GRÁTIS!";
        } else if (prize > 0) {
          $("rouletteResult").textContent =
            `${label} — Você ganhou R$ ${money(prize)}`;
        } else {
          $("rouletteResult").textContent =
            `${label} — Boa sorte na próxima!`;
        }
      }

      if ($("winDisplay")) {
        $("winDisplay").textContent =
          prize > 0
            ? `R$ ${money(prize)}`
            : "R$ 0,00";
      }

      if (isFree) {
        freeSpin = true;

        if ($("rouletteFreeSpinStatus")) {
          $("rouletteFreeSpinStatus").hidden = false;

          $("rouletteFreeSpinStatus").textContent =
            `🍀 Você ganhou 1 giro grátis de R$ ${money(bet)}.`;
        }

        if ($("rouletteFreeBadge")) {
          $("rouletteFreeBadge").hidden = false;
        }
      } else if (freeSpin) {
        freeSpin = false;

        if ($("rouletteFreeSpinStatus")) {
          $("rouletteFreeSpinStatus").hidden = true;
        }

        if ($("rouletteFreeBadge")) {
          $("rouletteFreeBadge").hidden = true;
        }
      }

      updateBalances();

    } catch (error) {

      toast(
        error.message ||
        "Erro ao girar a roleta."
      );

      if ($("rouletteResult")) {
        $("rouletteResult").textContent =
          "Não foi possível realizar o giro.";
      }

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

    const backButton = $("backButton");

    if (backButton) {
      backButton.onclick = () => {
        if (history.length > 1) {
          history.back();
        } else {
          location.href = "index.html";
        }
      };
    }

    const stageBack = $("stageBack");

    if (stageBack) {
      stageBack.onclick = back;
    }

    const minus = $("rouletteBetMinus");

    if (minus) {
      minus.onclick = () => {
        setBet(
          Math.max(
            MIN_BET,
            bet - BET_STEP
          )
        );
      };
    }

    const plus = $("rouletteBetPlus");

    if (plus) {
      plus.onclick = () => {
        setBet(bet + BET_STEP);
      };
    }

    const other = $("rouletteOtherValue");

    if (other) {
      other.onclick = otherValue;
    }

    const spinButton =
      $("rouletteSpinButton");

    if (spinButton) {
      spinButton.onclick = spin;
    }

    const centerButton =
      $("rouletteCenterButton");

    if (centerButton) {
      centerButton.onclick = spin;
    }

    document
      .querySelectorAll("[data-roulette-bet]")
      .forEach((element) => {
        element.onclick = () => {
          setBet(
            element.dataset.rouletteBet
          );
        };
      });
  }

  lobby();
  events();
  loadUser();

})();

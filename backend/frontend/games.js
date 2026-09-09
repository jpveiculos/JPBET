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

  function money(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function toast(message) {
    const el = $("toast");

    if (!el) {
      alert(message);
      return;
    }

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      el.classList.remove("show");
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

  function saveUser(data) {
    if (!data) return;

    user = data;

    try {
      localStorage.setItem(
        "jpbet_user",
        JSON.stringify(data)
      );
    } catch {}
  }

  function userId() {
    return (
      user?.id ??
      user?.userId ??
      user?.user_id ??
      null
    );
  }

  function balance() {
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
      Number.isFinite(bonus) &&
      Number.isFinite(cash)
    ) {
      return bonus + cash;
    }

    return Number(
      user.balance ??
      user.saldo ??
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
      const token =
        localStorage.getItem("jpbet_token");

      if (token) {
        headers.Authorization =
          `Bearer ${token}`;
      }
    } catch {}

    const response = await fetch(
      API + path,
      {
        ...options,
        headers
      }
    );

    const text =
      await response.text();

    let data = {};

    try {
      data =
        text
          ? JSON.parse(text)
          : {};
    } catch {}

    if (!response.ok) {
      throw new Error(
        data.message ||
        data.error ||
        `Erro HTTP ${response.status}`
      );
    }

    return data;
  }

  async function loadUser() {
    user = storedUser();

    const id = userId();

    if (!id) {
      updateBalances();
      return;
    }

    try {
      const data =
        await api(
          `/user/${encodeURIComponent(id)}`
        );

      if (data?.user) {
        saveUser(data.user);
      }

    } catch (error) {
      console.error(
        "Erro ao carregar usuário:",
        error
      );
    }

    updateBalances();
  }

  function renderLobby() {
    const container =
      $("gamesContainer");

    const message =
      $("gamesMessage");

    if (!container) {
      console.error(
        "gamesContainer não encontrado."
      );
      return;
    }

    container.innerHTML = `
      <button
        class="game-card"
        id="rouletteCard"
        type="button"
      >
        <div class="game-card-icon">
          ♛
        </div>

        <div>
          <strong>
            Roleta da Sorte
          </strong>

          <span>
            10 setores • Multiplicadores • 🍀 Giro grátis
          </span>
        </div>

        <b>
          JOGAR →
        </b>
      </button>
    `;

    const card =
      $("rouletteCard");

    if (card) {
      card.addEventListener(
        "click",
        openRoulette
      );
    }

    if (message) {
      message.hidden = true;
    }
  }

  function openRoulette() {
    const lobby =
      $("gamesLobby");

    const stage =
      $("gameStage");

    const panel =
      $("roulettePanel");

    if (lobby) {
      lobby.hidden = true;
    }

    if (stage) {
      stage.hidden = false;
    }

    if (panel) {
      panel.hidden = false;
    }

    if ($("gameTitle")) {
      $("gameTitle").textContent =
        "Roleta da Sorte";
    }

    if ($("gameTypeLabel")) {
      $("gameTypeLabel").textContent =
        "ROLETA";
    }

    createWheel();
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
  }

  function createWheel() {
    const wheel =
      $("rouletteWheel");

    if (!wheel) {
      console.error(
        "rouletteWheel não encontrado."
      );
      return;
    }

    wheel.innerHTML = "";

    const angle =
      360 / ROULETTE_SEGMENTS.length;

    ROULETTE_SEGMENTS.forEach(
      (segment, index) => {
        const element =
          document.createElement("div");

        element.className =
          "roulette-label";

        element.dataset.type =
          segment.type;

        element.dataset.multiplier =
          segment.multiplier;

        element.style.setProperty(
          "--angle",
          `${index * angle}deg`
        );

        element.style.setProperty(
          "--slice-angle",
          `${angle}deg`
        );

        element.innerHTML =
          `<span>${segment.label}</span>`;

        wheel.appendChild(element);
      }
    );

    wheel.style.transform =
      `rotate(${rotation}deg)`;
  }

  function updateBet() {
    if ($("rouletteBetValue")) {
      $("rouletteBetValue")
        .textContent =
        `R$ ${money(bet)}`;
    }

    document
      .querySelectorAll(
        "[data-roulette-bet]"
      )
      .forEach(button => {
        button.classList.toggle(
          "active",
          Number(
            button.dataset.rouletteBet
          ) === bet
        );
      });
  }

  function setBet(value) {
    const number =
      Number(value);

    if (
      !Number.isFinite(number) ||
      number < MIN
    ) {
      return;
    }

    bet =
      Math.round(number * 100) / 100;

    updateBet();
  }

  function otherValue() {
    const value =
      prompt(
        "Digite o valor da aposta em reais:",
        String(bet).replace(".", ",")
      );

    if (value === null) {
      return;
    }

    const number =
      Number(
        value
          .replace(/\./g, "")
          .replace(",", ".")
      );

    if (
      !Number.isFinite(number) ||
      number < MIN
    ) {
      toast(
        "Digite um valor a partir de R$ 0,50."
      );
      return;
    }

    setBet(number);
  }

  function resultIndex(result) {
    if (
      Number.isInteger(
        result?.index
      )
    ) {
      return result.index;
    }

    if (
      Number.isInteger(
        result?.segmentIndex
      )
    ) {
      return result.segmentIndex;
    }

    return 0;
  }

  function resultLabel(result) {
    const index =
      resultIndex(result);

    return (
      result?.label ||
      ROULETTE_SEGMENTS[index]?.label ||
      "X"
    );
  }

  function animate(index) {
    const wheel =
      $("rouletteWheel");

    if (!wheel) {
      return Promise.resolve();
    }

    const angle =
      360 / ROULETTE_SEGMENTS.length;

    const target =
      -(index * angle + angle / 2);

    const current =
      ((rotation % 360) + 360) % 360;

    let distance =
      target - current;

    while (distance < 0) {
      distance += 360;
    }

    rotation +=
      7 * 360 + distance;

    wheel.style.transition =
      "transform 5.8s cubic-bezier(.12,.78,.16,1)";

    wheel.style.transform =
      `rotate(${rotation}deg)`;

    return new Promise(resolve => {
      setTimeout(resolve, 6000);
    });
  }

  async function refreshUserFromServer() {
    const id =
      userId();

    if (!id) {
      return;
    }

    try {
      const data =
        await api(
          `/user/${encodeURIComponent(id)}`
        );

      if (data?.user) {
        saveUser(data.user);
        updateBalances();
      }
    } catch (error) {
      console.error(
        "Erro ao atualizar saldo:",
        error
      );
    }
  }

  async function spin() {
    if (busy) {
      return;
    }

    const id =
      userId();

    if (!id) {
      toast(
        "Faça login para jogar."
      );
      return;
    }

    await refreshUserFromServer();

    if (
      !freeSpin &&
      balance() < bet
    ) {
      toast(
        "Saldo insuficiente."
      );
      return;
    }

    busy = true;

    const spinButton =
      $("rouletteSpinButton");

    if (spinButton) {
      spinButton.disabled = true;
    }

    const result =
      $("rouletteResult");

    if (result) {
      result.textContent =
        "Girando...";
    }

    try {
      const data =
        await api(
          "/roulette/spin",
          {
            method: "POST",

            body: JSON.stringify({
              userId: id,
              betAmount: bet,
              betType: "roulette",
              rouletteId: "popular",
              freeSpin
            })
          }
        );

      const rouletteResult =
        data.result ||
        data.resultado ||
        data;

      const index =
        resultIndex(
          rouletteResult
        );

      await animate(index);

      if (data.user) {
        saveUser(data.user);
      }

      const prize =
        Number(
          rouletteResult?.prize ??
          data.prize ??
          0
        );

      const label =
        resultLabel(
          rouletteResult
        );

      const isFree =
        rouletteResult?.type ===
          "sorte" ||
        label.includes("🍀");

      if (result) {
        if (isFree) {
          result.textContent =
            "🍀 GIRO GRÁTIS!";
        } else if (prize > 0) {
          result.textContent =
            `${label} — Você ganhou R$ ${money(prize)}`;
        } else {
          result.textContent =
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
          $("rouletteFreeSpinStatus").hidden =
            false;

          $("rouletteFreeSpinStatus").textContent =
            `🍀 Você ganhou 1 giro grátis de R$ ${money(bet)}.`;
        }

        if ($("rouletteFreeBadge")) {
          $("rouletteFreeBadge").hidden =
            false;
        }

      } else if (freeSpin) {
        freeSpin = false;

        if ($("rouletteFreeSpinStatus")) {
          $("rouletteFreeSpinStatus").hidden =
            true;
        }

        if ($("rouletteFreeBadge")) {
          $("rouletteFreeBadge").hidden =
            true;
        }
      }

      updateBalances();

      await refreshUserFromServer();

    } catch (error) {
      console.error(
        "Erro ao girar roleta:",
        error
      );

      toast(
        error.message ||
        "Erro ao girar a roleta."
      );

      if (result) {
        result.textContent =
          "Não foi possível realizar o giro.";
      }

    } finally {
      busy = false;

      if (spinButton) {
        spinButton.disabled = false;
      }
    }
  }

  function events() {
    if ($("backButton")) {
      $("backButton").onclick =
        () => {
          if (
            window.history.length > 1
          ) {
            history.back();
          } else {
            location.href =
              "index.html";
          }
        };
    }

    if ($("stageBack")) {
      $("stageBack").onclick =
        back;
    }

    if ($("rouletteBetMinus")) {
      $("rouletteBetMinus").onclick =
        () =>
          setBet(
            Math.max(
              MIN,
              bet - STEP
            )
          );
    }

    if ($("rouletteBetPlus")) {
      $("rouletteBetPlus").onclick =
        () =>
          setBet(
            bet + STEP
          );
    }

    if ($("rouletteOtherValue")) {
      $("rouletteOtherValue").onclick =
        otherValue;
    }

    if ($("rouletteSpinButton")) {
      $("rouletteSpinButton").onclick =
        spin;
    }

    document
      .querySelectorAll(
        "[data-roulette-bet]"
      )
      .forEach(button => {
        button.onclick =
          () =>
            setBet(
              button.dataset
                .rouletteBet
            );
      });
  }

  function init() {
    renderLobby();
    events();
    updateBet();
    updateBalances();
    loadUser();
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }

})();

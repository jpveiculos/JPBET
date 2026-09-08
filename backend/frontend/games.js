(() => {
  "use strict";

  const API = "/api";

  // ============================================================
  // ROLETA DA SORTE — MYBETS
  // Ordem oficial:
  // 2× → X → 3× → X → 4× → X → 🍀 → X → 5× → X
  // ============================================================

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

  const SEGMENT_COUNT = ROULETTE_SEGMENTS.length;
  const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;

  let MIN_BET = 0.50;
  let MAX_BET = 20.00;
  const BET_STEP = 0.50;

  const DEFAULT_QUICK_BETS = [0.50, 1, 2, 5, 10, 20];

  let currentUser = null;
  let currentBet = MIN_BET;
  let freeSpin = false;
  let spinning = false;
  let wheelRotation = 0;

  // ============================================================
  // ELEMENTOS
  // ============================================================

  const $ = (id) => document.getElementById(id);

  const roulettePanel = $("roulettePanel");
  const rouletteWheel = $("rouletteWheel");
  const rouletteCenterButton = $("rouletteCenterButton");
  const rouletteResult = $("rouletteResult");
  const rouletteBetValue = $("rouletteBetValue");
  const rouletteSpinButton = $("rouletteSpinButton");
  const rouletteBetMinus = $("rouletteBetMinus");
  const rouletteBetPlus = $("rouletteBetPlus");
  const rouletteQuickBets = $("rouletteQuickBets");
  const rouletteOtherValue = $("rouletteOtherValue");
  const rouletteFreeSpinStatus = $("rouletteFreeSpinStatus");
  const rouletteFreeBadge = $("rouletteFreeBadge");
  const rouletteBulbs = $("rouletteBulbs");

  // ============================================================
  // API
  // ============================================================

  async function api(url, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    const token =
      localStorage.getItem("jpbet_token") ||
      localStorage.getItem("mybets_token");

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API}${url}`, {
      ...options,
      headers
    });

    let data = null;

    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      const message =
        data?.error ||
        data?.message ||
        `Erro HTTP ${response.status}`;

      throw new Error(message);
    }

    return data;
  }

  // ============================================================
  // USUÁRIO
  // ============================================================

  function getStoredUser() {
    try {
      const raw = localStorage.getItem("jpbet_user");

      if (raw) {
        return JSON.parse(raw);
      }
    } catch (_) {}

    try {
      const raw = localStorage.getItem("mybets_user");

      if (raw) {
        return JSON.parse(raw);
      }
    } catch (_) {}

    return null;
  }

  function getUserId() {
    return (
      currentUser?.id ||
      currentUser?.userId ||
      currentUser?.user_id ||
      getStoredUser()?.id ||
      getStoredUser()?.userId ||
      getStoredUser()?.user_id ||
      null
    );
  }

  function saveUser(user) {
    if (!user) return;

    currentUser = {
      ...(currentUser || {}),
      ...user
    };

    try {
      localStorage.setItem(
        "jpbet_user",
        JSON.stringify(currentUser)
      );
    } catch (_) {}

    try {
      localStorage.setItem(
        "mybets_user",
        JSON.stringify(currentUser)
      );
    } catch (_) {}
  }

  function getBalance(user = currentUser) {
    if (!user) return 0;

    const values = [
      user.balance,
      user.saldo,
      user.cash_balance
    ];

    for (const value of values) {
      const number = Number(value);

      if (Number.isFinite(number)) {
        return number;
      }
    }

    return 0;
  }

  function getFreeSpins(user = currentUser) {
    if (!user) return 0;

    const values = [
      user.roulette_free_spins,
      user.rouletteFreeSpins,
      user.freeSpinsAvailable
    ];

    for (const value of values) {
      const number = Number(value);

      if (Number.isFinite(number)) {
        return Math.max(0, Math.floor(number));
      }
    }

    return 0;
  }

  function getFreeSpinBet(user = currentUser) {
    if (!user) return currentBet;

    const values = [
      user.roulette_free_spin_bet,
      user.rouletteFreeSpinBet
    ];

    for (const value of values) {
      const number = Number(value);

      if (Number.isFinite(number) && number > 0) {
        return number;
      }
    }

    return currentBet;
  }

  function updateBalanceUI() {
    const balance = getBalance();

    const elements = document.querySelectorAll(
      "[data-balance], #balance, #userBalance, #saldo"
    );

    elements.forEach((element) => {
      element.textContent = `R$ ${balance
        .toFixed(2)
        .replace(".", ",")}`;
    });
  }

  function updateUserFromResponse(data) {
    if (!data) return;

    if (data.user) {
      saveUser(data.user);
    }

    if (data.usuario) {
      saveUser(data.usuario);
    }

    if (
      data.balance !== undefined &&
      currentUser
    ) {
      currentUser.balance = Number(data.balance);
    }

    if (
      data.saldo !== undefined &&
      currentUser
    ) {
      currentUser.balance = Number(data.saldo);
    }

    updateBalanceUI();
  }

  // ============================================================
  // CARREGAR USUÁRIO
  // ============================================================

  async function loadUser() {
    const stored = getStoredUser();

    if (stored) {
      currentUser = stored;
      updateBalanceUI();
      syncFreeSpinState();
    }

    const endpoints = [
      "/user/me",
      "/me",
      "/profile"
    ];

    for (const endpoint of endpoints) {
      try {
        const data = await api(endpoint);

        const user =
          data?.user ||
          data?.usuario ||
          data;

        if (user && typeof user === "object") {
          saveUser(user);
          updateBalanceUI();
          syncFreeSpinState();
          return currentUser;
        }
      } catch (_) {}
    }

    return currentUser;
  }

  // ============================================================
  // CONFIGURAÇÕES DA ROLETA
  // ============================================================

  async function loadRouletteSettings() {
    try {
      const data = await api("/settings");

      const settings =
        data?.settings ||
        data?.configuracoes ||
        data ||
        {};

      const minValue = Number(
        settings.roulette_popular_min_bet ??
        settings.roulette_min_bet
      );

      const maxValue = Number(
        settings.roulette_popular_max_bet ??
        settings.roulette_max_bet
      );

      if (
        Number.isFinite(minValue) &&
        minValue > 0
      ) {
        MIN_BET = minValue;
      }

      if (
        Number.isFinite(maxValue) &&
        maxValue >= MIN_BET
      ) {
        MAX_BET = maxValue;
      }

      currentBet = clampBet(currentBet);

      renderQuickBets();
      updateBetUI();
    } catch (_) {
      // Mantém os valores padrão se a configuração pública
      // não estiver disponível.
    }
  }

  // ============================================================
  // APOSTA
  // ============================================================

  function clampBet(value) {
    let bet = Number(value);

    if (!Number.isFinite(bet)) {
      bet = MIN_BET;
    }

    bet = Math.max(MIN_BET, Math.min(MAX_BET, bet));

    bet =
      Math.round((bet + Number.EPSILON) / BET_STEP) *
      BET_STEP;

    bet = Math.max(MIN_BET, Math.min(MAX_BET, bet));

    return Number(bet.toFixed(2));
  }

  function formatMoney(value) {
    return Number(value || 0)
      .toFixed(2)
      .replace(".", ",");
  }

  function setBet(value) {
    if (spinning || freeSpin) return;

    currentBet = clampBet(value);

    updateBetUI();
    updateQuickBetSelection();
  }

  function updateBetUI() {
    if (rouletteBetValue) {
      rouletteBetValue.textContent =
        `R$ ${formatMoney(currentBet)}`;
    }

    if (rouletteBetMinus) {
      rouletteBetMinus.disabled =
        spinning ||
        freeSpin ||
        currentBet <= MIN_BET;
    }

    if (rouletteBetPlus) {
      rouletteBetPlus.disabled =
        spinning ||
        freeSpin ||
        currentBet >= MAX_BET;
    }
  }

  function updateQuickBetSelection() {
    if (!rouletteQuickBets) return;

    const buttons =
      rouletteQuickBets.querySelectorAll(
        "button"
      );

    buttons.forEach((button) => {
      const value = Number(
        button.dataset.bet
      );

      button.classList.toggle(
        "active",
        Math.abs(value - currentBet) < 0.001
      );
    });
  }

  function renderQuickBets() {
    if (!rouletteQuickBets) return;

    rouletteQuickBets.innerHTML = "";

    const values = DEFAULT_QUICK_BETS
      .filter(
        (value) =>
          value >= MIN_BET &&
          value <= MAX_BET
      );

    values.forEach((value) => {
      const button = document.createElement("button");

      button.type = "button";
      button.dataset.bet = value;
      button.textContent =
        value < 1
          ? `R$ ${formatMoney(value)}`
          : `R$ ${Number(value).toFixed(0)}`;

      button.addEventListener(
        "click",
        () => setBet(value)
      );

      rouletteQuickBets.appendChild(button);
    });

    updateQuickBetSelection();
  }

  function chooseOtherValue() {
    if (spinning || freeSpin) return;

    const raw = prompt(
      `Digite o valor da aposta entre R$ ${formatMoney(
        MIN_BET
      )} e R$ ${formatMoney(MAX_BET)}:`
    );

    if (raw === null) return;

    const normalized = raw
      .replace(",", ".")
      .trim();

    const value = Number(normalized);

    if (!Number.isFinite(value)) {
      alert("Digite um valor válido.");
      return;
    }

    if (
      value < MIN_BET ||
      value > MAX_BET
    ) {
      alert(
        `A aposta deve ficar entre R$ ${formatMoney(
          MIN_BET
        )} e R$ ${formatMoney(MAX_BET)}.`
      );
      return;
    }

    setBet(value);
  }

  // ============================================================
  // FREE SPIN
  // ============================================================

  function syncFreeSpinState() {
    const available = getFreeSpins();

    freeSpin = available > 0;

    if (freeSpin) {
      const freeBet = getFreeSpinBet();

      currentBet = clampBet(freeBet);

      if (rouletteFreeSpinStatus) {
        rouletteFreeSpinStatus.textContent =
          available === 1
            ? "🍀 Você tem 1 giro grátis disponível."
            : `🍀 Você tem ${available} giros grátis disponíveis.`;
      }

      if (rouletteFreeBadge) {
        rouletteFreeBadge.hidden = false;
        rouletteFreeBadge.textContent =
          available === 1
            ? "🍀 1 GIRO GRÁTIS"
            : `🍀 ${available} GIROS GRÁTIS`;
      }

      if (rouletteBetValue) {
        rouletteBetValue.textContent =
          `R$ ${formatMoney(currentBet)}`;
      }
    } else {
      if (rouletteFreeSpinStatus) {
        rouletteFreeSpinStatus.textContent =
          "";
      }

      if (rouletteFreeBadge) {
        rouletteFreeBadge.hidden = true;
      }
    }

    updateBetUI();
  }

  function showFreeSpinAvailable(count) {
    const amount =
      Number.isFinite(Number(count))
        ? Number(count)
        : getFreeSpins();

    if (rouletteFreeBadge) {
      rouletteFreeBadge.hidden = false;
      rouletteFreeBadge.textContent =
        amount === 1
          ? "🍀 1 GIRO GRÁTIS"
          : `🍀 ${amount} GIROS GRÁTIS`;
    }

    if (rouletteFreeSpinStatus) {
      rouletteFreeSpinStatus.textContent =
        amount === 1
          ? "🍀 Giro grátis liberado!"
          : `🍀 ${amount} giros grátis disponíveis!`;
    }
  }

  // ============================================================
  // RENDERIZAÇÃO DA ROLETA
  // ============================================================

  function createWheel() {
    if (!rouletteWheel) return;

    rouletteWheel.innerHTML = "";

    ROULETTE_SEGMENTS.forEach(
      (segment, index) => {
        const label =
          document.createElement("div");

        label.className =
          "roulette-label";

        label.dataset.type =
          segment.type;

        label.dataset.index =
          index;

        label.style.setProperty(
          "--angle",
          `${index * SEGMENT_ANGLE}deg`
        );

        label.textContent =
          segment.label;

        if (segment.type === "prize") {
          label.dataset.multiplier =
            String(segment.multiplier);
        }

        rouletteWheel.appendChild(label);
      }
    );

    createBulbs();

    applyWheelRotation();
  }

  function createBulbs() {
    if (!rouletteBulbs) return;

    rouletteBulbs.innerHTML = "";

    const bulbCount = 30;

    for (let i = 0; i < bulbCount; i++) {
      const bulb =
        document.createElement("span");

      bulb.className = "roulette-bulb";

      const angle =
        (360 / bulbCount) * i;

      bulb.style.setProperty(
        "--bulb-angle",
        `${angle}deg`
      );

      rouletteBulbs.appendChild(bulb);
    }
  }

  function applyWheelRotation() {
    if (!rouletteWheel) return;

    rouletteWheel.style.transform =
      `rotate(${wheelRotation}deg)`;
  }

  // ============================================================
  // RESULTADO DA ROLETA
  // ============================================================

  function getResultIndex(result) {
    if (!result) return -1;

    const directIndex =
      Number.isInteger(result.index)
        ? result.index
        : Number.isInteger(result.segmentIndex)
        ? result.segmentIndex
        : null;

    if (
      directIndex !== null &&
      directIndex >= 0 &&
      directIndex < SEGMENT_COUNT
    ) {
      return directIndex;
    }

    // Compatibilidade com versões antigas da API.
    const label = String(
      result.label ||
      result.result ||
      result.outcome ||
      ""
    ).trim();

    const multiplier = Number(
      result.multiplier
    );

    if (label) {
      const exactLabel =
        ROULETTE_SEGMENTS.findIndex(
          (segment) =>
            segment.label === label
        );

      if (exactLabel >= 0) {
        return exactLabel;
      }
    }

    if (
      Number.isFinite(multiplier)
    ) {
      const exactMultiplier =
        ROULETTE_SEGMENTS.findIndex(
          (segment) =>
            segment.type === "prize" &&
            segment.multiplier === multiplier
        );

      if (exactMultiplier >= 0) {
        return exactMultiplier;
      }
    }

    return -1;
  }

  // ============================================================
  // ANIMAÇÃO
  // ============================================================

  function animateWheel(resultIndex) {
    return new Promise((resolve) => {
      if (!rouletteWheel) {
        resolve();
        return;
      }

      let index = Number(resultIndex);

      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= SEGMENT_COUNT
      ) {
        index = 0;
      }

      /*
       * O ponteiro fica fixo no topo.
       *
       * Cada setor tem 36 graus.
       * O +18 posiciona o centro do setor
       * exatamente no ponteiro.
       */

      const targetAngle =
        -(index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2);

      const normalizedCurrent =
        ((wheelRotation % 360) + 360) % 360;

      const normalizedTarget =
        ((targetAngle % 360) + 360) % 360;

      let delta =
        normalizedTarget -
        normalizedCurrent;

      if (delta > 0) {
        delta -= 360;
      }

      const extraTurns =
        6 * 360;

      wheelRotation +=
        extraTurns + delta;

      rouletteWheel.style.transition =
        "transform 5.2s cubic-bezier(0.12, 0.75, 0.18, 1)";

      rouletteWheel.style.transform =
        `rotate(${wheelRotation}deg)`;

      setTimeout(() => {
        resolve();
      }, 5300);
    });
  }

  // ============================================================
  // RESULTADO VISUAL
  // ============================================================

  function showResult(result) {
    if (!rouletteResult) return;

    const index =
      getResultIndex(result);

    const segment =
      index >= 0
        ? ROULETTE_SEGMENTS[index]
        : null;

    const type =
      result?.type ||
      result?.resultType ||
      segment?.type ||
      "";

    const multiplier =
      Number(
        result?.multiplier ??
        segment?.multiplier ??
        0
      );

    if (
      type === "sorte" ||
      segment?.type === "sorte"
    ) {
      rouletteResult.innerHTML =
        `<strong>🍀 GIRO GRÁTIS!</strong>`;

      rouletteResult.className =
        "roulette-result result-free";

      return;
    }

    if (
      multiplier > 0
    ) {
      rouletteResult.innerHTML =
        `<strong>${multiplier}×</strong>`;

      rouletteResult.className =
        `roulette-result result-${multiplier}`;

      return;
    }

    rouletteResult.innerHTML =
      `<strong>❌ PERDEU</strong>`;

    rouletteResult.className =
      "roulette-result result-zero";
  }

  // ============================================================
  // GIRO
  // ============================================================

  async function spinRoulette() {
    if (spinning) return;

    const userId = getUserId();

    if (!userId) {
      alert(
        "Não foi possível identificar seu usuário. Faça login novamente."
      );
      return;
    }

    const bet = clampBet(currentBet);

    if (!freeSpin) {
      const balance = getBalance();

      if (balance < bet) {
        alert(
          `Saldo insuficiente para apostar R$ ${formatMoney(
            bet
          )}.`
        );
        return;
      }
    }

    spinning = true;

    setSpinControls(true);

    if (rouletteResult) {
      rouletteResult.textContent =
        "Boa sorte! 🎰";
      rouletteResult.className =
        "roulette-result";
    }

    try {
      const data = await api(
        "/roulette/spin",
        {
          method: "POST",

          body: JSON.stringify({
            userId,
            betAmount: bet,
            betType: "roulette",
            rouletteId: "popular",
            freeSpin
          })
        }
      );

      updateUserFromResponse(data);

      const result =
        data?.result ||
        data?.resultado ||
        data;

      const resultIndex =
        getResultIndex(result);

      await animateWheel(
        resultIndex
      );

      showResult(result);

      // --------------------------------------------------------
      // GIRO GRÁTIS GANHO
      // --------------------------------------------------------

      const resultType =
        result?.type ||
        result?.resultType ||
        (
          resultIndex >= 0
            ? ROULETTE_SEGMENTS[resultIndex].type
            : ""
        );

      const wonFreeSpin =
        resultType === "sorte";

      if (wonFreeSpin) {
        freeSpin = true;

        if (
          data?.freeSpinsAvailable !==
          undefined
        ) {
          if (!currentUser) {
            currentUser = {};
          }

          currentUser.roulette_free_spins =
            Number(
              data.freeSpinsAvailable
            );
        }

        showFreeSpinAvailable(
          data?.freeSpinsAvailable ??
          getFreeSpins()
        );
      } else {
        // ------------------------------------------------------
        // GIRO GRÁTIS CONSUMIDO
        // ------------------------------------------------------

        if (
          data?.freeSpinsAvailable !==
          undefined
        ) {
          const remaining =
            Number(
              data.freeSpinsAvailable
            );

          if (!currentUser) {
            currentUser = {};
          }

          currentUser.roulette_free_spins =
            remaining;

          freeSpin =
            remaining > 0;

          if (freeSpin) {
            currentBet =
              clampBet(
                getFreeSpinBet()
              );

            showFreeSpinAvailable(
              remaining
            );
          } else {
            if (rouletteFreeBadge) {
              rouletteFreeBadge.hidden =
                true;
            }

            if (rouletteFreeSpinStatus) {
              rouletteFreeSpinStatus.textContent =
                "";
            }
          }
        }
      }

      saveUser(currentUser);
      updateBalanceUI();
      updateBetUI();

    } catch (error) {
      console.error(
        "Erro ao girar roleta:",
        error
      );

      alert(
        error?.message ||
        "Não foi possível realizar o giro."
      );
    } finally {
      spinning = false;
      setSpinControls(false);
      syncFreeSpinState();
    }
  }

  // ============================================================
  // CONTROLES
  // ============================================================

  function setSpinControls(disabled) {
    if (rouletteSpinButton) {
      rouletteSpinButton.disabled =
        disabled;
    }

    if (rouletteCenterButton) {
      rouletteCenterButton.disabled =
        disabled;
    }

    if (rouletteBetMinus) {
      rouletteBetMinus.disabled =
        disabled ||
        freeSpin ||
        currentBet <= MIN_BET;
    }

    if (rouletteBetPlus) {
      rouletteBetPlus.disabled =
        disabled ||
        freeSpin ||
        currentBet >= MAX_BET;
    }

    if (rouletteQuickBets) {
      rouletteQuickBets
        .querySelectorAll("button")
        .forEach((button) => {
          button.disabled =
            disabled || freeSpin;
        });
    }
  }

  // ============================================================
  // ABRIR / FECHAR ROLETA
  // ============================================================

  function openRoulette() {
    if (!roulettePanel) return;

    roulettePanel.hidden = false;

    createWheel();
    renderQuickBets();
    updateBetUI();
    syncFreeSpinState();

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function closeRoulette() {
    if (!roulettePanel) return;

    roulettePanel.hidden = true;
  }

  // ============================================================
  // LOBBY
  // ============================================================

  function renderLobby() {
    const gameCards =
      document.querySelectorAll(
        "[data-game='roulette'], .game-card"
      );

    gameCards.forEach((card) => {
      card.addEventListener(
        "click",
        () => {
          openRoulette();
        }
      );
    });
  }

  // ============================================================
  // EVENTOS
  // ============================================================

  function bindEvents() {
    if (rouletteBetMinus) {
      rouletteBetMinus.addEventListener(
        "click",
        () => {
          if (spinning || freeSpin) return;

          setBet(
            currentBet - BET_STEP
          );
        }
      );
    }

    if (rouletteBetPlus) {
      rouletteBetPlus.addEventListener(
        "click",
        () => {
          if (spinning || freeSpin) return;

          setBet(
            currentBet + BET_STEP
          );
        }
      );
    }

    if (rouletteSpinButton) {
      rouletteSpinButton.addEventListener(
        "click",
        spinRoulette
      );
    }

    if (rouletteCenterButton) {
      rouletteCenterButton.addEventListener(
        "click",
        spinRoulette
      );
    }

    if (rouletteOtherValue) {
      rouletteOtherValue.addEventListener(
        "click",
        chooseOtherValue
      );
    }

    const backButtons =
      document.querySelectorAll(
        "[data-back], #backButton, #gamesBack"
      );

    backButtons.forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          if (
            roulettePanel &&
            !roulettePanel.hidden
          ) {
            closeRoulette();
            return;
          }

          if (
            document.referrer &&
            document.referrer !==
              window.location.href
          ) {
            history.back();
          } else {
            window.location.href = "/";
          }
        }
      );
    });

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape" &&
          roulettePanel &&
          !roulettePanel.hidden &&
          !spinning
        ) {
          closeRoulette();
        }
      }
    );
  }

  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================

  async function init() {
    currentUser =
      getStoredUser();

    currentBet =
      clampBet(MIN_BET);

    bindEvents();
    renderLobby();
    createWheel();
    renderQuickBets();
    updateBetUI();

    await loadUser();
    await loadRouletteSettings();

    syncFreeSpinState();

    // Se a página já abrir mostrando a roleta,
    // garante que tudo esteja pronto.
    if (
      roulettePanel &&
      !roulettePanel.hidden
    ) {
      createWheel();
    }

    updateBalanceUI();
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

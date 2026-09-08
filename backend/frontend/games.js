(() => {
  "use strict";

  const API = "/api";

  /*
  ============================================================
  MYBETS — ROLETA DA SORTE
  10 SETORES
  ============================================================
  */

  const ROULETTE_SEGMENTS = [
    {
      label: "5×",
      type: "prize",
      multiplier: 5
    },
    {
      label: "X",
      type: "zero",
      multiplier: 0
    },
    {
      label: "2×",
      type: "prize",
      multiplier: 2
    },
    {
      label: "X",
      type: "zero",
      multiplier: 0
    },
    {
      label: "4×",
      type: "prize",
      multiplier: 4
    },
    {
      label: "X",
      type: "zero",
      multiplier: 0
    },
    {
      label: "🍀",
      type: "sorte",
      multiplier: 0
    },
    {
      label: "X",
      type: "zero",
      multiplier: 0
    },
    {
      label: "3×",
      type: "prize",
      multiplier: 3
    },
    {
      label: "X",
      type: "zero",
      multiplier: 0
    }
  ];

  /*
  ============================================================
  APOSTAS
  ============================================================
  */

  const QUICK_BETS = [
    0.50,
    1,
    2,
    5,
    10,
    50
  ];

  const MIN_BET = 0.50;
  const BET_STEP = 0.50;

  /*
  ============================================================
  ESTADO
  ============================================================
  */

  let user = null;
  let bet = 0.50;
  let busy = false;

  let rotation = 0;

  let freeSpin = false;

  /*
  ============================================================
  HELPERS
  ============================================================
  */

  const $ = (id) => document.getElementById(id);

  function money(value) {
    return Number(value || 0).toLocaleString(
      "pt-BR",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    );
  }

  function showToast(message) {
    const element = $("toast");

    if (!element) {
      return;
    }

    element.textContent = message;

    element.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
      element.classList.remove("show");
    }, 2600);
  }

  /*
  ============================================================
  USUÁRIO / SESSÃO
  ============================================================
  */

  function getStoredUser() {
    try {
      return JSON.parse(
        localStorage.getItem("jpbet_user") || "null"
      );
    } catch {
      return null;
    }
  }

  function saveUser(currentUser) {
    if (!currentUser) {
      return;
    }

    user = currentUser;

    try {
      localStorage.setItem(
        "jpbet_user",
        JSON.stringify(currentUser)
      );
    } catch {
      // Ignora erro de localStorage
    }
  }

  function getUserId() {
    return (
      user?.id ??
      user?.userId ??
      user?.user_id ??
      null
    );
  }

  function getBalance() {
    return Number(
      user?.balance ??
      user?.saldo ??
      user?.cash_balance ??
      user?.cash ??
      0
    );
  }

  function updateBalances() {
    const balance = money(getBalance());

    if ($("balance")) {
      $("balance").textContent = balance;
    }

    if ($("stageBalance")) {
      $("stageBalance").textContent = balance;
    }
  }

  /*
  ============================================================
  API
  ============================================================
  */

  async function api(path, options = {}) {
    const headers = {
      "Content-Type": "application/json"
    };

    try {
      const token = localStorage.getItem("jpbet_token");

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignora erro
    }

    const response = await fetch(
      API + path,
      {
        ...options,
        headers
      }
    );

    const text = await response.text();

    let data = {};

    try {
      data = text
        ? JSON.parse(text)
        : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        `Erro HTTP ${response.status}`
      );
    }

    return data;
  }

  /*
  ============================================================
  CARREGAR USUÁRIO
  ============================================================
  */

  async function loadUser() {
    user = getStoredUser();

    const endpoints = [
      "/user/me",
      "/me",
      "/profile"
    ];

    for (const endpoint of endpoints) {
      try {
        const data = await api(endpoint);

        const currentUser =
          data.user ||
          data.usuario ||
          data.player ||
          data;

        if (
          currentUser?.id ||
          currentUser?.userId ||
          currentUser?.user_id
        ) {
          saveUser(currentUser);
          break;
        }
      } catch {
        // Tenta o próximo endpoint
      }
    }

    updateBalances();
  }

  /*
  ============================================================
  LOBBY DE JOGOS
  ============================================================
  */

  function renderLobby() {
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

    const rouletteCard = $("rouletteCard");

    if (rouletteCard) {
      rouletteCard.onclick = openRoulette;
    }

    const message = $("gamesMessage");

    if (message) {
      message.textContent =
        "Escolha um jogo para começar.";
    }
  }

  /*
  ============================================================
  ABRIR ROLETA
  ============================================================
  */

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

  /*
  ============================================================
  VOLTAR AO LOBBY
  ============================================================
  */

  function backToLobby() {
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
      $("rouletteResult").textContent =
        "Faça sua aposta";
    }
  }

  /*
  ============================================================
  CRIAR ROLETA
  ============================================================
  */

  function createWheel() {
    const wheel = $("rouletteWheel");
    const bulbs = $("rouletteBulbs");

    if (!wheel) {
      return;
    }

    const total =
      ROULETTE_SEGMENTS.length;

    const angle =
      360 / total;

    wheel.innerHTML = "";

    if (bulbs) {
      bulbs.innerHTML = "";
    }

    /*
    ------------------------------
    SETORES
    ------------------------------
    */

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

        element.innerHTML = `
          <span>
            ${segment.label}
          </span>
        `;

        wheel.appendChild(element);
      }
    );

    /*
    ------------------------------
    LÂMPADAS
    ------------------------------
    */

    if (bulbs) {
      const bulbCount = 30;

      for (
        let index = 0;
        index < bulbCount;
        index++
      ) {
        const bulb =
          document.createElement("i");

        bulb.style.setProperty(
          "--bulb-angle",
          `${index * 12}deg`
        );

        bulbs.appendChild(bulb);
      }
    }

    wheel.style.transform =
      `rotate(${rotation}deg)`;
  }

  /*
  ============================================================
  APOSTA
  ============================================================
  */

  function updateBet() {
    const valueElement =
      $("rouletteBetValue");

    if (valueElement) {
      valueElement.textContent =
        `R$ ${money(bet)}`;
    }

    document
      .querySelectorAll(
        "[data-roulette-bet]"
      )
      .forEach((button) => {

        const buttonValue =
          Number(
            button.dataset.rouletteBet
          );

        button.classList.toggle(
          "active",
          buttonValue === bet
        );
      });
  }

  function setBet(value) {
    const numericValue =
      Number(value);

    if (
      !Number.isFinite(numericValue) ||
      numericValue < MIN_BET
    ) {
      return;
    }

    bet =
      Math.round(
        numericValue * 100
      ) / 100;

    updateBet();
  }

  /*
  ============================================================
  OUTROS VALORES
  ============================================================
  */

  function chooseOtherValue() {
    const input =
      prompt(
        "Digite o valor da aposta em reais:",
        String(bet).replace(".", ",")
      );

    if (input === null) {
      return;
    }

    const normalized =
      input
        .replace(/\./g, "")
        .replace(",", ".");

    const value =
      Number(normalized);

    if (
      !Number.isFinite(value) ||
      value < MIN_BET
    ) {
      showToast(
        "Digite um valor a partir de R$ 0,50."
      );

      return;
    }

    setBet(value);
  }

  /*
  ============================================================
  IDENTIFICAR RESULTADO
  ============================================================
  */

  function getResultIndex(result) {

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

    const multiplier =
      Number(
        result?.multiplier ??
        result?.resultado?.multiplier ??
        0
      );

    const type =
      result?.type ??
      result?.resultado?.type;

    const candidates =
      ROULETTE_SEGMENTS
        .map(
          (segment, index) => ({
            segment,
            index
          })
        )
        .filter(
          ({ segment }) => {

            if (
              type &&
              segment.type !== type
            ) {
              return false;
            }

            if (
              segment.type === "prize" &&
              segment.multiplier !== multiplier
            ) {
              return false;
            }

            return true;
          }
        );

    if (candidates.length) {
      return candidates[0].index;
    }

    return 0;
  }

  function getResultLabel(result) {

    return (
      result?.label ||
      result?.resultLabel ||
      result?.resultado?.label ||
      ROULETTE_SEGMENTS[
        getResultIndex(result)
      ]?.label ||
      "X"
    );
  }

  /*
  ============================================================
  ANIMAÇÃO DA ROLETA
  ============================================================
  */

  function animateWheel(index) {

    const wheel =
      $("rouletteWheel");

    if (!wheel) {
      return Promise.resolve();
    }

    const angle =
      360 /
      ROULETTE_SEGMENTS.length;

    /*
    O ponteiro fica no topo.
    O centro do setor precisa parar
    exatamente abaixo dele.
    */

    const target =
      -(
        index * angle +
        angle / 2
      );

    const current =
      (
        rotation % 360 +
        360
      ) % 360;

    let difference =
      target - current;

    while (difference < 0) {
      difference += 360;
    }

    /*
    7 voltas completas antes
    de chegar ao resultado.
    */

    rotation +=
      7 * 360 +
      difference;

    wheel.style.transition =
      "transform 5.8s cubic-bezier(.12,.78,.16,1)";

    wheel.style.transform =
      `rotate(${rotation}deg)`;

    return new Promise(
      (resolve) => {

        setTimeout(
          resolve,
          6000
        );
      }
    );
  }

  /*
  ============================================================
  ATUALIZAR USUÁRIO APÓS GIRO
  ============================================================
  */

  function updateUserFromResponse(data) {

    const returnedUser =
      data.user ||
      data.usuario ||
      data.player;

    if (returnedUser) {
      saveUser(returnedUser);
      return;
    }

    if (
      data.balance !== undefined
    ) {
      if (!user) {
        user = {};
      }

      user.balance =
        data.balance;

      saveUser(user);

      return;
    }

    if (
      data.saldo !== undefined
    ) {
      if (!user) {
        user = {};
      }

      user.saldo =
        data.saldo;

      saveUser(user);
    }
  }

  /*
  ============================================================
  GIRO
  ============================================================
  */

  async function spinRoulette() {

    if (busy) {
      return;
    }

    if (!getUserId()) {
      showToast(
        "Faça login para jogar."
      );

      return;
    }

    /*
    Giro normal exige saldo.
    Giro grátis não desconta a aposta.
    */

    if (
      !freeSpin &&
      getBalance() < bet
    ) {
      showToast(
        "Saldo insuficiente."
      );

      return;
    }

    busy = true;

    const spinButton =
      $("rouletteSpinButton");

    const centerButton =
      $("rouletteCenterButton");

    if (spinButton) {
      spinButton.disabled = true;
    }

    if (centerButton) {
      centerButton.disabled = true;
    }

    if ($("rouletteResult")) {
      $("rouletteResult").textContent =
        "Girando...";
    }

    try {

      const data =
        await api(
          "/roulette/spin",
          {
            method: "POST",

            body: JSON.stringify({
              userId: getUserId(),

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

      /*
      ------------------------------
      ANIMAÇÃO
      ------------------------------
      */

      const resultIndex =
        getResultIndex(result);

      await animateWheel(
        resultIndex
      );

      /*
      ------------------------------
      ATUALIZA SALDO
      ------------------------------
      */

      updateUserFromResponse(
        data
      );

      /*
      ------------------------------
      RESULTADO
      ------------------------------
      */

      const prize =
        Number(
          data.prize ??
          data.payout ??
          result?.prize ??
          result?.payout ??
          0
        );

      const label =
        getResultLabel(result);

      const isFreeSpinResult =
        result?.type === "sorte" ||
        label.includes("🍀");

      /*
      ------------------------------
      TEXTO DO RESULTADO
      ------------------------------
      */

      if ($("rouletteResult")) {

        if (isFreeSpinResult) {

          $("rouletteResult")
            .textContent =
            "🍀 GIRO GRÁTIS!";

        } else if (prize > 0) {

          $("rouletteResult")
            .textContent =
            `${label} — Você ganhou R$ ${money(prize)}`;

        } else {

          $("rouletteResult")
            .textContent =
            `${label} — Boa sorte na próxima!`;
        }
      }

      /*
      ------------------------------
      VALOR GANHO
      ------------------------------
      */

      if ($("winDisplay")) {

        $("winDisplay")
          .textContent =
          prize > 0
            ? `R$ ${money(prize)}`
            : "R$ 0,00";
      }

      /*
      ------------------------------
      GIRO GRÁTIS
      ------------------------------
      */

      if (isFreeSpinResult) {

        freeSpin = true;

        if ($("rouletteFreeSpinStatus")) {

          $("rouletteFreeSpinStatus")
            .hidden = false;

          $("rouletteFreeSpinStatus")
            .textContent =
            `🍀 Você ganhou 1 giro grátis de R$ ${money(bet)}.`;
        }

        if ($("rouletteFreeBadge")) {
          $("rouletteFreeBadge").hidden =
            false;
        }

      } else if (freeSpin) {

        /*
        O giro grátis acabou.
        */

        freeSpin = false;

        if ($("rouletteFreeSpinStatus")) {
          $("rouletteFreeSpinStatus")
            .hidden = true;
        }

        if ($("rouletteFreeBadge")) {
          $("rouletteFreeBadge").hidden =
            true;
        }
      }

      updateBalances();

    } catch (error) {

      console.error(
        "Erro na Roleta da Sorte:",
        error
      );

      showToast(
        error.message ||
        "Erro ao girar a roleta."
      );

      if ($("rouletteResult")) {
        $("rouletteResult")
          .textContent =
          "Não foi possível realizar o giro.";
      }

    } finally {

      busy = false;

      if (spinButton) {
        spinButton.disabled = false;
      }

      if (centerButton) {
        centerButton.disabled = false;
      }
    }
  }

  /*
  ============================================================
  EVENTOS
  ============================================================
  */

  function setupEvents() {

    /*
    ------------------------------
    BOTÃO VOLTAR DO CABEÇALHO
    ------------------------------
    */

    const backButton =
      $("backButton");

    if (backButton) {

      backButton.onclick =
        () => {

          if (
            window.history.length > 1
          ) {
            window.history.back();
          } else {
            window.location.href =
              "index.html";
          }

        };
    }

    /*
    ------------------------------
    VOLTAR PARA JOGOS
    ------------------------------
    */

    const stageBack =
      $("stageBack");

    if (stageBack) {
      stageBack.onclick =
        backToLobby;
    }

    /*
    ------------------------------
    DIMINUIR APOSTA
    ------------------------------
    */

    const minus =
      $("rouletteBetMinus");

    if (minus) {

      minus.onclick =
        () => {

          setBet(
            Math.max(
              MIN_BET,
              bet - BET_STEP
            )
          );

        };
    }

    /*
    ------------------------------
    AUMENTAR APOSTA
    ------------------------------
    */

    const plus =
      $("rouletteBetPlus");

    if (plus) {

      plus.onclick =
        () => {

          setBet(
            bet + BET_STEP
          );

        };
    }

    /*
    ------------------------------
    OUTROS VALORES
    ------------------------------
    */

    const otherValue =
      $("rouletteOtherValue");

    if (otherValue) {
      otherValue.onclick =
        chooseOtherValue;
    }

    /*
    ------------------------------
    BOTÃO GIRAR
    ------------------------------
    */

    const spinButton =
      $("rouletteSpinButton");

    if (spinButton) {
      spinButton.onclick =
        spinRoulette;
    }

    /*
    ------------------------------
    BOTÃO CENTRAL DA ROLETA
    ------------------------------
    */

    const centerButton =
      $("rouletteCenterButton");

    if (centerButton) {
      centerButton.onclick =
        spinRoulette;
    }

    /*
    ------------------------------
    APOSTAS RÁPIDAS
    ------------------------------
    */

    document
      .querySelectorAll(
        "[data-roulette-bet]"
      )
      .forEach((button) => {

        button.onclick =
          () => {

            setBet(
              button.dataset
                .rouletteBet
            );

          };
      });
  }

  /*
  ============================================================
  INICIALIZAÇÃO
  ============================================================
  */

  renderLobby();

  setupEvents();

  updateBet();

  loadUser();

})();

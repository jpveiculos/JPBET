(() => {
  "use strict";

  const API = "/api";

  const SEGMENTS = [
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

  const MIN_BET = 0.5;
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
    if (!value) return;

    user = value;

    try {
      localStorage.setItem(
        "jpbet_user",
        JSON.stringify(value)
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

  function updateBalances() {
    const value = money(balance());

    if ($("balance")) {
      $("balance").textContent = value;
    }

    if ($("stageBalance")) {
      $("stageBalance").textContent = value;
    }
  }

  function showToast(message) {
    const el = $("toast");

    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
      el.classList.remove("show");
    }, 2800);
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
        credentials: "include",
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

    if (!userId()) {
      updateBalances();
      return;
    }

    await refreshUser();
  }

  async function refreshUser() {
    const id = userId();

    if (!id) return;

    try {
      const data =
        await api(
          `/user/${encodeURIComponent(id)}`
        );

      const fresh =
        data.user ||
        data.usuario ||
        data.player;

      if (fresh) {
        saveUser(fresh);
        updateBalances();
      }
    } catch {
      updateBalances();
    }
  }

  function renderLobby() {
    const container =
      $("gamesContainer");

    if (!container) return;

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

    $("rouletteCard").onclick =
      openRoulette;
  }

  function openRoulette() {
    $("gamesLobby").hidden = true;
    $("gameStage").hidden = false;
    $("roulettePanel").hidden = false;

    if ($("gameTitle")) {
      $("gameTitle").textContent =
        "Roleta da Sorte";
    }

    if ($("gameTypeLabel")) {
      $("gameTypeLabel").textContent =
        "ROLETA";
    }

    setupWheel();
    updateBet();
    updateBalances();
  }

  function backToLobby() {
    $("gameStage").hidden = true;
    $("gamesLobby").hidden = false;
    $("roulettePanel").hidden = true;
  }

  /*
   * A arte original permanece intacta.
   *
   * A imagem fica dentro de uma camada de rotação.
   * O centro e o ponteiro são cobertos por elementos
   * fixos, para que visualmente permaneçam parados.
   */
  function setupWheel() {
    const wheel =
      $("rouletteWheel");

    if (!wheel) return;

    const bulbs =
      $("rouletteBulbs");

    const pointer =
      document.querySelector(
        ".roulette-pointer"
      );

    const innerRing =
      document.querySelector(
        ".roulette-inner-ring"
      );

    if (bulbs) {
      bulbs.style.display = "none";
    }

    if (pointer) {
      pointer.style.display = "none";
    }

    if (innerRing) {
      innerRing.style.display = "none";
    }

    wheel.innerHTML = "";

    wheel.className =
      "roulette-wheel roulette-wheel-real";

    wheel.innerHTML = `
      <div
        class="roulette-rotating-art"
        id="rouletteRotatingArt"
      >
        <img
          src="/Roleta%20da%20Sorte.png"
          alt="Roleta da Sorte"
          draggable="false"
        >
      </div>

      <div
        class="roulette-fixed-pointer"
        aria-hidden="true"
      >
        <span></span>
      </div>

      <button
        type="button"
        class="roulette-fixed-center"
        id="rouletteFixedCenter"
        aria-label="Girar roleta"
      >
        <span>♛</span>
        <strong>GIRAR</strong>
        <small>MYBETS</small>
      </button>
    `;

    const art =
      $("rouletteRotatingArt");

    if (art) {
      art.style.transform =
        `rotate(${rotation}deg)`;
    }

    const center =
      $("rouletteFixedCenter");

    if (center) {
      center.onclick = spin;
    }
  }

  function updateBet() {
    if ($("rouletteBetValue")) {
      $("rouletteBetValue").textContent =
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
    value = Number(value);

    if (
      !Number.isFinite(value) ||
      value < MIN_BET
    ) {
      return;
    }

    bet =
      Math.round(value * 100) / 100;

    updateBet();
  }

  function otherValue() {
    const input =
      prompt(
        "Digite o valor da aposta:",
        String(bet).replace(".", ",")
      );

    if (input === null) return;

    const value =
      Number(
        input
          .replace(/\./g, "")
          .replace(",", ".")
      );

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
      SEGMENTS[index]?.label ||
      "X"
    );
  }

  /*
   * Cada setor possui 36 graus.
   *
   * O ponteiro está no topo.
   * Portanto fazemos o centro do setor sorteado
   * parar exatamente abaixo dele.
   */
  function animateTo(index) {
    const art =
      $("rouletteRotatingArt");

    if (!art) {
      return Promise.resolve();
    }

    const sector =
      360 / SEGMENTS.length;

    const target =
      -(index * sector + sector / 2);

    const current =
      ((rotation % 360) + 360) % 360;

    let delta =
      target - current;

    while (delta < 0) {
      delta += 360;
    }

    rotation +=
      8 * 360 + delta;

    art.style.transition =
      "transform 5.8s cubic-bezier(.12,.78,.16,1)";

    art.style.transform =
      `rotate(${rotation}deg)`;

    return new Promise(resolve => {
      setTimeout(
        resolve,
        6000
      );
    });
  }

  async function spin() {
    if (busy) return;

    if (!userId()) {
      showToast(
        "Faça login para jogar."
      );
      return;
    }

    await refreshUser();

    const serverFreeSpins =
      Number(
        user?.rouletteFreeSpins ??
        user?.roulette_free_spins ??
        0
      );

    const usingFreeSpin =
      serverFreeSpins > 0 ||
      freeSpin;

    if (
      !usingFreeSpin &&
      balance() < bet
    ) {
      showToast(
        "Saldo insuficiente."
      );
      return;
    }

    busy = true;

    if ($("rouletteSpinButton")) {
      $("rouletteSpinButton").disabled =
        true;
    }

    if ($("rouletteFixedCenter")) {
      $("rouletteFixedCenter").disabled =
        true;
    }

    $("rouletteResult").textContent =
      "Girando...";

    try {
      /*
       * O servidor continua sendo a fonte
       * verdadeira do sorteio.
       */
      const data =
        await api(
          "/roulette/spin",
          {
            method: "POST",
            credentials: "include",
            body: JSON.stringify({
              userId: userId(),
              betAmount: bet,
              betType: "roulette",
              rouletteId: "popular",
              freeSpin: usingFreeSpin
            })
          }
        );

      const result =
        data.result ||
        data.resultado ||
        {};

      const index =
        resultIndex(result);

      await animateTo(index);

      if (
        data.user ||
        data.usuario
      ) {
        saveUser(
          data.user ||
          data.usuario
        );
      }

      await refreshUser();

      const prize =
        Number(
          result.prize ??
          data.prize ??
          0
        );

      const label =
        resultLabel(result);

      const isFree =
        result.type === "sorte" ||
        label.includes("🍀");

      if (isFree) {
        freeSpin = true;

        if ($("rouletteFreeBadge")) {
          $("rouletteFreeBadge").hidden =
            false;
        }

        if ($("rouletteFreeSpinStatus")) {
          $("rouletteFreeSpinStatus").hidden =
            false;

          $("rouletteFreeSpinStatus").textContent =
            `🍀 Você ganhou 1 giro grátis de R$ ${money(bet)}.`;
        }

        $("rouletteResult").textContent =
          "🍀 GIRO GRÁTIS!";
      } else {
        freeSpin = false;

        if ($("rouletteFreeBadge")) {
          $("rouletteFreeBadge").hidden =
            true;
        }

        if ($("rouletteFreeSpinStatus")) {
          $("rouletteFreeSpinStatus").hidden =
            true;
        }

        $("rouletteResult").textContent =
          prize > 0
            ? `${label} — Você ganhou R$ ${money(prize)}`
            : `${label} — Boa sorte na próxima!`;
      }

      if ($("winDisplay")) {
        $("winDisplay").textContent =
          prize > 0
            ? `R$ ${money(prize)}`
            : "R$ 0,00";
      }

      updateBalances();

    } catch (error) {

      $("rouletteResult").textContent =
        "Não foi possível realizar o giro.";

      showToast(
        error.message ||
        "Erro ao girar a roleta."
      );

    } finally {

      busy = false;

      if ($("rouletteSpinButton")) {
        $("rouletteSpinButton").disabled =
          false;
      }

      if ($("rouletteFixedCenter")) {
        $("rouletteFixedCenter").disabled =
          false;
      }
    }
  }

  function bindEvents() {
    if ($("backButton")) {
      $("backButton").onclick =
        () => {
          if (history.length > 1) {
            history.back();
          } else {
            location.href =
              "index.html";
          }
        };
    }

    if ($("stageBack")) {
      $("stageBack").onclick =
        backToLobby;
    }

    if ($("rouletteBetMinus")) {
      $("rouletteBetMinus").onclick =
        () => {
          setBet(
            Math.max(
              MIN_BET,
              bet - STEP
            )
          );
        };
    }

    if ($("rouletteBetPlus")) {
      $("rouletteBetPlus").onclick =
        () => {
          setBet(
            bet + STEP
          );
        };
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
        button.onclick = () => {
          setBet(
            Number(
              button.dataset.rouletteBet
            )
          );
        };
      });
  }

  renderLobby();
  bindEvents();
  loadUser();

})();

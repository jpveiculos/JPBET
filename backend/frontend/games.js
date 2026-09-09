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

    if (!element) {
      alert(message);
      return;
    }

    element.textContent = message;
    element.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      element.classList.remove("show");
    }, 2600);
  }

  function stored() {
    try {
      return JSON.parse(
        localStorage.getItem("jpbet_user") || "null"
      );
    } catch {
      return null;
    }
  }

  function save(newUser) {
    if (!newUser) return;

    user = newUser;

    try {
      localStorage.setItem(
        "jpbet_user",
        JSON.stringify(newUser)
      );
    } catch {}
  }

  function uid() {
    return (
      user?.id ??
      user?.userId ??
      user?.user_id
    );
  }

  /*
    O saldo REAL da conta é:
    bonusBalance + cashBalance.

    O backend também devolve "balance"
    com essa soma, mas usamos os campos
    separados quando disponíveis.
  */
  function bal() {
    const bonus =
      user?.bonusBalance ??
      user?.bonus_balance;

    const cash =
      user?.cashBalance ??
      user?.cash_balance;

    if (
      bonus !== undefined ||
      cash !== undefined
    ) {
      return Number(bonus || 0) +
             Number(cash || 0);
    }

    return Number(
      user?.balance ??
      user?.saldo ??
      user?.cash ??
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
        headers,
        credentials: "include"
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
        data.error ||
        data.message ||
        `Erro HTTP ${response.status}`
      );
    }

    return data;
  }

  /*
    Busca o saldo diretamente do banco
    através da rota oficial do servidor.
  */
  async function refreshUser() {
    if (!uid()) {
      return false;
    }

    try {
      const data =
        await api(
          `/user/${encodeURIComponent(uid())}`
        );

      const freshUser =
        data.user ||
        data.usuario ||
        data.player;

      if (
        freshUser &&
        (
          freshUser.id ||
          freshUser.userId ||
          freshUser.user_id
        )
      ) {
        save(freshUser);
        balances();
        return true;
      }

      return false;

    } catch (error) {
      console.error(
        "Erro ao atualizar usuário:",
        error
      );

      balances();

      return false;
    }
  }

  async function loadUser() {
    user = stored();

    balances();

    /*
      Primeiro mostra o saldo salvo localmente.
      Depois substitui pelo saldo REAL do banco.
    */
    await refreshUser();

    /*
      Se não encontrou usuário no localStorage,
      não tenta inventar login.
    */
    if (!uid()) {
      balances();
    }
  }

  function lobby() {
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

    const card =
      $("rouletteCard");

    if (card) {
      card.onclick =
        openRoulette;
    }
  }

  async function openRoulette() {
    $("gamesLobby").hidden = true;
    $("gameStage").hidden = false;
    $("roulettePanel").hidden = false;

    $("gameTitle").textContent =
      "Roleta da Sorte";

    $("gameTypeLabel").textContent =
      "ROLETA";

    createWheel();
    updateBet();

    /*
      Sempre atualiza o saldo quando
      o jogador entra na roleta.
    */
    await refreshUser();

    updateFreeSpinState();
  }

  function back() {
    $("gameStage").hidden = true;
    $("gamesLobby").hidden = false;
    $("roulettePanel").hidden = true;
  }

  function createWheel() {
    const wheel =
      $("rouletteWheel");

    const bulbs =
      $("rouletteBulbs");

    if (!wheel || !bulbs) return;

    const count =
      ROULETTE_SEGMENTS.length;

    const angle =
      360 / count;

    wheel.innerHTML = "";
    bulbs.innerHTML = "";

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

    for (let i = 0; i < 30; i++) {
      const bulb =
        document.createElement("i");

      bulb.style.setProperty(
        "--bulb-angle",
        `${i * 12}deg`
      );

      bulbs.appendChild(bulb);
    }

    wheel.style.transform =
      `rotate(${rotation}deg)`;
  }

  function updateBet() {
    const value =
      $("rouletteBetValue");

    if (value) {
      value.textContent =
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
      Number.isFinite(value) &&
      value >= MIN
    ) {
      bet =
        Math.round(value * 100) / 100;

      updateBet();
    }
  }

  function other() {
    const input =
      prompt(
        "Digite o valor da aposta em reais:",
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
      value < MIN
    ) {
      toast(
        "Digite um valor a partir de R$ 0,50."
      );

      return;
    }

    setBet(value);
  }

  function indexOf(result) {
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
        .filter(item => {
          if (
            type &&
            item.segment.type !== type
          ) {
            return false;
          }

          if (
            item.segment.type ===
            "prize"
          ) {
            return (
              item.segment.multiplier ===
              multiplier
            );
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
      ROULETTE_SEGMENTS[
        indexOf(result)
      ]?.label ||
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
      360 /
      ROULETTE_SEGMENTS.length;

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

    let distance =
      target - current;

    while (distance < 0) {
      distance += 360;
    }

    rotation +=
      7 * 360 +
      distance;

    wheel.style.transition =
      "transform 5.8s cubic-bezier(.12,.78,.16,1)";

    wheel.style.transform =
      `rotate(${rotation}deg)`;

    return new Promise(resolve => {
      setTimeout(
        resolve,
        6000
      );
    });
  }

  function updateFreeSpinState() {
    const available =
      Number(
        user?.rouletteFreeSpins ??
        user?.roulette_free_spins ??
        0
      );

    const hasFreeSpin =
      available > 0;

    const badge =
      $("rouletteFreeBadge");

    const status =
      $("rouletteFreeSpinStatus");

    if (badge) {
      badge.hidden =
        !hasFreeSpin;
    }

    if (status) {
      status.hidden =
        !hasFreeSpin;

      if (hasFreeSpin) {
        const freeBet =
          Number(
            user?.rouletteFreeSpinBet ??
            user?.roulette_free_spin_bet ??
            bet
          );

        status.textContent =
          `🍀 ${available} giro(s) grátis disponível(is)${freeBet > 0 ? ` — R$ ${money(freeBet)} cada` : ""}.`;
      }
    }

    freeSpin =
      hasFreeSpin;
  }

  async function spin() {
    if (busy) return;

    if (!uid()) {
      toast(
        "Faça login para jogar."
      );

      return;
    }

    /*
      Busca o saldo real imediatamente
      antes de apostar.
    */
    await refreshUser();

    updateFreeSpinState();

    const availableFreeSpins =
      Number(
        user?.rouletteFreeSpins ??
        user?.roulette_free_spins ??
        0
      );

    /*
      Se existe giro grátis, usa o giro grátis.
      Caso contrário, verifica o saldo real.
    */
    const usarGiroGratis =
      availableFreeSpins > 0;

    if (
      !usarGiroGratis &&
      bal() < bet
    ) {
      toast(
        `Saldo insuficiente. Saldo disponível: R$ ${money(bal())}.`
      );

      return;
    }

    busy = true;

    if ($("rouletteSpinButton")) {
      $("rouletteSpinButton").disabled =
        true;
    }

    if ($("rouletteCenterButton")) {
      $("rouletteCenterButton").disabled =
        true;
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
              userId: uid(),

              betAmount:
                bet,

              betType:
                "roulette",

              rouletteId:
                "popular",

              freeSpin:
                usarGiroGratis
            })
          }
        );

      const result =
        data.result ||
        data.resultado ||
        data;

      /*
        O servidor devolve o usuário
        atualizado depois da aposta.
      */
      if (
        data.user ||
        data.usuario ||
        data.player
      ) {
        save(
          data.user ||
          data.usuario ||
          data.player
        );
      } else {
        /*
          Mesmo que a resposta não tenha
          usuário, busca novamente no banco.
        */
        await refreshUser();
      }

      const resultIndex =
        indexOf(result);

      await animate(
        resultIndex
      );

      /*
        Atualiza novamente após a animação.
        Assim o saldo mostrado é sempre
        o saldo real do banco.
      */
      await refreshUser();

      const prize =
        Number(
          data.prize ??
          data.payout ??
          result.prize ??
          result.payout ??
          0
        );

      const label =
        labelOf(result);

      const isFreeResult =
        result.type === "sorte" ||
        label.includes("🍀");

      if ($("rouletteResult")) {
        if (isFreeResult) {
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

      /*
        O backend é a fonte oficial dos
        giros grátis. Não fazemos mais
        controle artificial no navegador.
      */
      updateFreeSpinState();

      balances();

    } catch (error) {
      console.error(
        "Erro ao girar:",
        error
      );

      toast(
        error.message ||
        "Erro ao girar a roleta."
      );

      if ($("rouletteResult")) {
        $("rouletteResult").textContent =
          "Não foi possível realizar o giro.";
      }

      /*
        Mesmo em caso de erro,
        sincroniza o saldo novamente.
      */
      await refreshUser();

    } finally {
      busy = false;

      if ($("rouletteSpinButton")) {
        $("rouletteSpinButton").disabled =
          false;
      }

      if ($("rouletteCenterButton")) {
        $("rouletteCenterButton").disabled =
          false;
      }

      balances();
    }
  }

  function events() {
    const backButton =
      $("backButton");

    if (backButton) {
      backButton.onclick = () => {
        if (
          history.length > 1
        ) {
          history.back();
        } else {
          location.href =
            "index.html";
        }
      };
    }

    const stageBack =
      $("stageBack");

    if (stageBack) {
      stageBack.onclick =
        back;
    }

    const minus =
      $("rouletteBetMinus");

    if (minus) {
      minus.onclick =
        () =>
          setBet(
            Math.max(
              MIN,
              bet - STEP
            )
          );
    }

    const plus =
      $("rouletteBetPlus");

    if (plus) {
      plus.onclick =
        () =>
          setBet(
            bet + STEP
          );
    }

    const otherButton =
      $("rouletteOtherValue");

    if (otherButton) {
      otherButton.onclick =
        other;
    }

    const spinButton =
      $("rouletteSpinButton");

    if (spinButton) {
      spinButton.onclick =
        spin;
    }

    const centerButton =
      $("rouletteCenterButton");

    if (centerButton) {
      centerButton.onclick =
        spin;
    }

    document
      .querySelectorAll(
        "[data-roulette-bet]"
      )
      .forEach(button => {
        button.onclick = () =>
          setBet(
            button.dataset
              .rouletteBet
          );
      });
  }

  lobby();
  events();
  loadUser();

})();

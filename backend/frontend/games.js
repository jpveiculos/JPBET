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

  const QUICK_BETS = [0.5, 1, 2, 5, 10, 50];

  const MIN_BET = 0.5;
  const STEP = 0.5;

  let user = null;
  let bet = 0.5;
  let busy = false;
  let rotation = 0;
  let freeSpins = 0;
  let freeSpinBet = 0;

  const $ = id => document.getElementById(id);

  function money(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function number(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function toast(message) {
    const element = $("toast");

    if (!element) return;

    element.textContent = message;
    element.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      element.classList.remove("show");
    }, 2800);
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

    const bonus = number(
      user.bonusBalance ??
      user.bonus_balance ??
      0
    );

    const cash = number(
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
      return Math.round((bonus + cash) * 100) / 100;
    }

    return number(
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

  function updateFreeSpinState() {
    freeSpins = Math.max(
      0,
      Math.floor(
        number(
          user?.rouletteFreeSpins ??
          user?.roulette_free_spins ??
          freeSpins
        )
      )
    );

    freeSpinBet = number(
      user?.rouletteFreeSpinBet ??
      user?.roulette_free_spin_bet ??
      freeSpinBet
    );

    const badge = $("rouletteFreeBadge");
    const status = $("rouletteFreeSpinStatus");

    if (freeSpins > 0) {
      if (badge) {
        badge.hidden = false;
      }

      if (status) {
        status.hidden = false;
        status.textContent =
          `🍀 ${freeSpins} giro${freeSpins > 1 ? "s" : ""} grátis disponível${freeSpins > 1 ? "eis" : "el"}.`;
      }
    } else {
      if (badge) {
        badge.hidden = true;
      }

      if (status) {
        status.hidden = true;
        status.textContent = "";
      }
    }
  }

  async function api(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
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

    const text = await response.text();

    let data = {};

    try {
      data = text
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
    const saved = storedUser();

    if (!saved) {
      user = null;
      updateBalances();
      return;
    }

    user = saved;

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
      console.warn(
        "Não foi possível atualizar o usuário:",
        error
      );
    }

    updateFreeSpinState();
    updateBalances();
  }

  async function refreshUser() {
    const id = userId();

    if (!id) return;

    const data =
      await api(
        `/user/${encodeURIComponent(id)}`
      );

    if (data?.user) {
      saveUser(data.user);
      updateFreeSpinState();
      updateBalances();
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

    $("rouletteCard").onclick =
      openRoulette;
  }

  function openRoulette() {
    $("gamesLobby").hidden = true;
    $("gameStage").hidden = false;
    $("roulettePanel").hidden = false;

    $("gameTitle").textContent =
      "Roleta da Sorte";

    $("gameTypeLabel").textContent =
      "ROLETA";

    createWheel();
    updateBet();
    updateFreeSpinState();
    updateBalances();
  }

  function back() {
    $("gameStage").hidden = true;
    $("gamesLobby").hidden = false;
    $("roulettePanel").hidden = true;
  }

  /*
   * ========================================================
   * ROLETA DESENHADA PELO CANVAS
   *
   * O ponteiro fica FORA da roda.
   * Somente o canvas da roda gira.
   *
   * Ordem:
   * 2x / X / 3x / X / 4x / X / 🍀 / X / 5x / X
   * ========================================================
   */

  function createWheel() {
    const wheel =
      $("rouletteWheel");

    if (!wheel) return;

    wheel.innerHTML = "";

    wheel.style.position = "relative";
    wheel.style.overflow = "hidden";
    wheel.style.border = "0";
    wheel.style.background = "transparent";
    wheel.style.boxShadow = "none";
    wheel.style.borderRadius = "50%";

    const canvas =
      document.createElement("canvas");

    canvas.className =
      "mybets-roulette-canvas";

    canvas.setAttribute(
      "aria-label",
      "Roleta da Sorte"
    );

    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.borderRadius = "50%";
    canvas.style.transform =
      `rotate(${rotation}deg)`;
    canvas.style.transition =
      "none";

    wheel.appendChild(canvas);

    drawWheel(canvas);
  }

  function drawWheel(canvas) {
    const rect =
      canvas.getBoundingClientRect();

    const size =
      Math.max(
        300,
        Math.floor(
          Math.min(
            rect.width || 500,
            rect.height || 500
          )
        )
      );

    const ratio =
      window.devicePixelRatio || 1;

    canvas.width =
      size * ratio;

    canvas.height =
      size * ratio;

    const ctx =
      canvas.getContext("2d");

    ctx.scale(
      ratio,
      ratio
    );

    const cx = size / 2;
    const cy = size / 2;

    const radius =
      size * 0.48;

    /*
     * Fundo externo.
     */

    ctx.clearRect(
      0,
      0,
      size,
      size
    );

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      radius,
      0,
      Math.PI * 2
    );

    const outerGold =
      ctx.createRadialGradient(
        cx,
        cy,
        radius * 0.65,
        cx,
        cy,
        radius
      );

    outerGold.addColorStop(
      0,
      "#5c3000"
    );

    outerGold.addColorStop(
      0.45,
      "#ffd95a"
    );

    outerGold.addColorStop(
      0.72,
      "#b86b00"
    );

    outerGold.addColorStop(
      0.9,
      "#ffe57a"
    );

    outerGold.addColorStop(
      1,
      "#7b4300"
    );

    ctx.fillStyle =
      outerGold;

    ctx.fill();

    ctx.lineWidth =
      size * 0.012;

    ctx.strokeStyle =
      "#f8c83e";

    ctx.stroke();

    /*
     * Anel preto interno.
     */

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      radius * 0.91,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      "#08090d";

    ctx.fill();

    /*
     * Setores.
     */

    const sectorCount =
      ROULETTE_SEGMENTS.length;

    const sectorAngle =
      Math.PI * 2 /
      sectorCount;

    const startAngle =
      -Math.PI / 2;

    const colors = [
      "#f5b916",
      "#101116",
      "#7527e8",
      "#101116",
      "#0879ed",
      "#101116",
      "#00a92f",
      "#101116",
      "#ed1265",
      "#101116"
    ];

    ROULETTE_SEGMENTS.forEach(
      (segment, index) => {

        const start =
          startAngle +
          index * sectorAngle;

        const end =
          start +
          sectorAngle;

        ctx.beginPath();

        ctx.moveTo(
          cx,
          cy
        );

        ctx.arc(
          cx,
          cy,
          radius * 0.86,
          start,
          end
        );

        ctx.closePath();

        const gradient =
          ctx.createLinearGradient(
            cx,
            cy -
              radius,
            cx,
            cy +
              radius
          );

        const base =
          colors[index];

        gradient.addColorStop(
          0,
          lighten(base, 0.18)
        );

        gradient.addColorStop(
          0.5,
          base
        );

        gradient.addColorStop(
          1,
          darken(base, 0.22)
        );

        ctx.fillStyle =
          gradient;

        ctx.fill();

        ctx.lineWidth =
          size * 0.006;

        ctx.strokeStyle =
          "#e4b83c";

        ctx.stroke();

        drawSectorLabel(
          ctx,
          segment,
          cx,
          cy,
          radius,
          start +
            sectorAngle / 2,
          size
        );
      }
    );

    /*
     * Anel dourado sobre os setores.
     */

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      radius * 0.86,
      0,
      Math.PI * 2
    );

    ctx.lineWidth =
      size * 0.018;

    ctx.strokeStyle =
      "#d99a18";

    ctx.stroke();

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      radius * 0.78,
      0,
      Math.PI * 2
    );

    ctx.lineWidth =
      size * 0.008;

    ctx.strokeStyle =
      "#f8d15b";

    ctx.stroke();

    /*
     * Lâmpadas.
     */

    const bulbRadius =
      radius * 0.89;

    for (
      let i = 0;
      i < 30;
      i++
    ) {

      const angle =
        startAngle +
        i *
          (
            Math.PI * 2 /
            30
          );

      const x =
        cx +
        Math.cos(angle) *
          bulbRadius;

      const y =
        cy +
        Math.sin(angle) *
          bulbRadius;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        size * 0.015,
        0,
        Math.PI * 2
      );

      const glow =
        ctx.createRadialGradient(
          x,
          y,
          0,
          x,
          y,
          size * 0.035
        );

      glow.addColorStop(
        0,
        "#ffffff"
      );

      glow.addColorStop(
        0.35,
        "#fff4a5"
      );

      glow.addColorStop(
        1,
        "#d58c00"
      );

      ctx.fillStyle =
        glow;

      ctx.shadowBlur =
        size * 0.025;

      ctx.shadowColor =
        "#ffd43d";

      ctx.fill();

      ctx.shadowBlur = 0;
    }

    /*
     * Centro dourado.
     */

    const hubRadius =
      radius * 0.30;

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      hubRadius,
      0,
      Math.PI * 2
    );

    const hub =
      ctx.createRadialGradient(
        cx -
          hubRadius * 0.2,
        cy -
          hubRadius * 0.2,
        0,
        cx,
        cy,
        hubRadius
      );

    hub.addColorStop(
      0,
      "#292929"
    );

    hub.addColorStop(
      0.6,
      "#090909"
    );

    hub.addColorStop(
      1,
      "#000000"
    );

    ctx.fillStyle =
      hub;

    ctx.fill();

    ctx.lineWidth =
      size * 0.018;

    ctx.strokeStyle =
      "#f5c63d";

    ctx.stroke();

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      hubRadius * 0.82,
      0,
      Math.PI * 2
    );

    ctx.lineWidth =
      size * 0.008;

    ctx.strokeStyle =
      "#c88b12";

    ctx.stroke();

    /*
     * Coroa.
     */

    ctx.textAlign =
      "center";

    ctx.textBaseline =
      "middle";

    ctx.font =
      `bold ${size * 0.075}px Arial`;

    ctx.fillStyle =
      "#ffd84a";

    ctx.fillText(
      "♛",
      cx,
      cy -
        hubRadius * 0.40
    );

    /*
     * GIRAR.
     */

    ctx.font =
      `900 ${size * 0.075}px Arial`;

    ctx.fillStyle =
      "#ffd44a";

    ctx.fillText(
      "GIRAR",
      cx,
      cy +
        hubRadius * 0.10
    );

    /*
     * MYBETS.
     */

    ctx.font =
      `${size * 0.027}px Arial`;

    ctx.fillStyle =
      "#bcbcbc";

    ctx.letterSpacing =
      `${size * 0.01}px`;

    ctx.fillText(
      "MYBETS",
      cx,
      cy +
        hubRadius * 0.43
    );
  }

  function drawSectorLabel(
    ctx,
    segment,
    cx,
    cy,
    radius,
    angle,
    size
  ) {

    const distance =
      radius * 0.64;

    const x =
      cx +
      Math.cos(angle) *
        distance;

    const y =
      cy +
      Math.sin(angle) *
        distance;

    ctx.save();

    ctx.translate(
      x,
      y
    );

    /*
     * Mantém os textos
     * orientados para o usuário.
     */

    let textAngle =
      angle +
      Math.PI / 2;

    if (
      textAngle >
        Math.PI / 2 &&
      textAngle <
        Math.PI * 1.5
    ) {
      textAngle += Math.PI;
    }

    ctx.rotate(
      textAngle
    );

    ctx.textAlign =
      "center";

    ctx.textBaseline =
      "middle";

    if (
      segment.type ===
      "zero"
    ) {

      ctx.font =
        `900 ${size * 0.085}px Arial`;

      ctx.fillStyle =
        "#ff1825";

      ctx.strokeStyle =
        "#000000";

      ctx.lineWidth =
        size * 0.018;

      ctx.strokeText(
        "X",
        0,
        0
      );

      ctx.fillText(
        "X",
        0,
        0
      );

    } else if (
      segment.type ===
      "sorte"
    ) {

      ctx.font =
        `${size * 0.105}px Arial`;

      ctx.fillText(
        "🍀",
        0,
        -size * 0.035
      );

      ctx.font =
        `900 ${size * 0.035}px Arial`;

      ctx.fillStyle =
        "#ffffff";

      ctx.strokeStyle =
        "#000000";

      ctx.lineWidth =
        size * 0.009;

      ctx.strokeText(
        "GIRO",
        0,
        size * 0.045
      );

      ctx.strokeText(
        "GRÁTIS",
        0,
        size * 0.082
      );

      ctx.fillText(
        "GIRO",
        0,
        size * 0.045
      );

      ctx.fillText(
        "GRÁTIS",
        0,
        size * 0.082
      );

    } else {

      ctx.font =
        `900 ${size * 0.085}px Arial`;

      ctx.fillStyle =
        "#ffffff";

      ctx.strokeStyle =
        "#000000";

      ctx.lineWidth =
        size * 0.014;

      ctx.strokeText(
        segment.label,
        0,
        0
      );

      ctx.fillText(
        segment.label,
        0,
        0
      );
    }

    ctx.restore();
  }

  function lighten(hex, amount) {
    const rgb =
      hexToRgb(hex);

    return rgbToHex(
      Math.round(
        rgb.r +
        (255 - rgb.r) *
          amount
      ),
      Math.round(
        rgb.g +
        (255 - rgb.g) *
          amount
      ),
      Math.round(
        rgb.b +
        (255 - rgb.b) *
          amount
      )
    );
  }

  function darken(hex, amount) {
    const rgb =
      hexToRgb(hex);

    return rgbToHex(
      Math.round(
        rgb.r *
          (1 - amount)
      ),
      Math.round(
        rgb.g *
          (1 - amount)
      ),
      Math.round(
        rgb.b *
          (1 - amount)
      )
    );
  }

  function hexToRgb(hex) {
    const value =
      hex.replace("#", "");

    return {
      r: parseInt(
        value.substring(0, 2),
        16
      ),
      g: parseInt(
        value.substring(2, 4),
        16
      ),
      b: parseInt(
        value.substring(4, 6),
        16
      )
    };
  }

  function rgbToHex(
    r,
    g,
    b
  ) {
    return (
      "#" +
      [r, g, b]
        .map(
          value =>
            value
              .toString(16)
              .padStart(2, "0")
        )
        .join("")
    );
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
      .forEach(
        button => {
          button.classList.toggle(
            "active",
            Number(
              button.dataset.rouletteBet
            ) === bet
          );
        }
      );
  }

  function setBet(value) {
    const amount =
      Number(value);

    if (
      !Number.isFinite(amount) ||
      amount < MIN_BET
    ) {
      return;
    }

    bet =
      Math.round(
        amount * 100
      ) / 100;

    updateBet();
  }

  function otherValue() {
    const value =
      prompt(
        "Digite o valor da aposta em reais:",
        String(bet).replace(
          ".",
          ","
        )
      );

    if (
      value === null
    ) {
      return;
    }

    const amount =
      Number(
        value
          .replace(/\./g, "")
          .replace(",", ".")
      );

    if (
      !Number.isFinite(amount) ||
      amount < MIN_BET
    ) {
      toast(
        "Digite um valor a partir de R$ 0,50."
      );

      return;
    }

    setBet(amount);
  }

  /*
   * ========================================================
   * ANIMAÇÃO
   *
   * O servidor escolhe primeiro.
   * O índice recebido determina exatamente onde parar.
   * ========================================================
   */

  function animateToIndex(index) {
    return new Promise(resolve => {

      const wheel =
        $("rouletteWheel");

      const canvas =
        wheel?.querySelector(
          ".mybets-roulette-canvas"
        );

      if (!wheel || !canvas) {
        resolve();
        return;
      }

      const sectorAngle =
        360 /
        ROULETTE_SEGMENTS.length;

      /*
       * Cada setor começa no topo.
       * O centro do setor precisa chegar
       * exatamente ao ponteiro fixo.
       */

      const target =
        -(
          index *
            sectorAngle +
          sectorAngle / 2
        );

      const current =
        ((rotation % 360) + 360) % 360;

      let difference =
        target -
        current;

      while (
        difference < 0
      ) {
        difference += 360;
      }

      const extraTurns =
        6 * 360;

      rotation +=
        extraTurns +
        difference;

      canvas.style.transition =
        "transform 6s cubic-bezier(.12,.72,.15,1)";

      canvas.style.transform =
        `rotate(${rotation}deg)`;

      setTimeout(
        resolve,
        6200
      );
    });
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

  async function spin() {

    if (busy) return;

    const id =
      userId();

    if (!id) {
      toast(
        "Faça login para jogar."
      );
      return;
    }

    /*
     * Atualiza o saldo real antes do giro.
     */

    try {
      await refreshUser();
    } catch {}

    const availableFreeSpins =
      Math.max(
        0,
        Math.floor(
          number(
            user?.rouletteFreeSpins ??
            freeSpins
          )
        )
      );

    const usingFreeSpin =
      availableFreeSpins > 0;

    if (
      !usingFreeSpin &&
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

    if ($("winDisplay")) {
      $("winDisplay").textContent =
        "R$ 0,00";
    }

    try {

      /*
       * O servidor é quem decide:
       * resultado, prêmio, saldo e giro grátis.
       */

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
              freeSpin: usingFreeSpin
            })
          }
        );

      const result =
        data?.result ||
        data?.resultado ||
        data;

      const index =
        resultIndex(result);

      /*
       * A roda só começa a animação
       * depois que o servidor respondeu.
       */

      await animateToIndex(
        index
      );

      /*
       * Saldo retornado pelo servidor.
       */

      if (data?.user) {
        saveUser(data.user);
      }

      /*
       * Atualiza novamente diretamente
       * no banco depois do giro.
       */

      try {
        await refreshUser();
      } catch {}

      const prize =
        number(
          result?.prize ??
          data?.prize ??
          result?.payout ??
          data?.payout ??
          0
        );

      const label =
        resultLabel(result);

      const type =
        result?.type ||
        result?.resultType ||
        "";

      const ganhouGiroGratis =
        type === "sorte" ||
        label.includes("🍀");

      if (
        ganhouGiroGratis
      ) {

        if ($("rouletteResult")) {
          $("rouletteResult").textContent =
            "🍀 GIRO GRÁTIS!";
        }

        if ($("winDisplay")) {
          $("winDisplay").textContent =
            "GIRO GRÁTIS";
        }

      } else if (
        prize > 0
      ) {

        if ($("rouletteResult")) {
          $("rouletteResult").textContent =
            `${label} — Você ganhou R$ ${money(prize)}`;
        }

        if ($("winDisplay")) {
          $("winDisplay").textContent =
            `R$ ${money(prize)}`;
        }

      } else {

        if ($("rouletteResult")) {
          $("rouletteResult").textContent =
            `${label} — Boa sorte na próxima!`;
        }

        if ($("winDisplay")) {
          $("winDisplay").textContent =
            "R$ 0,00";
        }
      }

      updateFreeSpinState();
      updateBalances();

    } catch (error) {

      console.error(
        "Erro na roleta:",
        error
      );

      if ($("rouletteResult")) {
        $("rouletteResult").textContent =
          "Não foi possível realizar o giro.";
      }

      toast(
        error?.message ||
        "Erro ao girar a roleta."
      );

      try {
        await refreshUser();
      } catch {}

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

  function events() {

    if ($("backButton")) {
      $("backButton").onclick =
        () => {
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

    if ($("stageBack")) {
      $("stageBack").onclick =
        back;
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

    if ($("rouletteCenterButton")) {
      $("rouletteCenterButton").onclick =
        spin;
    }

    document
      .querySelectorAll(
        "[data-roulette-bet]"
      )
      .forEach(
        button => {
          button.onclick =
            () => {
              setBet(
                button.dataset.rouletteBet
              );
            };
        }
      );

    window.addEventListener(
      "resize",
      () => {

        const canvas =
          $("rouletteWheel")
            ?.querySelector(
              ".mybets-roulette-canvas"
            );

        if (!canvas) return;

        const currentRotation =
          canvas.style.transform;

        drawWheel(canvas);

        canvas.style.transform =
          currentRotation;
      }
    );
  }

  lobby();
  events();
  loadUser();

})();

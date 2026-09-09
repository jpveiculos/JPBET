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
    const freeSpins = Math.max(
      0,
      Math.floor(
        number(
          user?.rouletteFreeSpins ??
          user?.roulette_free_spins ??
          0
        )
      )
    );

    const freeSpinBet = number(
      user?.rouletteFreeSpinBet ??
      user?.roulette_free_spin_bet ??
      0
    );

    const badge = $("rouletteFreeBadge");
    const status = $("rouletteFreeSpinStatus");

    if (freeSpins > 0) {
      if (badge) badge.hidden = false;

      if (status) {
        status.hidden = false;
        status.textContent =
          `🍀 ${freeSpins} giro${freeSpins > 1 ? "s" : ""} grátis disponível${freeSpins > 1 ? "eis" : "el"}.`;
      }

      if (freeSpinBet > 0) {
        const value = money(freeSpinBet);

        if (status) {
          status.textContent += ` Valor-base: R$ ${value}.`;
        }
      }
    } else {
      if (badge) badge.hidden = true;

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
      data = text ? JSON.parse(text) : {};
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
      const data = await api(
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

    const data = await api(
      `/user/${encodeURIComponent(id)}`
    );

    if (data?.user) {
      saveUser(data.user);
      updateFreeSpinState();
      updateBalances();
    }
  }

  function lobby() {
    const container = $("gamesContainer");

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

    const card = $("rouletteCard");

    if (card) {
      card.onclick = openRoulette;
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

    createWheel();
    updateBet();
    updateFreeSpinState();
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

  /*
   * ======================================================
   * DESENHO DA ROLETA
   *
   * O canvas contém SOMENTE a roda.
   * O ponteiro e o botão GIRAR ficam fora do canvas
   * e permanecem parados enquanto a roda gira.
   * ======================================================
   */

  function createWheel() {
    const wheel = $("rouletteWheel");

    if (!wheel) return;

    wheel.innerHTML = "";

    const canvas =
      document.createElement("canvas");

    canvas.className =
      "mybets-roulette-canvas";

    canvas.setAttribute(
      "aria-label",
      "Roleta da Sorte"
    );

    wheel.appendChild(canvas);

    requestAnimationFrame(() => {
      drawWheel(canvas);

      canvas.style.transform =
        `rotate(${rotation}deg)`;
    });
  }

  function drawWheel(canvas) {
    if (!canvas) return;

    const rect =
      canvas.getBoundingClientRect();

    const cssSize =
      Math.max(
        280,
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
      cssSize * ratio;

    canvas.height =
      cssSize * ratio;

    const ctx =
      canvas.getContext("2d");

    ctx.setTransform(
      ratio,
      0,
      0,
      ratio,
      0,
      0
    );

    const size = cssSize;

    const cx = size / 2;
    const cy = size / 2;

    const outerRadius =
      size * 0.485;

    ctx.clearRect(
      0,
      0,
      size,
      size
    );

    /*
     * SOMBRA EXTERNA
     */

    ctx.save();

    ctx.shadowColor =
      "rgba(246,201,74,.35)";

    ctx.shadowBlur =
      size * 0.035;

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      outerRadius,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      "#090a0d";

    ctx.fill();

    ctx.restore();

    /*
     * ARO EXTERNO DOURADO
     */

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      outerRadius,
      0,
      Math.PI * 2
    );

    const outer =
      ctx.createRadialGradient(
        cx,
        cy,
        outerRadius * 0.72,
        cx,
        cy,
        outerRadius
      );

    outer.addColorStop(
      0,
      "#6d3b00"
    );

    outer.addColorStop(
      0.32,
      "#f9c52f"
    );

    outer.addColorStop(
      0.58,
      "#fff09a"
    );

    outer.addColorStop(
      0.72,
      "#c77b00"
    );

    outer.addColorStop(
      0.9,
      "#ffd84c"
    );

    outer.addColorStop(
      1,
      "#744000"
    );

    ctx.fillStyle = outer;
    ctx.fill();

    /*
     * ARO PRETO
     */

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      outerRadius * 0.915,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      "#07090d";

    ctx.fill();

    /*
     * SETORES
     */

    const count =
      ROULETTE_SEGMENTS.length;

    const sectorAngle =
      Math.PI * 2 / count;

    const startAngle =
      -Math.PI / 2;

    const colors = [
      "#f8bd20",
      "#111319",
      "#7026df",
      "#111319",
      "#087ce9",
      "#111319",
      "#05a932",
      "#111319",
      "#ef1266",
      "#111319"
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
          outerRadius * 0.855,
          start,
          end
        );

        ctx.closePath();

        const base =
          colors[index];

        const gradient =
          ctx.createLinearGradient(
            cx,
            cy - outerRadius,
            cx,
            cy + outerRadius
          );

        gradient.addColorStop(
          0,
          lighten(base, 0.16)
        );

        gradient.addColorStop(
          0.48,
          base
        );

        gradient.addColorStop(
          1,
          darken(base, 0.18)
        );

        ctx.fillStyle =
          gradient;

        ctx.fill();

        ctx.lineWidth =
          size * 0.006;

        ctx.strokeStyle =
          "#e8b93c";

        ctx.stroke();

        drawSectorLabel(
          ctx,
          segment,
          cx,
          cy,
          outerRadius,
          start +
            sectorAngle / 2,
          size
        );
      }
    );

    /*
     * ANÉIS
     */

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      outerRadius * 0.855,
      0,
      Math.PI * 2
    );

    ctx.lineWidth =
      size * 0.018;

    ctx.strokeStyle =
      "#d99919";

    ctx.stroke();

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      outerRadius * 0.77,
      0,
      Math.PI * 2
    );

    ctx.lineWidth =
      size * 0.008;

    ctx.strokeStyle =
      "#f8d45d";

    ctx.stroke();

    /*
     * LÂMPADAS
     */

    const bulbsRadius =
      outerRadius * 0.895;

    for (
      let i = 0;
      i < 32;
      i++
    ) {

      const angle =
        startAngle +
        i *
          (
            Math.PI * 2 / 32
          );

      const x =
        cx +
        Math.cos(angle) *
          bulbsRadius;

      const y =
        cy +
        Math.sin(angle) *
          bulbsRadius;

      ctx.save();

      ctx.shadowColor =
        "#ffd63e";

      ctx.shadowBlur =
        size * 0.022;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        size * 0.014,
        0,
        Math.PI * 2
      );

      const bulb =
        ctx.createRadialGradient(
          x - size * 0.004,
          y - size * 0.004,
          0,
          x,
          y,
          size * 0.022
        );

      bulb.addColorStop(
        0,
        "#ffffff"
      );

      bulb.addColorStop(
        0.38,
        "#fff7b1"
      );

      bulb.addColorStop(
        1,
        "#f1b526"
      );

      ctx.fillStyle =
        bulb;

      ctx.fill();

      ctx.restore();
    }
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
      radius * 0.63;

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
        `900 ${size * 0.083}px Arial`;

      ctx.lineWidth =
        size * 0.014;

      ctx.strokeStyle =
        "#000";

      ctx.fillStyle =
        "#ff1828";

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
        `${size * 0.095}px Arial`;

      ctx.fillStyle =
        "#5cff36";

      ctx.strokeStyle =
        "#064b14";

      ctx.lineWidth =
        size * 0.006;

      ctx.strokeText(
        "🍀",
        0,
        -size * 0.025
      );

      ctx.fillText(
        "🍀",
        0,
        -size * 0.025
      );

      ctx.font =
        `900 ${size * 0.030}px Arial`;

      ctx.fillStyle =
        "#fff";

      ctx.strokeStyle =
        "#000";

      ctx.lineWidth =
        size * 0.007;

      ctx.strokeText(
        "GIRO",
        0,
        size * 0.055
      );

      ctx.strokeText(
        "GRÁTIS",
        0,
        size * 0.087
      );

      ctx.fillText(
        "GIRO",
        0,
        size * 0.055
      );

      ctx.fillText(
        "GRÁTIS",
        0,
        size * 0.087
      );

    } else {

      ctx.font =
        `900 ${size * 0.083}px Arial`;

      ctx.fillStyle =
        "#fff";

      ctx.strokeStyle =
        "#000";

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

    if (value === null) return;

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
   * ======================================================
   * ANIMAÇÃO
   *
   * O servidor escolhe o índice.
   * A roda é posicionada para esse índice.
   * O ponteiro NÃO gira.
   * ======================================================
   */

  function animateToIndex(index) {
    return new Promise(resolve => {

      const canvas =
        $("rouletteWheel")
          ?.querySelector(
            ".mybets-roulette-canvas"
          );

      if (!canvas) {
        resolve();
        return;
      }

      const count =
        ROULETTE_SEGMENTS.length;

      const sectorAngle =
        360 / count;

      const safeIndex =
        Math.max(
          0,
          Math.min(
            count - 1,
            Number(index) || 0
          )
        );

      /*
       * O centro de cada setor fica 18 graus
       * de cada lado da linha central.
       *
       * Para colocar o setor escolhido exatamente
       * no ponteiro superior:
       */

      const target =
        -(
          safeIndex *
            sectorAngle +
          sectorAngle / 2
        );

      const normalizedCurrent =
        ((rotation % 360) + 360) % 360;

      let difference =
        target -
        normalizedCurrent;

      while (difference < 0) {
        difference += 360;
      }

      /*
       * 6 voltas completas antes do resultado.
       */

      rotation +=
        360 * 6 +
        difference;

      canvas.style.transition =
        "transform 5.8s cubic-bezier(.12,.72,.16,1)";

      requestAnimationFrame(() => {
        canvas.style.transform =
          `rotate(${rotation}deg)`;
      });

      setTimeout(
        resolve,
        6000
      );
    });
  }

  function resultIndex(result) {
    const a =
      Number(result?.index);

    if (
      Number.isInteger(a) &&
      a >= 0 &&
      a < ROULETTE_SEGMENTS.length
    ) {
      return a;
    }

    const b =
      Number(result?.segmentIndex);

    if (
      Number.isInteger(b) &&
      b >= 0 &&
      b < ROULETTE_SEGMENTS.length
    ) {
      return b;
    }

    return 1;
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
     * Saldo real antes da aposta.
     */

    try {
      await refreshUser();
    } catch (error) {
      console.warn(
        "Falha ao atualizar saldo:",
        error
      );
    }

    const availableFreeSpins =
      Math.max(
        0,
        Math.floor(
          number(
            user?.rouletteFreeSpins ??
            user?.roulette_free_spins ??
            0
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
       * O BACKEND decide o resultado.
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
       * Atualiza o usuário imediatamente.
       */

      if (data?.user) {
        saveUser(data.user);
      }

      updateFreeSpinState();
      updateBalances();

      /*
       * Só depois da resposta do servidor
       * começa a animação.
       */

      await animateToIndex(index);

      /*
       * Atualização final do saldo.
       */

      try {
        await refreshUser();
      } catch (error) {
        console.warn(
          "Não foi possível atualizar saldo após giro:",
          error
        );
      }

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

      if (ganhouGiroGratis) {

        if ($("rouletteResult")) {
          $("rouletteResult").textContent =
            "🍀 GIRO GRÁTIS!";
        }

        if ($("winDisplay")) {
          $("winDisplay").textContent =
            "GIRO GRÁTIS";
        }

        toast(
          "Você ganhou um giro grátis!"
        );

      } else if (prize > 0) {

        if ($("rouletteResult")) {
          $("rouletteResult").textContent =
            `${label} — Você ganhou R$ ${money(prize)}`;
        }

        if ($("winDisplay")) {
          $("winDisplay").textContent =
            `R$ ${money(prize)}`;
        }

        toast(
          `Parabéns! Você ganhou R$ ${money(prize)}.`
        );

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
      $("backButton").onclick = () => {
        if (history.length > 1) {
          history.back();
        } else {
          location.href = "index.html";
        }
      };
    }

    if ($("stageBack")) {
      $("stageBack").onclick =
        back;
    }

    if ($("rouletteBetMinus")) {
      $("rouletteBetMinus").onclick = () => {
        setBet(
          Math.max(
            MIN_BET,
            bet - STEP
          )
        );
      };
    }

    if ($("rouletteBetPlus")) {
      $("rouletteBetPlus").onclick = () => {
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
      .forEach(button => {
        button.onclick = () => {
          setBet(
            button.dataset.rouletteBet
          );
        };
      });

    window.addEventListener(
      "resize",
      () => {

        const canvas =
          $("rouletteWheel")
            ?.querySelector(
              ".mybets-roulette-canvas"
            );

        if (!canvas) return;

        const savedTransform =
          canvas.style.transform;

        drawWheel(canvas);

        canvas.style.transform =
          savedTransform;
      }
    );
  }

  lobby();
  events();
  loadUser();

})();

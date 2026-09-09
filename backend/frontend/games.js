(() => {
  "use strict";

  const SEGMENTS = [
    { label: "2×", type: "prize", multiplier: 2 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "3×", type: "prize", multiplier: 3 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "4×", type: "prize", multiplier: 4 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "🍀", type: "free", multiplier: 0 },
    { label: "X", type: "zero", multiplier: 0 },
    { label: "5×", type: "prize", multiplier: 5 },
    { label: "X", type: "zero", multiplier: 0 }
  ];

  const COLORS = [
    "#e5a916",
    "#17191e",
    "#7224e8",
    "#17191e",
    "#0874ed",
    "#17191e",
    "#12a92d",
    "#17191e",
    "#f01870",
    "#17191e"
  ];

  let rotation = 0;
  let spinning = false;

  const $ = id => document.getElementById(id);

  function money(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function createDemoWheel() {
    const wheel = $("rouletteWheel");
    if (!wheel) return;

    wheel.innerHTML = "";

    wheel.className =
      "roulette-wheel roulette-code-wheel";

    const sectors = document.createElement("div");
    sectors.className = "roulette-code-sectors";

    const step = 360 / SEGMENTS.length;

    SEGMENTS.forEach((segment, index) => {
      const sector = document.createElement("div");

      sector.className =
        "roulette-code-sector";

      sector.style.setProperty(
        "--sector-color",
        COLORS[index]
      );

      sector.style.transform =
        `rotate(${index * step}deg)`;

      sector.innerHTML = `
        <span
          class="roulette-sector-content
          ${segment.type === "zero" ? "sector-x" : ""}
          ${segment.type === "free" ? "sector-free" : ""}"
        >
          ${
            segment.type === "free"
              ? `<b class="clover">☘</b><strong>GIRO</strong><strong>GRÁTIS</strong>`
              : segment.label
          }
        </span>
      `;

      sectors.appendChild(sector);
    });

    wheel.appendChild(sectors);

    const outer = document.createElement("div");
    outer.className = "roulette-code-outer-ring";
    wheel.appendChild(outer);

    const inner = document.createElement("div");
    inner.className = "roulette-code-inner-ring";
    wheel.appendChild(inner);

    const center = document.createElement("div");
    center.className = "roulette-code-center";
    center.innerHTML = `
      <span>♛</span>
      <strong>GIRAR</strong>
      <small>MYBETS</small>
    `;
    wheel.appendChild(center);

    const pointer = document.createElement("div");
    pointer.className = "roulette-code-pointer";
    pointer.innerHTML = `<span></span>`;

    const shell = wheel.parentElement;

    if (shell) {
      shell.appendChild(pointer);
    }

    center.onclick = spinDemo;

    wheel.style.transform =
      `rotate(${rotation}deg)`;
  }

  function updateResult(text) {
    const result = $("rouletteResult");

    if (result) {
      result.textContent = text;
    }
  }

  function spinDemo() {
    if (spinning) return;

    spinning = true;

    updateResult("Girando...");

    /*
     * Sorteio exclusivamente demonstrativo.
     * O índice escolhido é exatamente o setor
     * no qual a animação vai parar.
     */
    const index =
      Math.floor(
        Math.random() * SEGMENTS.length
      );

    const step =
      360 / SEGMENTS.length;

    /*
     * O centro do setor sorteado fica exatamente
     * sob o ponteiro fixo no topo.
     */
    const target =
      -(index * step + step / 2);

    const current =
      ((rotation % 360) + 360) % 360;

    let distance =
      target - current;

    while (distance < 0) {
      distance += 360;
    }

    rotation +=
      6 * 360 + distance;

    const wheel =
      $("rouletteWheel");

    wheel.style.transition =
      "transform 5.5s cubic-bezier(.12,.78,.16,1)";

    wheel.style.transform =
      `rotate(${rotation}deg)`;

    setTimeout(() => {
      const result =
        SEGMENTS[index];

      if (result.type === "free") {
        updateResult(
          "🍀 GIRO GRÁTIS!"
        );
      } else if (result.type === "prize") {
        updateResult(
          `${result.label} — Resultado demonstrativo`
        );
      } else {
        updateResult(
          "X — Resultado demonstrativo"
        );
      }

      spinning = false;
    }, 5700);
  }

  function bind() {
    const button =
      $("rouletteSpinButton");

    if (button) {
      button.onclick = spinDemo;
    }

    const center =
      $("rouletteCenterButton");

    if (center) {
      center.style.display = "none";
    }

    const oldPointer =
      document.querySelector(
        ".roulette-pointer"
      );

    if (oldPointer) {
      oldPointer.style.display = "none";
    }

    const bulbs =
      $("rouletteBulbs");

    if (bulbs) {
      bulbs.style.display = "none";
    }

    const inner =
      document.querySelector(
        ".roulette-inner-ring"
      );

    if (inner) {
      inner.style.display = "none";
    }
  }

  function initialize() {
    createDemoWheel();
    bind();

    const balance =
      $("balance");

    const stageBalance =
      $("stageBalance");

    if (balance) {
      balance.textContent = "0,00";
    }

    if (stageBalance) {
      stageBalance.textContent = "0,00";
    }

    const bet =
      $("rouletteBetValue");

    if (bet) {
      bet.textContent = "R$ 0,50";
    }
  }

  initialize();

})();

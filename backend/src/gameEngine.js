// backend/src/gameEngine.js

import crypto from "crypto";

/*
 * Motor central dos jogos JPBET.
 *
 * Ele foi criado para permitir que várias máquinas usem
 * a mesma estrutura de funcionamento.
 *
 * Cada jogo pode ter:
 * - quantidade de rolos;
 * - quantidade de linhas;
 * - símbolos próprios;
 * - pesos/probabilidades;
 * - tabela de pagamentos;
 * - wild;
 * - scatter;
 * - bônus;
 * - multiplicadores.
 */

/* =========================================================
   FUNÇÕES BÁSICAS
========================================================= */

export function numero(valor, padrao = 0) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}

export function arredondar(valor, casas = 2) {
  const fator = 10 ** casas;
  return Math.round((numero(valor) + Number.EPSILON) * fator) / fator;
}

export function gerarIdRodada(prefixo = "SPIN") {
  return `${prefixo}-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

/* =========================================================
   SORTEIO PONDERADO
========================================================= */

export function escolherPorPeso(itens, pesoKey = "weight") {
  if (!Array.isArray(itens) || itens.length === 0) {
    return null;
  }

  let pesoTotal = 0;

  for (const item of itens) {
    const peso = Math.max(0, numero(item?.[pesoKey], 0));
    pesoTotal += peso;
  }

  if (pesoTotal <= 0) {
    return itens[Math.floor(Math.random() * itens.length)];
  }

  let sorteio = Math.random() * pesoTotal;

  for (const item of itens) {
    const peso = Math.max(0, numero(item?.[pesoKey], 0));

    if (sorteio < peso) {
      return item;
    }

    sorteio -= peso;
  }

  return itens[itens.length - 1];
}

/* =========================================================
   SÍMBOLO ALEATÓRIO
========================================================= */

export function escolherSimbolo(simbolos) {
  return escolherPorPeso(simbolos, "weight");
}

/* =========================================================
   GERAR ROLO
========================================================= */

export function gerarRolo(simbolos, rows = 3) {
  const quantidade = Math.max(1, Math.floor(numero(rows, 3)));
  const resultado = [];

  for (let i = 0; i < quantidade; i++) {
    const simbolo = escolherSimbolo(simbolos);

    resultado.push(
      simbolo
        ? {
            ...simbolo
          }
        : {
            id: "blank",
            label: "",
            weight: 1,
            value: 0
          }
    );
  }

  return resultado;
}

/* =========================================================
   GERAR MATRIZ DOS ROLOS
========================================================= */

export function gerarGrade(config) {
  const reels = Math.max(1, Math.floor(numero(config?.reels, 5)));
  const rows = Math.max(1, Math.floor(numero(config?.rows, 3)));

  const simbolos = Array.isArray(config?.symbols)
    ? config.symbols
    : [];

  const grade = [];

  for (let reel = 0; reel < reels; reel++) {
    grade.push(gerarRolo(simbolos, rows));
  }

  return grade;
}

/* =========================================================
   CONVERTER GRADE PARA LINHAS
========================================================= */

export function obterSimbolo(grade, reel, row) {
  if (!Array.isArray(grade)) {
    return null;
  }

  if (!Array.isArray(grade[reel])) {
    return null;
  }

  return grade[reel][row] || null;
}

export function obterLinha(grade, linha, rows = 3) {
  if (!Array.isArray(grade)) {
    return [];
  }

  const resultado = [];

  for (let reel = 0; reel < grade.length; reel++) {
    const row = Array.isArray(linha)
      ? numero(linha[reel], 0)
      : 0;

    const simbolo = obterSimbolo(grade, reel, row);

    resultado.push(simbolo);
  }

  return resultado;
}

/* =========================================================
   VERIFICAR COMBINAÇÃO
========================================================= */

/*
 * Por padrão, a combinação precisa começar no primeiro rolo
 * e continuar sem interrupção.
 *
 * Wild pode substituir símbolos comuns.
 */

export function avaliarLinha(simbolosLinha, config) {
  if (!Array.isArray(simbolosLinha) || simbolosLinha.length === 0) {
    return {
      symbolId: null,
      count: 0,
      multiplier: 0,
      win: 0,
      positions: []
    };
  }

  const symbols = Array.isArray(config?.symbols)
    ? config.symbols
    : [];

  const paytable =
    config?.paytable &&
    typeof config.paytable === "object"
      ? config.paytable
      : {};

  const wildIds = new Set(
    Array.isArray(config?.wildSymbols)
      ? config.wildSymbols
      : symbols
          .filter((s) => s?.wild === true)
          .map((s) => s.id)
  );

  const scatterIds = new Set(
    Array.isArray(config?.scatterSymbols)
      ? config.scatterSymbols
      : symbols
          .filter((s) => s?.scatter === true)
          .map((s) => s.id)
  );

  /*
   * Primeiro procuramos a melhor combinação possível
   * entre os símbolos disponíveis.
   */

  const candidatos = [];

  for (const symbol of symbols) {
    if (!symbol?.id) {
      continue;
    }

    if (wildIds.has(symbol.id)) {
      continue;
    }

    if (scatterIds.has(symbol.id)) {
      continue;
    }

    candidatos.push(symbol.id);
  }

  let melhor = {
    symbolId: null,
    count: 0,
    multiplier: 0,
    positions: []
  };

  for (const symbolId of candidatos) {
    let count = 0;
    const positions = [];

    for (let i = 0; i < simbolosLinha.length; i++) {
      const atual = simbolosLinha[i];

      if (!atual) {
        break;
      }

      const id = atual.id;

      if (id === symbolId || wildIds.has(id)) {
        count++;
        positions.push(i);
      } else {
        break;
      }
    }

    const tabela = paytable[symbolId];

    let multiplier = 0;

    if (tabela && typeof tabela === "object") {
      multiplier = numero(tabela[count], 0);
    } else if (Array.isArray(tabela)) {
      multiplier = numero(tabela[count - 1], 0);
    }

    if (
      multiplier > melhor.multiplier ||
      (multiplier === melhor.multiplier && count > melhor.count)
    ) {
      melhor = {
        symbolId,
        count,
        multiplier,
        positions
      };
    }
  }

  return {
    ...melhor,
    win: melhor.multiplier
  };
}

/* =========================================================
   CONTAR SCATTERS
========================================================= */

export function contarScatters(grade, config) {
  if (!Array.isArray(grade)) {
    return 0;
  }

  const scatterIds = new Set(
    Array.isArray(config?.scatterSymbols)
      ? config.scatterSymbols
      : (Array.isArray(config?.symbols)
          ? config.symbols
              .filter((s) => s?.scatter === true)
              .map((s) => s.id)
          : [])
  );

  let total = 0;

  for (const reel of grade) {
    if (!Array.isArray(reel)) {
      continue;
    }

    for (const symbol of reel) {
      if (symbol && scatterIds.has(symbol.id)) {
        total++;
      }
    }
  }

  return total;
}

/* =========================================================
   GERAR LINHAS PADRÃO
========================================================= */

export function gerarLinhasPadrao(reels, rows = 3) {
  const totalReels = Math.max(1, Math.floor(numero(reels, 5)));
  const totalRows = Math.max(1, Math.floor(numero(rows, 3)));

  const linhas = [];

  /*
   * Linha central
   */
  const centro = Math.floor(totalRows / 2);

  linhas.push(
    Array.from(
      { length: totalReels },
      () => centro
    )
  );

  /*
   * Linha superior
   */
  if (totalRows >= 3) {
    linhas.push(
      Array.from(
        { length: totalReels },
        () => 0
      )
    );

    /*
     * Linha inferior
     */
    linhas.push(
      Array.from(
        { length: totalReels },
        () => totalRows - 1
      )
    );
  }

  /*
   * Diagonal superior -> inferior
   */
  if (totalRows >= 3 && totalReels >= 3) {
    linhas.push(
      Array.from(
        { length: totalReels },
        (_, index) => {
          const pos = index % totalRows;
          return pos;
        }
      )
    );

    /*
     * Diagonal inferior -> superior
     */
    linhas.push(
      Array.from(
        { length: totalReels },
        (_, index) => {
          const pos =
            totalRows - 1 - (index % totalRows);

          return Math.max(0, pos);
        }
      )
    );
  }

  return linhas;
}

/* =========================================================
   OBTER LINHAS DO JOGO
========================================================= */

export function obterLinhas(config) {
  const reels = Math.max(
    1,
    Math.floor(numero(config?.reels, 5))
  );

  const rows = Math.max(
    1,
    Math.floor(numero(config?.rows, 3))
  );

  if (
    Array.isArray(config?.lines) &&
    config.lines.length > 0
  ) {
    return config.lines.map((linha) =>
      Array.from(
        { length: reels },
        (_, index) =>
          Math.max(
            0,
            Math.min(
              rows - 1,
              Math.floor(
                numero(linha?.[index], 0)
              )
            )
          )
      )
    );
  }

  return gerarLinhasPadrao(reels, rows);
}

/* =========================================================
   CALCULAR PRÊMIOS
========================================================= */

export function calcularPremios(grade, config, apostaPorLinha = 0) {
  const linhas = obterLinhas(config);

  const premios = [];
  let multiplicadorTotal = 0;

  for (let index = 0; index < linhas.length; index++) {
    const linha = obterLinha(
      grade,
      linhas[index],
      numero(config?.rows, 3)
    );

    const resultado = avaliarLinha(
      linha,
      config
    );

    if (resultado.multiplier > 0) {
      const valor =
        arredondar(
          apostaPorLinha * resultado.multiplier
        );

      multiplicadorTotal +=
        resultado.multiplier;

      premios.push({
        line: index + 1,
        symbolId: resultado.symbolId,
        count: resultado.count,
        multiplier: resultado.multiplier,
        amount: valor,
        positions: resultado.positions
      });
    }
  }

  return {
    prizes: premios,
    totalMultiplier: multiplicadorTotal,
    totalWin: arredondar(
      premios.reduce(
        (total, premio) =>
          total + numero(premio.amount, 0),
        0
      )
    )
  };
}

/* =========================================================
   BÔNUS / SCATTER
========================================================= */

export function calcularBonus(grade, config) {
  const scatterCount =
    contarScatters(grade, config);

  const bonus =
    config?.bonus &&
    typeof config.bonus === "object"
      ? config.bonus
      : {};

  const triggerAt = Math.max(
    0,
    Math.floor(
      numero(
        bonus.triggerAt,
        3
      )
    )
  );

  let freeSpins = 0;

  if (
    triggerAt > 0 &&
    scatterCount >= triggerAt
  ) {
    freeSpins =
      Math.max(
        0,
        Math.floor(
          numero(
            bonus.freeSpins,
            0
          )
        )
      );
  }

  return {
    scatterCount,
    triggered: freeSpins > 0,
    freeSpins
  };
}

/* =========================================================
   SPIN COMPLETO
========================================================= */

export function executarSpin({
  config,
  bet,
  freeSpin = false
}) {
  const aposta = arredondar(
    Math.max(0, numero(bet, 0))
  );

  const grade =
    gerarGrade(config);

  const linhas =
    obterLinhas(config);

  const quantidadeLinhas =
    Math.max(
      1,
      linhas.length
    );

  const apostaPorLinha =
    arredondar(
      aposta / quantidadeLinhas
    );

  const resultado =
    calcularPremios(
      grade,
      config,
      apostaPorLinha
    );

  const bonus =
    calcularBonus(
      grade,
      config
    );

  let totalWin =
    resultado.totalWin;

  /*
   * Se for free spin, o prêmio continua sendo
   * calculado normalmente.
   */

  if (freeSpin) {
    totalWin =
      arredondar(totalWin);
  }

  return {
    roundId: gerarIdRodada(),
    gameId: config?.id || null,
    bet: aposta,
    freeSpin: Boolean(freeSpin),

    reels: numero(config?.reels, 5),
    rows: numero(config?.rows, 3),

    grid: grade,

    lines: linhas,

    prizes: resultado.prizes,

    totalMultiplier:
      resultado.totalMultiplier,

    win: totalWin,

    scatterCount:
      bonus.scatterCount,

    bonusTriggered:
      bonus.triggered,

    freeSpinsAwarded:
      bonus.freeSpins
  };
}

/* =========================================================
   CONFIGURAÇÕES PADRÃO DOS JOGOS
========================================================= */

const SYMBOLS_FORTUNE_7 = [
  {
    id: "seven",
    label: "7",
    weight: 8
  },
  {
    id: "lucky7",
    label: "LUCKY 7",
    weight: 3
  },
  {
    id: "bar3",
    label: "BAR BAR BAR",
    weight: 5
  },
  {
    id: "bar2",
    label: "BAR BAR",
    weight: 8
  },
  {
    id: "bar1",
    label: "BAR",
    weight: 12
  },
  {
    id: "cherry",
    label: "🍒",
    weight: 16
  }
];

const SYMBOLS_LUCKY_7 = [
  {
    id: "seven",
    label: "7",
    weight: 8
  },
  {
    id: "lucky7",
    label: "LUCKY 7",
    weight: 3
  },
  {
    id: "triplebar",
    label: "BAR BAR BAR",
    weight: 5
  },
  {
    id: "doublebar",
    label: "BAR BAR",
    weight: 8
  },
  {
    id: "bar",
    label: "BAR",
    weight: 12
  },
  {
    id: "cherry",
    label: "🍒",
    weight: 16
  }
];

const SYMBOLS_DIAMOND_GOLD = [
  {
    id: "diamond",
    label: "💎",
    weight: 5
  },
  {
    id: "gold",
    label: "GOLD",
    weight: 7
  },
  {
    id: "crown",
    label: "👑",
    weight: 8
  },
  {
    id: "seven",
    label: "7",
    weight: 10
  },
  {
    id: "bar",
    label: "BAR",
    weight: 13
  },
  {
    id: "bell",
    label: "🔔",
    weight: 15
  },
  {
    id: "cherry",
    label: "🍒",
    weight: 17
  },
  {
    id: "scatter",
    label: "★",
    weight: 4,
    scatter: true
  }
];

const SYMBOLS_ROYAL_JACKPOT = [
  {
    id: "royal",
    label: "ROYAL",
    weight: 4
  },
  {
    id: "jackpot",
    label: "JACKPOT",
    weight: 4
  },
  {
    id: "crown",
    label: "👑",
    weight: 7
  },
  {
    id: "diamond",
    label: "💎",
    weight: 9
  },
  {
    id: "seven",
    label: "7",
    weight: 11
  },
  {
    id: "bar",
    label: "BAR",
    weight: 14
  },
  {
    id: "bell",
    label: "🔔",
    weight: 16
  },
  {
    id: "cherry",
    label: "🍒",
    weight: 18
  },
  {
    id: "scatter",
    label: "★",
    weight: 4,
    scatter: true
  }
];

/* =========================================================
   CONFIGURAÇÕES PADRÃO
========================================================= */

export const DEFAULT_GAMES = {
  fortune7: {
    id: "fortune7",
    name: "Fortune 7",
    enabled: true,

    reels: 3,
    rows: 3,

    minBet: 1,
    maxBet: 1000,

    lines: [
      [1, 1, 1]
    ],

    symbols: SYMBOLS_FORTUNE_7,

    paytable: {
      seven: {
        3: 100
      },
      lucky7: {
        3: 250
      },
      bar3: {
        3: 50
      },
      bar2: {
        3: 25
      },
      bar1: {
        3: 10
      },
      cherry: {
        3: 5
      }
    },

    wildSymbols: [],
    scatterSymbols: [],

    bonus: {
      triggerAt: 0,
      freeSpins: 0
    }
  },

  diamondGold: {
    id: "diamondGold",
    name: "Diamond Gold",
    enabled: true,

    reels: 5,
    rows: 3,

    minBet: 1,
    maxBet: 1000,

    lines: [
      [1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0],
      [2, 2, 2, 2, 2],
      [0, 1, 2, 1, 0],
      [2, 1, 0, 1, 2]
    ],

    symbols: SYMBOLS_DIAMOND_GOLD,

    paytable: {
      diamond: {
        3: 10,
        4: 50,
        5: 500
      },

      gold: {
        3: 8,
        4: 30,
        5: 150
      },

      crown: {
        3: 6,
        4: 20,
        5: 100
      },

      seven: {
        3: 5,
        4: 15,
        5: 75
      },

      bar: {
        3: 3,
        4: 10,
        5: 40
      },

      bell: {
        3: 2,
        4: 6,
        5: 20
      },

      cherry: {
        3: 1,
        4: 3,
        5: 10
      }
    },

    wildSymbols: [],

    scatterSymbols: [
      "scatter"
    ],

    bonus: {
      triggerAt: 3,
      freeSpins: 5
    }
  },

  royalJackpot: {
    id: "royalJackpot",
    name: "Royal Jackpot",
    enabled: true,

    reels: 5,
    rows: 3,

    minBet: 1,
    maxBet: 1000,

    lines: [
      [1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0],
      [2, 2, 2, 2, 2],
      [0, 1, 2, 1, 0],
      [2, 1, 0, 1, 2]
    ],

    symbols: SYMBOLS_ROYAL_JACKPOT,

    paytable: {
      royal: {
        3: 20,
        4: 100,
        5: 1000
      },

      jackpot: {
        3: 15,
        4: 75,
        5: 500
      },

      crown: {
        3: 8,
        4: 30,
        5: 200
      },

      diamond: {
        3: 6,
        4: 20,
        5: 100
      },

      seven: {
        3: 4,
        4: 15,
        5: 60
      },

      bar: {
        3: 3,
        4: 8,
        5: 30
      },

      bell: {
        3: 2,
        4: 5,
        5: 20
      },

      cherry: {
        3: 1,
        4: 3,
        5: 10
      }
    },

    wildSymbols: [],

    scatterSymbols: [
      "scatter"
    ],

    bonus: {
      triggerAt: 3,
      freeSpins: 3
    }
  },

  lucky7: {
    id: "lucky7",
    name: "Lucky 7",
    enabled: true,

    reels: 3,
    rows: 3,

    minBet: 1,
    maxBet: 1000,

    lines: [
      [1, 1, 1]
    ],

    symbols: SYMBOLS_LUCKY_7,

    paytable: {
      seven: {
        3: 100
      },

      lucky7: {
        3: 250
      },

      triplebar: {
        3: 50
      },

      doublebar: {
        3: 25
      },

      bar: {
        3: 10
      },

      cherry: {
        3: 5
      }
    },

    wildSymbols: [],
    scatterSymbols: [],

    bonus: {
      triggerAt: 0,
      freeSpins: 0
    }
  }
};

/* =========================================================
   BUSCAR CONFIGURAÇÃO PADRÃO
========================================================= */

export function obterJogoPadrao(gameId) {
  if (!gameId) {
    return null;
  }

  return DEFAULT_GAMES[gameId] || null;
}

/* =========================================================
   NORMALIZAR CONFIGURAÇÃO
========================================================= */

export function normalizarConfiguracaoJogo(config) {
  if (!config || typeof config !== "object") {
    return null;
  }

  const base =
    obterJogoPadrao(config.id) || {};

  const resultado = {
    ...base,
    ...config
  };

  resultado.reels = Math.max(
    1,
    Math.floor(
      numero(
        resultado.reels,
        base.reels || 5
      )
    )
  );

  resultado.rows = Math.max(
    1,
    Math.floor(
      numero(
        resultado.rows,
        base.rows || 3
      )
    )
  );

  resultado.minBet = Math.max(
    0.01,
    arredondar(
      numero(
        resultado.minBet,
        1
      )
    )
  );

  resultado.maxBet = Math.max(
    resultado.minBet,
    arredondar(
      numero(
        resultado.maxBet,
        1000
      )
    )
  );

  resultado.symbols =
    Array.isArray(resultado.symbols)
      ? resultado.symbols
          .filter(
            (symbol) =>
              symbol &&
              typeof symbol === "object" &&
              symbol.id
          )
          .map((symbol) => ({
            ...symbol,
            weight: Math.max(
              0,
              numero(
                symbol.weight,
                1
              )
            )
          }))
      : [];

  resultado.paytable =
    resultado.paytable &&
    typeof resultado.paytable === "object"
      ? resultado.paytable
      : {};

  resultado.wildSymbols =
    Array.isArray(
      resultado.wildSymbols
    )
      ? resultado.wildSymbols
      : [];

  resultado.scatterSymbols =
    Array.isArray(
      resultado.scatterSymbols
    )
      ? resultado.scatterSymbols
      : [];

  resultado.bonus =
    resultado.bonus &&
    typeof resultado.bonus === "object"
      ? resultado.bonus
      : {
          triggerAt: 0,
          freeSpins: 0
        };

  return resultado;
}

/* =========================================================
   LISTA DOS JOGOS
========================================================= */

export function listarJogosPadrao() {
  return Object.values(
    DEFAULT_GAMES
  ).map((game) =>
    normalizarConfiguracaoJogo(
      game
    )
  );
}

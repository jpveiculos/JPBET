import crypto from "crypto";

/*
  MOTOR CENTRAL DAS MÁQUINAS JPBET

  Todas as máquinas usam este mesmo motor.
  Cada máquina possui sua própria configuração.

  Os pesos são utilizados para determinar a frequência
  dos símbolos em cada rolo.
*/

function numero(valor, padrao = 0) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}

function arredondar(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function aleatorioSeguro() {
  const bytes = crypto.randomBytes(6);
  const inteiro = bytes.readUIntBE(0, 6);
  return inteiro / 0x1000000000000;
}

function escolherPonderado(itens) {
  const validos = itens.filter(
    item => numero(item.weight, 0) > 0
  );

  if (!validos.length) {
    throw new Error("Configuração de símbolos inválida.");
  }

  const total = validos.reduce(
    (soma, item) => soma + numero(item.weight),
    0
  );

  let alvo = aleatorioSeguro() * total;

  for (const item of validos) {
    alvo -= numero(item.weight);

    if (alvo < 0) {
      return item;
    }
  }

  return validos[validos.length - 1];
}

function gerarRolo(simbolos) {
  return simbolos.map(symbol => escolherPonderado(symbol));
}

function gerarResultado(config) {
  const reels = [];

  for (let i = 0; i < config.reels; i++) {
    reels.push(gerarRolo(config.symbols));
  }

  return reels;
}

function obterSimbolo(resultado, reel, row = 0) {
  return resultado[reel]?.[row]?.id || null;
}

function calcularLinha(resultado, linha, config, aposta) {
  const simbolos = linha.positions.map(
    pos => obterSimbolo(
      resultado,
      pos.reel,
      pos.row
    )
  );

  const primeiro = simbolos[0];

  if (!primeiro) {
    return {
      symbols: simbolos,
      multiplier: 0,
      win: 0
    };
  }

  let quantidade = 1;

  for (let i = 1; i < simbolos.length; i++) {
    const atual = simbolos[i];

    if (
      atual === primeiro ||
      atual === config.wild
    ) {
      quantidade++;
    } else {
      break;
    }
  }

  if (quantidade < 3) {
    return {
      symbols: simbolos,
      multiplier: 0,
      win: 0
    };
  }

  const pagamento =
    config.payouts?.[primeiro];

  if (!pagamento) {
    return {
      symbols: simbolos,
      multiplier: 0,
      win: 0
    };
  }

  const multiplier =
    numero(
      pagamento[String(quantidade)] ??
      pagamento[String(config.reels)] ??
      0
    );

  const win = arredondar(
    aposta * multiplier
  );

  return {
    symbols: simbolos,
    multiplier,
    win
  };
}

function calcularPremio(resultado, config, aposta) {
  let total = 0;
  const linhas = [];

  for (const linha of config.paylines) {
    const calculo = calcularLinha(
      resultado,
      linha,
      config,
      aposta
    );

    linhas.push({
      id: linha.id,
      ...calculo
    });

    total += calculo.win;
  }

  /*
    Jackpot especial.
  */
  const jackpot =
    config.jackpot;

  let jackpotWin = 0;

  if (jackpot?.enabled) {
    const primeira =
      obterSimbolo(resultado, 0, 0);

    const ultima =
      obterSimbolo(
        resultado,
        config.reels - 1,
        0
      );

    if (
      primeira === jackpot.symbol &&
      ultima === jackpot.symbol
    ) {
      jackpotWin =
        arredondar(
          aposta *
          numero(jackpot.multiplier)
        );
    }
  }

  total += jackpotWin;

  return {
    total: arredondar(total),
    jackpotWin,
    lines: linhas
  };
}

export function jogarMaquina(config, aposta) {
  const valorAposta = arredondar(aposta);

  if (!config || !config.enabled) {
    throw new Error("Máquina indisponível.");
  }

  if (
    !Number.isFinite(valorAposta) ||
    valorAposta <= 0
  ) {
    throw new Error("Aposta inválida.");
  }

  if (
    valorAposta < numero(config.minBet) ||
    valorAposta > numero(config.maxBet)
  ) {
    throw new Error(
      `A aposta deve estar entre ${config.minBet} e ${config.maxBet}.`
    );
  }

  const resultado =
    gerarResultado(config);

  const premio =
    calcularPremio(
      resultado,
      config,
      valorAposta
    );

  return {
    result: resultado,
    bet: valorAposta,
    win: premio.total,
    jackpotWin: premio.jackpotWin,
    lines: premio.lines,
    timestamp: new Date().toISOString()
  };
}

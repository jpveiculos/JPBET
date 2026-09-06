import { pool } from "./db.js";

const DEFAULT_SETTINGS = {
  site_name: "JPBET",
  site_description:
    "Plataforma JPBET — experiência premium de entretenimento.",
  site_logo: "",
  site_favicon: "",

  initial_bonus_amount: "100",
  bonus_system_enabled: "true",
  bonus_wager_requirement: "100",

  roulette_min_bet: "0.50",
  roulette_max_bet: "100",
  roulette_max_multiplier: "100",

  roulette_rtp: "96",
  roulette_replay_probability: "0",

  roulette_segments_json: JSON.stringify([
    {
      label: "❌",
      type: "zero",
      multiplier: 0,
      probability: 5
    },
    {
      label: "❌",
      type: "zero",
      multiplier: 0,
      probability: 5
    },
    {
      label: "❌",
      type: "zero",
      multiplier: 0,
      probability: 5
    },
    {
      label: "❌",
      type: "zero",
      multiplier: 0,
      probability: 5
    },
    {
      label: "❌",
      type: "zero",
      multiplier: 0,
      probability: 5
    },
    {
      label: "2×",
      type: "prize",
      multiplier: 2,
      probability: 5
    },
    {
      label: "2×",
      type: "prize",
      multiplier: 2,
      probability: 5
    },
    {
      label: "2×",
      type: "prize",
      multiplier: 2,
      probability: 5
    },
    {
      label: "3×",
      type: "prize",
      multiplier: 3,
      probability: 5
    },
    {
      label: "3×",
      type: "prize",
      multiplier: 3,
      probability: 5
    },
    {
      label: "3×",
      type: "prize",
      multiplier: 3,
      probability: 5
    },
    {
      label: "5×",
      type: "prize",
      multiplier: 5,
      probability: 5
    },
    {
      label: "5×",
      type: "prize",
      multiplier: 5,
      probability: 5
    },
    {
      label: "10×",
      type: "prize",
      multiplier: 10,
      probability: 5
    },
    {
      label: "20×",
      type: "prize",
      multiplier: 20,
      probability: 5
    },
    {
      label: "30×",
      type: "prize",
      multiplier: 30,
      probability: 5
    },
    {
      label: "50×",
      type: "prize",
      multiplier: 50,
      probability: 5
    },
    {
      label: "75×",
      type: "prize",
      multiplier: 75,
      probability: 5
    },
    {
      label: "100×",
      type: "prize",
      multiplier: 100,
      probability: 5
    },
    {
      label: "🍀",
      type: "sorte",
      multiplier: 0,
      probability: 5
    }
  ]),

  notification_enabled: "false",

  notification_deposit_requested: "true",
  notification_withdrawal_requested: "true",
  notification_deposit_approved: "true",
  notification_deposit_rejected: "true",
  notification_withdrawal_approved: "true",
  notification_withdrawal_rejected: "true",
  notification_withdrawal_completed: "true",

  notification_webhook_url: "",
  notification_webhook_token: "",
  notification_recipient: ""
};

export async function garantirConfiguracoes() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL DEFAULT ''
      )
    `);

    for (const [key, value] of Object.entries(
      DEFAULT_SETTINGS
    )) {
      await pool.query(
        `
        INSERT INTO site_settings
          (setting_key, setting_value)
        VALUES ($1, $2)
        ON CONFLICT (setting_key)
        DO NOTHING
        `,
        [key, value]
      );
    }

    /*
     * Migração da configuração antiga da roleta.
     * Se a configuração anterior ainda possuir
     * "JOGUE NOVAMENTE" ou multiplicador 1×,
     * substitui pela nova configuração.
     */

    const rouletteResult = await pool.query(
      `
      SELECT setting_value
      FROM site_settings
      WHERE setting_key = 'roulette_segments_json'
      LIMIT 1
      `
    );

    if (rouletteResult.rows.length) {
      const current =
        rouletteResult.rows[0].setting_value || "";

      if (
        current.includes("JOGUE NOVAMENTE") ||
        current.includes('"multiplier":1')
      ) {
        await pool.query(
          `
          UPDATE site_settings
          SET setting_value = $1
          WHERE setting_key = 'roulette_segments_json'
          `,
          [
            DEFAULT_SETTINGS
              .roulette_segments_json
          ]
        );
      }
    }

    console.log(
      "Configurações do site inicializadas."
    );
  } catch (error) {
    console.error(
      "Erro ao inicializar configurações:",
      error
    );
  }
}

export async function obterConfiguracao(
  chave,
  valorPadrao = null
) {
  try {
    const result = await pool.query(
      `
      SELECT setting_value
      FROM site_settings
      WHERE setting_key = $1
      LIMIT 1
      `,
      [chave]
    );

    if (!result.rows.length) {
      return valorPadrao;
    }

    return result.rows[0].setting_value;
  } catch (error) {
    console.error(
      `Erro ao obter configuração ${chave}:`,
      error
    );

    return valorPadrao;
  }
}

export async function obterConfiguracoes(
  incluirPrivadas = false
) {
  try {
    const result = await pool.query(`
      SELECT
        setting_key,
        setting_value
      FROM site_settings
      ORDER BY setting_key
    `);

    const settings = {};

    for (const row of result.rows) {
      if (
        !incluirPrivadas &&
        row.setting_key.startsWith(
          "notification_"
        )
      ) {
        continue;
      }

      settings[row.setting_key] =
        row.setting_value;
    }

    return settings;
  } catch (error) {
    console.error(
      "Erro ao obter configurações:",
      error
    );

    return {};
  }
}

export async function salvarConfiguracao(
  chave,
  valor
) {
  await pool.query(
    `
    INSERT INTO site_settings
      (setting_key, setting_value)
    VALUES ($1, $2)
    ON CONFLICT (setting_key)
    DO UPDATE SET
      setting_value = EXCLUDED.setting_value
    `,
    [
      chave,
      String(valor ?? "")
    ]
  );
}

export async function salvarConfiguracoes(
  configuracoes = {}
) {
  for (const [chave, valor] of Object.entries(
    configuracoes
  )) {
    await salvarConfiguracao(
      chave,
      valor
    );
  }
}

export function obterConfiguracoesPadrao() {
  return {
    ...DEFAULT_SETTINGS
  };
}

export function obterSegmentosPadrao() {
  try {
    return JSON.parse(
      DEFAULT_SETTINGS
        .roulette_segments_json
    );
  } catch (_) {
    return [];
  }
}

export default {
  garantirConfiguracoes,
  obterConfiguracao,
  obterConfiguracoes,
  salvarConfiguracao,
  salvarConfiguracoes,
  obterConfiguracoesPadrao,
  obterSegmentosPadrao
};

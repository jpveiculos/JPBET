import express from "express";
import { pool } from "./db.js";

const router = express.Router();

/* =========================
   CRIAR TABELA DE CONFIGURAÇÕES
========================= */

async function inicializarConfiguracoes() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const configuracoes = [
      ["site_name", "JPBET"],
      ["site_title", "JPBET - Plataforma de Jogos"],
      ["site_description", "Uma experiência de jogos moderna, rápida e pensada para dispositivos móveis."],
      ["footer_text", "© 2026 JPBET — Plataforma de demonstração."],

      ["roulette_enabled", "true"],
      ["roulette_min_bet", "1"],
      ["roulette_max_bet", "100"],
      ["roulette_rtp", "95"],

      ["primary_button_text", "ENTRAR NA PLATAFORMA"],
      ["login_button_text", "ENTRAR"],
      ["register_button_text", "CRIAR CONTA"],
      ["roulette_button_text", "🎰 JOGAR NA ROLETA"],

      ["maintenance_mode", "false"],
      ["maintenance_message", "Plataforma temporariamente em manutenção."]
    ];

    for (const [key, value] of configuracoes) {
      await pool.query(
        `
        INSERT INTO site_settings
        (setting_key, setting_value)
        VALUES ($1, $2)
        ON CONFLICT (setting_key) DO NOTHING
        `,
        [key, value]
      );
    }

    console.log(
      "Configurações do JPBET inicializadas com sucesso."
    );

  } catch (error) {

    console.error(
      "Erro ao inicializar configurações:",
      error
    );
  }
}

inicializarConfiguracoes();


/* =========================
   LISTAR CONFIGURAÇÕES
========================= */

router.get("/", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT setting_key, setting_value, updated_at
      FROM site_settings
      ORDER BY setting_key
    `);

    res.json({
      ok: true,
      settings: result.rows
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Erro ao carregar configurações."
    });
  }
});


/* =========================
   BUSCAR UMA CONFIGURAÇÃO
========================= */

router.get("/:key", async (req, res) => {

  try {

    const { key } = req.params;

    const result = await pool.query(
      `
      SELECT setting_key, setting_value
      FROM site_settings
      WHERE setting_key = $1
      LIMIT 1
      `,
      [key]
    );

    if (result.rows.length === 0) {

      return res.status(404).json({
        message: "Configuração não encontrada."
      });
    }

    res.json({
      ok: true,
      setting: result.rows[0]
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Erro ao buscar configuração."
    });
  }
});


/* =========================
   ALTERAR CONFIGURAÇÃO
========================= */

router.put("/:key", async (req, res) => {

  try {

    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined || value === null) {

      return res.status(400).json({
        message: "Informe o novo valor."
      });
    }

    const result = await pool.query(
      `
      INSERT INTO site_settings
      (setting_key, setting_value, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)

      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        updated_at = CURRENT_TIMESTAMP

      RETURNING setting_key, setting_value, updated_at
      `,
      [key, String(value)]
    );

    res.json({
      ok: true,
      message: "Configuração atualizada com sucesso.",
      setting: result.rows[0]
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Erro ao atualizar configuração."
    });
  }
});


/* =========================
   ALTERAR VÁRIAS CONFIGURAÇÕES
========================= */

router.put("/", async (req, res) => {

  try {

    const settings = req.body;

    if (
      !settings ||
      typeof settings !== "object" ||
      Array.isArray(settings)
    ) {

      return res.status(400).json({
        message: "Formato de configurações inválido."
      });
    }

    for (const [key, value] of Object.entries(settings)) {

      if (value === undefined || value === null) {
        continue;
      }

      await pool.query(
        `
        INSERT INTO site_settings
        (setting_key, setting_value, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)

        ON CONFLICT (setting_key)
        DO UPDATE SET
          setting_value = EXCLUDED.setting_value,
          updated_at = CURRENT_TIMESTAMP
        `,
        [key, String(value)]
      );
    }

    res.json({
      ok: true,
      message: "Configurações atualizadas com sucesso."
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Erro ao atualizar configurações."
    });
  }
});


export default router;

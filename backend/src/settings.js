import { pool } from "./db.js";
/* =========================
   CONFIGURAÇÕES PADRÃO
========================= */
const CONFIGURACOES_PADRAO = {
  /* =========================
     PÁGINA INICIAL
  ========================= */
  site_name: "JPBET",
  home_hero_label:
    "BEM-VINDO À JPBET",
  home_hero_title:
    "Sua diversão começa aqui.",
  home_hero_description:
    "Entre na JPBET e descubra uma experiência de jogos feita para você.",
  home_games_label:
    "ESCOLHA SUA DIVERSÃO",
  home_games_title:
    "Jogos",
  home_roulette_title:
    "Roleta",
  home_roulette_description:
    "Entre na mesa e teste sua sorte.",
  home_coming_title:
    "Novos jogos",
  home_coming_description:
    "Novidades serão adicionadas em breve.",
  home_about_label:
    "SOBRE A JPBET",
  home_about_title:
    "Uma nova experiência de jogos.",
  home_about_description:
    "A JPBET foi criada para oferecer uma experiência simples, moderna e agradável para quem gosta de jogos online.",
  home_cta_title:
    "Pronto para começar?",
  home_cta_description:
    "Entre na sua conta para continuar.",
  home_cta_button:
    "JOGAR AGORA",
  home_footer:
    "© 2026 JPBET. Todos os direitos reservados.",
  /* =========================
     IMAGEM DA PÁGINA INICIAL
  ========================= */
  home_hero_image:
    "assets/lamborghini.png",
  /* =========================
     BÔNUS DE CADASTRO
  ========================= */
  signup_bonus:
    "100"
};
/* =========================
   GARANTIR TABELA
========================= */
async function garantirTabelaConfiguracoes() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
}
/* =========================
   GARANTIR CONFIGURAÇÕES
========================= */
export async function garantirConfiguracoes() {
  await garantirTabelaConfiguracoes();
  for (
    const [key, value]
    of Object.entries(
      CONFIGURACOES_PADRAO
    )
  ) {
    await pool.query(
      `
      INSERT INTO settings (
        key,
        value
      )
      VALUES ($1, $2)
      ON CONFLICT (key)
      DO NOTHING
      `,
      [
        key,
        String(value)
      ]
    );
  }
}
/* =========================
   OBTER CONFIGURAÇÃO
========================= */
export async function obterConfiguracao(
  key,
  padrao = null
) {
  const result =
    await pool.query(
      `
      SELECT value
      FROM settings
      WHERE key = $1
      LIMIT 1
      `,
      [key]
    );
  if (
    result.rows.length === 0
  ) {
    return padrao;
  }
  return result.rows[0].value;
}
/* =========================
   OBTER TODAS
========================= */
export async function obterConfiguracoes() {
  const result =
    await pool.query(
      `
      SELECT
        key,
        value
      FROM settings
      ORDER BY key
      `
    );
  const configuracoes = {};
  for (
    const row
    of result.rows
  ) {
    configuracoes[row.key] =
      row.value;
  }
  return configuracoes;
}
/* =========================
   SALVAR CONFIGURAÇÃO
========================= */
export async function salvarConfiguracao(
  key,
  value
) {
  await pool.query(
    `
    INSERT INTO settings (
      key,
      value
    )
    VALUES ($1, $2)
    ON CONFLICT (key)
    DO UPDATE SET
      value = EXCLUDED.value
    `,
    [
      key,
      String(value ?? "")
    ]
  );
  return obterConfiguracao(
    key,
    ""
  );
}
/* =========================
   SALVAR VÁRIAS
========================= */
export async function salvarConfiguracoes(
  configuracoes = {}
) {
  for (
    const [key, value]
    of Object.entries(
      configuracoes
    )
  ) {
    await salvarConfiguracao(
      key,
      value
    );
  }
  return obterConfiguracoes();
}
/* =========================
   SEGMENTOS PADRÃO
========================= */
export function obterSegmentosPadrao() {
  return [
    {
      type: "prize",
      label: "2X",
      multiplier: 2
    },
    {
      type: "prize",
      label: "3X",
      multiplier: 3
    },
    {
      type: "prize",
      label: "5X",
      multiplier: 5
    },
    {
      type: "prize",
      label: "10X",
      multiplier: 10
    },
    {
      type: "lose",
      label: "PERDEU",
      multiplier: 0
    },
    {
      type: "lose",
      label: "PERDEU",
      multiplier: 0
    }
  ];
}

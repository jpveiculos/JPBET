const express = require("express");
const router = express.Router();

const pool = require("./db");

const {
  criarSessaoAdmin,
  validarSessaoAdmin,
  removerSessaoAdmin
} = require("./adminSession");

const COOKIE_NAME = "jpbet_admin_session";

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

/*
|--------------------------------------------------------------------------
| COOKIE
|--------------------------------------------------------------------------
*/

function enviarCookieAdmin(res, token) {
  const secure =
    process.env.NODE_ENV === "production"
      ? "; Secure"
      : "";

  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}`
  );
}

function obterCookieAdmin(req) {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const separador = cookie.indexOf("=");

    if (separador === -1) {
      continue;
    }

    const nome = cookie
      .substring(0, separador)
      .trim();

    const valor = cookie
      .substring(separador + 1)
      .trim();

    if (nome === COOKIE_NAME) {
      try {
        return decodeURIComponent(valor);
      } catch {
        return valor;
      }
    }
  }

  return null;
}

function expirarCookieAdmin(res) {
  const secure =
    process.env.NODE_ENV === "production"
      ? "; Secure"
      : "";

  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`
  );
}

/*
|--------------------------------------------------------------------------
| LOGIN DO ADMINISTRADOR
|--------------------------------------------------------------------------
*/

router.post("/admin-login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Usuário e senha são obrigatórios."
      });
    }

    const usuario = String(username).trim();
    const senha = String(password);

    let adminValido = false;
    let adminId = null;

    /*
     * Primeiro verifica a tabela admins.
     */
    try {
      const resultado = await pool.query(
        `SELECT id, username, password_hash
         FROM admins
         WHERE username = $1
         LIMIT 1`,
        [usuario]
      );

      if (resultado.rows.length > 0) {
        const admin = resultado.rows[0];

        if (
          String(admin.password_hash) === senha
        ) {
          adminValido = true;
          adminId = admin.id;
        }
      }
    } catch (error) {
      console.warn(
        "Tabela admins não pôde ser consultada:",
        error.message
      );
    }

    /*
     * Também permite administrador configurado
     * pelas variáveis de ambiente do Render.
     */
    if (
      !adminValido &&
      ADMIN_USER &&
      ADMIN_PASSWORD &&
      usuario === String(ADMIN_USER) &&
      senha === String(ADMIN_PASSWORD)
    ) {
      adminValido = true;
      adminId = "env-admin";
    }

    if (!adminValido) {
      return res.status(401).json({
        success: false,
        message: "Usuário ou senha de administrador inválidos."
      });
    }

    /*
     * Cria o token da sessão.
     */
    const token = criarSessaoAdmin({
      adminId,
      username: usuario
    });

    /*
     * Grava exatamente o cookie esperado pelo painel.
     */
    enviarCookieAdmin(res, token);

    return res.json({
      success: true,
      authenticated: true,
      message: "Login administrativo realizado com sucesso.",
      admin: {
        id: adminId,
        username: usuario
      }
    });

  } catch (error) {
    console.error(
      "Erro no login administrativo:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Erro interno ao realizar login administrativo."
    });
  }
});

/*
|--------------------------------------------------------------------------
| VERIFICAR SESSÃO DO ADMINISTRADOR
|--------------------------------------------------------------------------
*/

router.get("/admin-session", (req, res) => {
  try {
    const token = obterCookieAdmin(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        message: "Sessão administrativa não encontrada."
      });
    }

    const sessao = validarSessaoAdmin(token);

    if (!sessao) {
      expirarCookieAdmin(res);

      return res.status(401).json({
        success: false,
        authenticated: false,
        message: "Sessão administrativa inválida ou expirada."
      });
    }

    return res.json({
      success: true,
      authenticated: true,
      admin: {
        id: sessao.adminId,
        username: sessao.username
      }
    });

  } catch (error) {
    console.error(
      "Erro ao validar sessão administrativa:",
      error
    );

    expirarCookieAdmin(res);

    return res.status(401).json({
      success: false,
      authenticated: false,
      message: "Sessão administrativa inválida."
    });
  }
});

/*
|--------------------------------------------------------------------------
| LOGOUT DO ADMINISTRADOR
|--------------------------------------------------------------------------
*/

router.post("/admin-logout", (req, res) => {
  try {
    const token = obterCookieAdmin(req);

    if (token) {
      removerSessaoAdmin(token);
    }

    expirarCookieAdmin(res);

    return res.json({
      success: true,
      authenticated: false,
      message: "Logout administrativo realizado com sucesso."
    });

  } catch (error) {
    console.error(
      "Erro no logout administrativo:",
      error
    );

    expirarCookieAdmin(res);

    return res.json({
      success: true,
      authenticated: false,
      message: "Sessão administrativa encerrada."
    });
  }
});

module.exports = router;

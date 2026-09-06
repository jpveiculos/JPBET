const express = require("express");
const router = express.Router();

const pool = require("./db");
const {
  criarSessaoAdmin,
  removerSessaoAdmin
} = require("./adminSession");

/*
|--------------------------------------------------------------------------
| CONFIGURAÇÃO
|--------------------------------------------------------------------------
*/

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const COOKIE_NAME = "jpbet_admin_session";

/*
|--------------------------------------------------------------------------
| AUXILIARES
|--------------------------------------------------------------------------
*/

function enviarCookieAdmin(res, token) {
  const secure =
    process.env.NODE_ENV === "production"
      ? "; Secure"
      : "";

  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict${secure}`
  );
}

function obterCookieAdmin(req) {
  const cookies = req.headers.cookie;

  if (!cookies) {
    return null;
  }

  const partes = cookies.split(";");

  for (const parte of partes) {
    const [nome, ...resto] = parte.trim().split("=");

    if (nome === COOKIE_NAME) {
      return decodeURIComponent(resto.join("="));
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
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=0`
  );
}

/*
|--------------------------------------------------------------------------
| CADASTRO DE USUÁRIO
|--------------------------------------------------------------------------
*/

router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Usuário e senha são obrigatórios."
      });
    }

    const usuario = String(username).trim();

    if (usuario.length < 3) {
      return res.status(400).json({
        success: false,
        message: "O usuário deve possuir pelo menos 3 caracteres."
      });
    }

    if (String(password).length < 4) {
      return res.status(400).json({
        success: false,
        message: "A senha deve possuir pelo menos 4 caracteres."
      });
    }

    const existente = await pool.query(
      "SELECT id FROM users WHERE username = $1 LIMIT 1",
      [usuario]
    );

    if (existente.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Usuário já cadastrado."
      });
    }

    const resultado = await pool.query(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       RETURNING id, username`,
      [usuario, password]
    );

    return res.status(201).json({
      success: true,
      message: "Usuário cadastrado com sucesso.",
      user: resultado.rows[0]
    });

  } catch (error) {
    console.error("Erro no registro:", error);

    return res.status(500).json({
      success: false,
      message: "Erro interno ao cadastrar usuário."
    });
  }
});

/*
|--------------------------------------------------------------------------
| LOGIN DE USUÁRIO
|--------------------------------------------------------------------------
*/

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Usuário e senha são obrigatórios."
      });
    }

    const usuario = String(username).trim();

    const resultado = await pool.query(
      `SELECT id, username, password_hash
       FROM users
       WHERE username = $1
       LIMIT 1`,
      [usuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Usuário ou senha inválidos."
      });
    }

    const user = resultado.rows[0];

    if (String(user.password_hash) !== String(password)) {
      return res.status(401).json({
        success: false,
        message: "Usuário ou senha inválidos."
      });
    }

    return res.json({
      success: true,
      message: "Login realizado com sucesso.",
      user: {
        id: user.id,
        username: user.username
      }
    });

  } catch (error) {
    console.error("Erro no login:", error);

    return res.status(500).json({
      success: false,
      message: "Erro interno ao realizar login."
    });
  }
});

/*
|--------------------------------------------------------------------------
| LOGIN DO ADMINISTRADOR
|--------------------------------------------------------------------------
*/

router.post("/admin-login", async (req, res) => {
  try {
    const { username, password } = req.body;

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
     * Primeiro tenta verificar o administrador cadastrado
     * na tabela admins.
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
    } catch (dbError) {
      /*
       * Caso a tabela admins ainda não exista,
       * continua verificando as variáveis de ambiente.
       */
      console.warn(
        "Não foi possível consultar a tabela admins:",
        dbError.message
      );
    }

    /*
     * Administrador definido nas variáveis de ambiente.
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
        message: "Credenciais de administrador inválidas."
      });
    }

    /*
     * Cria a sessão administrativa.
     */
    const token = await criarSessaoAdmin({
      adminId,
      username: usuario
    });

    /*
     * IMPORTANTE:
     * O cookie precisa ser exatamente jpbet_admin_session.
     */
    enviarCookieAdmin(res, token);

    return res.json({
      success: true,
      message: "Login administrativo realizado com sucesso.",
      admin: {
        id: adminId,
        username: usuario
      }
    });

  } catch (error) {
    console.error("Erro no login administrativo:", error);

    return res.status(500).json({
      success: false,
      message: "Erro interno ao realizar login administrativo."
    });
  }
});

/*
|--------------------------------------------------------------------------
| VERIFICAR SESSÃO DO ADMIN
|--------------------------------------------------------------------------
*/

router.get("/admin-session", async (req, res) => {
  try {
    const token = obterCookieAdmin(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        message: "Sessão administrativa não encontrada."
      });
    }

    /*
     * A validação da sessão fica centralizada
     * no adminSession.js.
     */
    const sessao = await criarSessaoAdmin.validar
      ? await criarSessaoAdmin.validar(token)
      : null;

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
      admin: sessao
    });

  } catch (error) {
    console.error("Erro ao verificar sessão administrativa:", error);

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

router.post("/admin-logout", async (req, res) => {
  try {
    const token = obterCookieAdmin(req);

    if (token) {
      await removerSessaoAdmin(token);
    }

    expirarCookieAdmin(res);

    return res.json({
      success: true,
      message: "Logout administrativo realizado com sucesso."
    });

  } catch (error) {
    console.error("Erro no logout administrativo:", error);

    expirarCookieAdmin(res);

    return res.json({
      success: true,
      message: "Sessão administrativa encerrada."
    });
  }
});

/*
|--------------------------------------------------------------------------
| EXPORTAÇÃO
|--------------------------------------------------------------------------
*/

module.exports = router;

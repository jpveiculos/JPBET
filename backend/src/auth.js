import express from “express”;
import crypto from “crypto”;

import { pool } from “./db.js”;

import {
obterConfiguracao
} from “./settings.js”;

import {
criarSessaoAdmin,
validarSessaoAdmin,
removerSessaoAdmin
} from “./adminSession.js”;

const router = express.Router();

const COOKIE_NAME =
“jpbet_admin_session”;

const ADMIN_USER =
process.env.ADMIN_USER;

const ADMIN_PASSWORD =
process.env.ADMIN_PASSWORD;

/* =========================================================
SESSÕES DOS JOGADORES
========================================================= */

const playerSessions = new Map();

const PLAYER_SESSION_TTL =
1000 * 60 * 60 * 24 * 7;

function criarTokenJogador() {
return crypto
.randomBytes(32)
.toString(“hex”);
}

function criarSessaoJogador(userId) {

const token =
criarTokenJogador();

playerSessions.set(token, {
userId: Number(userId),

expiresAt:
  Date.now() +
  PLAYER_SESSION_TTL

});

return token;
}

function obterSessaoJogador(token) {

if (!token) {
return null;
}

const sessao =
playerSessions.get(token);

if (!sessao) {
return null;
}

if (
sessao.expiresAt <=
Date.now()
) {

playerSessions.delete(
  token
);
return null;

}

return sessao;
}

function obterTokenBearer(req) {

const header =
String(
req.headers.authorization ||
“”
);

if (
!header
.toLowerCase()
.startsWith(“bearer “)
) {
return null;
}

const token =
header
.substring(7)
.trim();

return token || null;
}

/* =========================================================
SENHAS
========================================================= */

function hashPassword(password) {

return new Promise(
(resolve, reject) => {

  const salt =
    crypto
      .randomBytes(16)
      .toString("hex");
  crypto.scrypt(
    String(password),
    salt,
    64,
    (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(
        `scrypt:${salt}:${derivedKey.toString(
          "hex"
        )}`
      );
    }
  );
}

);
}

function verificarPassword(
password,
storedPassword
) {

const stored =
String(
storedPassword || “”
);

if (
stored.startsWith(
“scrypt:”
)
) {

const partes =
  stored.split(":");
if (
  partes.length !== 3
) {
  return false;
}
const salt =
  partes[1];
const expectedHex =
  partes[2];
try {
  const expected =
    Buffer.from(
      expectedHex,
      "hex"
    );
  const derived =
    crypto.scryptSync(
      String(password),
      salt,
      expected.length
    );
  if (
    derived.length !==
    expected.length
  ) {
    return false;
  }
  return crypto.timingSafeEqual(
    derived,
    expected
  );
} catch {
  return false;
}

}

/*
Compatibilidade com contas
antigas que ainda tenham a
senha armazenada em texto simples.
*/

return (
String(password) ===
stored
);
}

/* =========================================================
CONVERTER VALOR
========================================================= */

function converterValorMonetario(
valor,
padrao = 0
) {

const numero =
Number(valor);

if (
!Number.isFinite(numero)
) {
return Number(padrao);
}

return numero;
}

/* =========================================================
MONTAR USUÁRIO
========================================================= */

function montarUsuario(user) {

return {

id:
  user.id,
username:
  user.username,
balance:
  converterValorMonetario(
    user.balance
  ),
bonusBalance:
  converterValorMonetario(
    user.bonus_balance
  ),
cashBalance:
  converterValorMonetario(
    user.cash_balance
  ),
reservedBalance:
  converterValorMonetario(
    user.reserved_balance
  ),
bonusWagerProgress:
  converterValorMonetario(
    user.bonus_wager_progress
  ),
rouletteFreeSpins:
  Number(
    user.roulette_free_spins || 0
  ),
rouletteFreeSpinBet:
  converterValorMonetario(
    user.roulette_free_spin_bet
  ),
createdAt:
  user.created_at

};
}

/* =========================================================
BUSCAR USUÁRIO
========================================================= */

async function buscarUsuarioPorId(id) {

const result =
await pool.query(
SELECT id, username, password_hash, balance, bonus_balance, cash_balance, reserved_balance, bonus_wager_progress, roulette_free_spins, roulette_free_spin_bet, created_at FROM users WHERE id = $1 LIMIT 1,
[id]
);

return (
result.rows[0] ||
null
);
}

/* =========================================================
BÔNUS DE CADASTRO
========================================================= */

async function obterBonusCadastro() {

try {

const configuracao =
  await obterConfiguracao(
    "signup_bonus",
    "100"
  );
const valor =
  Number(
    String(
      configuracao ?? "100"
    ).replace(",", ".")
  );
if (
  !Number.isFinite(valor) ||
  valor < 0
) {
  return 100;
}
return valor;

} catch (error) {

console.error(
  "Erro ao obter bônus de cadastro:",
  error
);
return 100;

}
}

/* =========================================================
HEALTH
========================================================= */

router.get(
“/health”,
async (req, res) => {

try {
  await pool.query(
    "SELECT 1"
  );
  return res.json({
    ok: true,
    service: "auth"
  });
} catch (error) {
  console.error(
    "Erro no health da autenticação:",
    error
  );
  return res.status(500).json({
    ok: false,
    service: "auth"
  });
}

}
);

/* =========================================================
CADASTRO DE JOGADOR
========================================================= */

router.post(
“/register”,
async (req, res) => {

try {
  const username =
    String(
      req.body?.username ||
      ""
    ).trim();
  const password =
    String(
      req.body?.password ||
      ""
    );
  if (
    !username ||
    !password
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Usuário e senha são obrigatórios."
    });
  }
  if (
    username.length < 3
  ) {
    return res.status(400).json({
      success: false,
      message:
        "O usuário deve ter pelo menos 3 caracteres."
    });
  }
  if (
    username.length > 50
  ) {
    return res.status(400).json({
      success: false,
      message:
        "O usuário deve ter no máximo 50 caracteres."
    });
  }
  if (
    !/^[a-zA-Z0-9_.-]+$/.test(
      username
    )
  ) {
    return res.status(400).json({
      success: false,
      message:
        "O usuário pode conter apenas letras, números, ponto, hífen e sublinhado."
    });
  }
  if (
    password.length < 4
  ) {
    return res.status(400).json({
      success: false,
      message:
        "A senha deve ter pelo menos 4 caracteres."
    });
  }
  if (
    password.length > 200
  ) {
    return res.status(400).json({
      success: false,
      message:
        "A senha é muito longa."
    });
  }
  const existente =
    await pool.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(username) =
            LOWER($1)
      LIMIT 1
      `,
      [username]
    );
  if (
    existente.rows.length > 0
  ) {
    return res.status(409).json({
      success: false,
      message:
        "Este usuário já está cadastrado."
    });
  }
  const passwordHash =
    await hashPassword(
      password
    );
  /*
    O bônus vem das configurações
    do sistema.
    Caso ainda não exista uma
    configuração signup_bonus,
    o padrão será R$100,00.
  */
  const bonusCadastro =
    await obterBonusCadastro();
  const result =
    await pool.query(
      `
      INSERT INTO users
        (
          username,
          password_hash,
          balance,
          bonus_balance,
          cash_balance,
          reserved_balance,
          bonus_wager_progress
        )
      VALUES
        (
          $1,
          $2,
          0,
          $3,
          0,
          0,
          0
        )
      RETURNING
        id,
        username,
        balance,
        bonus_balance,
        cash_balance,
        reserved_balance,
        bonus_wager_progress,
        roulette_free_spins,
        roulette_free_spin_bet,
        created_at
      `,
      [
        username,
        passwordHash,
        bonusCadastro
      ]
    );
  const user =
    montarUsuario(
      result.rows[0]
    );
  const token =
    criarSessaoJogador(
      user.id
    );
  return res.status(201).json({
    success: true,
    message:
      "Conta criada com sucesso.",
    token,
    user,
    redirect:
      "dashboard.html"
  });
} catch (error) {
  console.error(
    "Erro no cadastro de jogador:",
    error
  );
  if (
    error?.code ===
    "23505"
  ) {
    return res.status(409).json({
      success: false,
      message:
        "Este usuário já está cadastrado."
    });
  }
  return res.status(500).json({
    success: false,
    message:
      "Erro interno ao criar a conta."
  });
}

}
);

/* =========================================================
LOGIN DE JOGADOR
========================================================= */

router.post(
“/login”,
async (req, res) => {

try {
  const username =
    String(
      req.body?.username ||
      ""
    ).trim();
  const password =
    String(
      req.body?.password ||
      ""
    );
  if (
    !username ||
    !password
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Digite usuário e senha."
    });
  }
  const result =
    await pool.query(
      `
      SELECT
        id,
        username,
        password_hash,
        balance,
        bonus_balance,
        cash_balance,
        reserved_balance,
        bonus_wager_progress,
        roulette_free_spins,
        roulette_free_spin_bet,
        created_at
      FROM users
      WHERE LOWER(username) =
            LOWER($1)
      LIMIT 1
      `,
      [username]
    );
  if (
    result.rows.length === 0
  ) {
    return res.status(401).json({
      success: false,
      message:
        "Usuário ou senha inválidos."
    });
  }
  const userRow =
    result.rows[0];
  const senhaValida =
    verificarPassword(
      password,
      userRow.password_hash
    );
  if (!senhaValida) {
    return res.status(401).json({
      success: false,
      message:
        "Usuário ou senha inválidos."
    });
  }
  /*
    Se for uma conta antiga com
    senha em texto simples,
    converte automaticamente para
    o formato seguro na primeira entrada.
  */
  if (
    !String(
      userRow.password_hash ||
      ""
    ).startsWith(
      "scrypt:"
    )
  ) {
    const novoHash =
      await hashPassword(
        password
      );
    await pool.query(
      `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2
      `,
      [
        novoHash,
        userRow.id
      ]
    );
  }
  /*
    Contas antigas podem não possuir
    bônus. Não altera automaticamente
    contas existentes aqui.
  */
  const user =
    montarUsuario(
      userRow
    );
  const token =
    criarSessaoJogador(
      user.id
    );
  return res.json({
    success: true,
    message:
      "Login realizado com sucesso.",
    token,
    user,
    redirect:
      "dashboard.html"
  });
} catch (error) {
  console.error(
    "Erro no login de jogador:",
    error
  );
  return res.status(500).json({
    success: false,
    message:
      "Erro interno ao realizar login."
  });
}

}
);

/* =========================================================
USUÁRIO LOGADO
========================================================= */

router.get(
“/me”,
async (req, res) => {

try {
  const token =
    obterTokenBearer(req);
  const sessao =
    obterSessaoJogador(
      token
    );
  if (!sessao) {
    return res.status(401).json({
      success: false,
      message:
        "Sessão do usuário inválida ou expirada."
    });
  }
  const user =
    await buscarUsuarioPorId(
      sessao.userId
    );
  if (!user) {
    playerSessions.delete(
      token
    );
    return res.status(401).json({
      success: false,
      message:
        "Usuário não encontrado."
    });
  }
  return res.json({
    success: true,
    user:
      montarUsuario(
        user
      )
  });
} catch (error) {
  console.error(
    "Erro ao consultar usuário logado:",
    error
  );
  return res.status(500).json({
    success: false,
    message:
      "Erro interno ao consultar a conta."
  });
}

}
);

/* =========================================================
LOGOUT DE JOGADOR
========================================================= */

router.post(
“/logout”,
(req, res) => {

const token =
  obterTokenBearer(req);
if (token) {
  playerSessions.delete(
    token
  );
}
return res.json({
  success: true,
  authenticated: false
});

}
);

/* =========================================================
COOKIE ADMINISTRATIVO
========================================================= */

function obterCookie(req) {

const cookies =
req.headers.cookie ||
“”;

const partes =
cookies.split(”;”);

for (
const parte of partes
) {

const separador =
  parte.indexOf("=");
if (
  separador === -1
) {
  continue;
}
const nome =
  parte
    .substring(
      0,
      separador
    )
    .trim();
const valor =
  parte
    .substring(
      separador + 1
    )
    .trim();
if (
  nome === COOKIE_NAME
) {
  try {
    return decodeURIComponent(
      valor
    );
  } catch {
    return valor;
  }
}

}

return null;
}

function criarCookie(token) {

const secure =
process.env.NODE_ENV ===
“production”
? “; Secure”
: “”;

return (
${COOKIE_NAME}=${encodeURIComponent( token )} +
; Path=/ +
; HttpOnly +
; SameSite=Lax +
secure
);
}

function expirarCookie() {

const secure =
process.env.NODE_ENV ===
“production”
? “; Secure”
: “”;

return (
${COOKIE_NAME}= +
; Path=/ +
; HttpOnly +
; SameSite=Lax +
secure +
; Max-Age=0
);
}

/* =========================================================
LOGIN ADMIN
========================================================= */

router.post(
“/admin-login”,
async (req, res) => {

try {
  const username =
    String(
      req.body?.username ||
      ""
    ).trim();
  const password =
    String(
      req.body?.password ||
      ""
    );
  if (
    !username ||
    !password
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Usuário e senha são obrigatórios."
    });
  }
  if (
    !ADMIN_USER ||
    !ADMIN_PASSWORD
  ) {
    console.error(
      "ADMIN_USER ou ADMIN_PASSWORD não configurados no ambiente."
    );
    return res.status(500).json({
      success: false,
      message:
        "Credenciais administrativas não configuradas no servidor."
    });
  }
  if (
    username !==
      String(ADMIN_USER) ||
    password !==
      String(ADMIN_PASSWORD)
  ) {
    return res.status(401).json({
      success: false,
      message:
        "Usuário ou senha de administrador inválidos."
    });
  }
  const token =
    criarSessaoAdmin({
      adminId:
        "env-admin",
      username
    });
  res.setHeader(
    "Set-Cookie",
    criarCookie(token)
  );
  return res.json({
    success: true,
    authenticated:
      true,
    admin: {
      id:
        "env-admin",
      username
    },
    message:
      "Login administrativo realizado com sucesso."
  });
} catch (error) {
  console.error(
    "Erro no login administrativo:",
    error
  );
  return res.status(500).json({
    success: false,
    message:
      "Erro interno ao realizar login administrativo."
  });
}

}
);

/* =========================================================
VERIFICAR SESSÃO ADMIN
========================================================= */

router.get(
“/admin-session”,
(req, res) => {

try {
  const token =
    obterCookie(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      message:
        "Sessão administrativa não encontrada."
    });
  }
  const sessao =
    validarSessaoAdmin(
      token
    );
  if (!sessao) {
    res.setHeader(
      "Set-Cookie",
      expirarCookie()
    );
    return res.status(401).json({
      success: false,
      authenticated: false,
      message:
        "Sessão administrativa inválida ou expirada."
    });
  }
  return res.json({
    success: true,
    authenticated:
      true,
    admin: {
      id:
        sessao.adminId,
      username:
        sessao.username
    }
  });
} catch (error) {
  console.error(
    "Erro ao verificar sessão:",
    error
  );
  res.setHeader(
    "Set-Cookie",
    expirarCookie()
  );
  return res.status(401).json({
    success: false,
    authenticated: false,
    message:
      "Sessão administrativa inválida."
  });
}

}
);

/* =========================================================
LOGOUT ADMIN
========================================================= */

router.post(
“/admin-logout”,
(req, res) => {

try {
  const token =
    obterCookie(req);
  if (token) {
    removerSessaoAdmin(
      token
    );
  }
  res.setHeader(
    "Set-Cookie",
    expirarCookie()
  );
  return res.json({
    success: true,
    authenticated: false,
    message:
      "Logout administrativo realizado com sucesso."
  });
} catch (error) {
  console.error(
    "Erro no logout:",
    error
  );
  res.setHeader(
    "Set-Cookie",
    expirarCookie()
  );
  return res.json({
    success: true,
    authenticated: false
  });
}

}
);

export default router;

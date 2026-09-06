const crypto = require("crypto");

const sessoes = new Map();

const TEMPO_SESSAO = 1000 * 60 * 60 * 24; // 24 horas

/*
|--------------------------------------------------------------------------
| CRIAR SESSÃO DO ADMINISTRADOR
|--------------------------------------------------------------------------
*/

function criarSessaoAdmin(dadosAdmin) {
  const token = crypto.randomBytes(32).toString("hex");

  let username;
  let adminId = null;

  if (typeof dadosAdmin === "string") {
    username = dadosAdmin;
  } else if (dadosAdmin && typeof dadosAdmin === "object") {
    username = dadosAdmin.username;
    adminId = dadosAdmin.adminId ?? dadosAdmin.id ?? null;
  }

  if (!username) {
    throw new Error("Username do administrador não informado.");
  }

  sessoes.set(token, {
    adminId,
    username,
    criadoEm: Date.now(),
    expiraEm: Date.now() + TEMPO_SESSAO
  });

  return token;
}

/*
|--------------------------------------------------------------------------
| VALIDAR SESSÃO DO ADMINISTRADOR
|--------------------------------------------------------------------------
*/

function validarSessaoAdmin(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const sessao = sessoes.get(token);

  if (!sessao) {
    return null;
  }

  if (
    !sessao.expiraEm ||
    Date.now() > sessao.expiraEm
  ) {
    sessoes.delete(token);
    return null;
  }

  return {
    adminId: sessao.adminId,
    username: sessao.username,
    criadoEm: sessao.criadoEm,
    expiraEm: sessao.expiraEm
  };
}

/*
|--------------------------------------------------------------------------
| REMOVER SESSÃO
|--------------------------------------------------------------------------
*/

function removerSessaoAdmin(token) {
  if (!token || typeof token !== "string") {
    return false;
  }

  return sessoes.delete(token);
}

/*
|--------------------------------------------------------------------------
| EXPORTAÇÃO
|--------------------------------------------------------------------------
*/

module.exports = {
  criarSessaoAdmin,
  validarSessaoAdmin,
  removerSessaoAdmin
};

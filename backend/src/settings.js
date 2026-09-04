function exigirAdmin(req, res, next) {
  const cookies = req.headers.cookie || "";
  const cookiesMap = {};
  cookies.split(";").forEach((cookie) => {
    const partes = cookie.trim().split("=");
    if (partes.length >= 2) {
      const nome = partes.shift();
      const valor = partes.join("=");
      cookiesMap[nome] = decodeURIComponent(valor);
    }
  });
  const token = cookiesMap.jpbet_admin_session || null;
  const sessao = validarSessaoAdmin(token);
  if (!sessao) {
    return res.status(401).json({
      ok: false,
      message: "Acesso administrativo necessário."
    });
  }
  req.admin = sessao;
  next();
}

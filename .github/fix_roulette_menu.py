from pathlib import Path
p = Path('backend/frontend/roulette207.html')
s = p.read_text()
marker = 'Menu do site'
pos = s.find(marker)
if pos < 0:
    raise SystemExit('Menu do site não encontrado')
start = s.rfind('<button', 0, pos)
end = s.find('</button>', pos)
if start < 0 or end < 0:
    raise SystemExit('Botão do menu não encontrado')
end += len('</button>')
block = s[start:end]
if "location.href='/'" not in block:
    raise SystemExit('Destino atual do menu não encontrado')
block = block.replace("location.href='/'", 'openSiteMenu()', 1)
s = s[:start] + block + s[end:]
if 'id="siteMenuOverlay"' not in s:
    addition = '''\n<div id="siteMenuOverlay" style="display:none;position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.78);align-items:stretch;justify-content:flex-end;">\n  <aside style="width:min(340px,88%);height:100%;padding:20px;background:linear-gradient(180deg,#0b121b,#070c13);border-left:1px solid rgba(255,255,255,.1);box-shadow:-12px 0 35px rgba(0,0,0,.45);">\n    <button type="button" onclick="closeSiteMenu()" style="float:right;border:0;background:#111925;color:#fff;width:44px;height:44px;border-radius:13px;font-size:28px;">×</button>\n    <h2 style="margin-top:55px;color:#ffd83d;">Menu do site</h2>\n    <button type="button" onclick="location.href='/'" style="width:100%;margin-top:10px;padding:14px;border:1px solid rgba(255,255,255,.1);border-radius:13px;background:#111923;color:#fff;text-align:left;font-weight:800;">🏠 Início</button>\n    <button type="button" onclick="location.href='/dashboard.html'" style="width:100%;margin-top:10px;padding:14px;border:1px solid rgba(255,255,255,.1);border-radius:13px;background:#111923;color:#fff;text-align:left;font-weight:800;">👤 Área do jogador</button>\n    <button type="button" onclick="closeSiteMenu()" style="width:100%;margin-top:10px;padding:14px;border:1px solid rgba(255,255,255,.1);border-radius:13px;background:#111923;color:#fff;text-align:left;font-weight:800;">✕ Fechar menu</button>\n  </aside>\n</div>\n<script>\nfunction openSiteMenu(){document.getElementById('siteMenuOverlay').style.display='flex'}\nfunction closeSiteMenu(){document.getElementById('siteMenuOverlay').style.display='none'}\ndocument.getElementById('siteMenuOverlay')?.addEventListener('click',function(e){if(e.target===this)closeSiteMenu()});\n</script>\n'''
    s = s.replace('</body>', addition + '</body>', 1)
p.write_text(s)
Path('backend/frontend/roulette-menu-trigger.txt').unlink(missing_ok=True)
Path('.github/workflows/fix-menu-roulette.yml').unlink(missing_ok=True)
Path('.github/fix_roulette_menu.py').unlink(missing_ok=True)

from pathlib import Path
p=Path('backend/frontend/dashboard.html')
s=p.read_text(encoding='utf-8')
s=s.replace('const peso = Number(item?.probability ?? 0);','const peso = String(item || "").trim() !== "" ? 15 : 5;',1)
p.write_text(s,encoding='utf-8')
Path(__file__).unlink()

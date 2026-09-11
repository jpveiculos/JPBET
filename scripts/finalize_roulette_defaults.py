from pathlib import Path

for name in ['backend/src/server.js','backend/src/settings.js','backend/frontend/admin-settings-roleta-editavel.html']:
    p=Path(name)
    s=p.read_text(encoding='utf-8')
    s=s.replace('multiplier:5,probability:5','multiplier:3,probability:15')
    s=s.replace('multiplier: 5, probability: 5','multiplier: 3, probability: 15')
    s=s.replace('multiplier:2,probability:5','multiplier:2,probability:15')
    s=s.replace('multiplier: 2, probability: 5','multiplier: 2, probability: 15')
    s=s.replace('multiplier:3,probability:5','multiplier:3,probability:15')
    s=s.replace('multiplier: 3, probability: 5','multiplier: 3, probability: 15')
    s=s.replace('A roleta precisa ter exatamente 20 fatias.','A roleta precisa ter exatamente 16 fatias.')
    p.write_text(s,encoding='utf-8')
Path(__file__).unlink()

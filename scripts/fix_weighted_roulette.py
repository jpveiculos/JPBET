from pathlib import Path
import re

# Dashboard labels.
p = Path('backend/frontend/dashboard.html')
s = p.read_text(encoding='utf-8')
s = re.sub(r'segments:\s*\[.*?\n\s*\]', '''segments: [
              "2X", "", "", "",
              "3X", "", "", "",
              "2X", "", "", "",
              "3X", "", "", ""
          ]''', s, count=1, flags=re.S)
s = s.replace('Prêmios: 2×, 3× e 5×', 'Prêmios: 2×, 3×, 2× e 3×')

# Append a visual override before the first closing script tag.
override = r'''<script>
function obterGeometriaRoletaPesada(segmentos) {
    const pesos = segmentos.map(item => {
        const peso = Number(item?.probability ?? 0);
        return Number.isFinite(peso) && peso > 0 ? peso : 0;
    });
    let total = pesos.reduce((sum, peso) => sum + peso, 0);
    if (!(total > 0)) { total = segmentos.length; pesos.fill(1); }
    let cursor = 0;
    return segmentos.map((item, index) => {
        const startDeg = cursor;
        const endDeg = index === segmentos.length - 1 ? 360 : cursor + (pesos[index] / total) * 360;
        cursor = endDeg;
        return { startDeg, endDeg, centerDeg: startDeg + (endDeg - startDeg) / 2 };
    });
}

criarRoda = function() {
    const wheel = document.getElementById('wheel');
    const svg = document.getElementById('rouletteSvg');
    if (!wheel || !svg) return;
    const roleta = ROLETAS[roletaAtual] || ROLETAS.sorte;
    const segmentos = Array.isArray(roleta.segments) ? roleta.segments : [];
    if (segmentos.length !== 16) return;
    svg.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';
    const cx = 250, cy = 250, radius = 238;
    const geometria = obterGeometriaRoletaPesada(segmentos);
    segmentos.forEach((label, index) => {
        const setor = geometria[index];
        const premio = String(label || '').trim() !== '';
        const group = document.createElementNS(ns, 'g');
        group.setAttribute('data-index', String(index));
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', sectorPath(cx, cy, radius, setor.startDeg, setor.endDeg));
        path.setAttribute('fill', premio ? '#080808' : '#c99724');
        path.setAttribute('stroke', 'none');
        group.appendChild(path);
        if (premio) {
            const pos = polar(cx, cy, 150, setor.centerDeg);
            const text = document.createElementNS(ns, 'text');
            text.textContent = String(label).toUpperCase();
            text.setAttribute('x', pos.x);
            text.setAttribute('y', pos.y);
            text.setAttribute('class', 'roulette-label multiplier');
            text.setAttribute('font-size', '52');
            text.setAttribute('fill', '#25e66b');
            text.style.fill = '#25e66b';
            text.dataset.x = String(pos.x);
            text.dataset.y = String(pos.y);
            text.setAttribute('transform', `rotate(0 ${pos.x} ${pos.y})`);
            group.appendChild(text);
        }
        svg.appendChild(group);
    });
    const ring = document.createElementNS(ns, 'circle');
    ring.setAttribute('cx', cx); ring.setAttribute('cy', cy); ring.setAttribute('r', radius);
    ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#a66f08'); ring.setAttribute('stroke-width', '11');
    svg.appendChild(ring);
    const highlight = document.createElementNS(ns, 'circle');
    highlight.setAttribute('cx', cx); highlight.setAttribute('cy', cy); highlight.setAttribute('r', radius - 7);
    highlight.setAttribute('fill', 'none'); highlight.setAttribute('stroke', '#f5d66a'); highlight.setAttribute('stroke-width', '2');
    svg.appendChild(highlight);
    wheel.style.transition = 'none';
    wheel.style.transform = 'rotate(0deg)';
    roletaRotacaoAtual = 0;
};

animarRoleta = function(indiceResultado) {
    return new Promise(resolve => {
        const wheel = document.getElementById('wheel');
        const visualIndex = Number(indiceResultado);
        const roleta = ROLETAS[roletaAtual] || ROLETAS.sorte;
        const segmentos = Array.isArray(roleta.segments) ? roleta.segments : [];
        const geometria = obterGeometriaRoletaPesada(segmentos);
        if (!wheel || !Number.isInteger(visualIndex) || visualIndex < 0 || visualIndex >= geometria.length) { resolve(); return; }
        const centro = geometria[visualIndex].centerDeg;
        const alvo = -centro;
        const atual = Number(roletaRotacaoAtual) || 0;
        const moduloAlvo = ((alvo % 360) + 360) % 360;
        const moduloAtual = ((atual % 360) + 360) % 360;
        let ajuste = moduloAlvo - moduloAtual;
        if (ajuste < 0) ajuste += 360;
        const destino = atual + 4 * 360 + ajuste;
        const duracao = Math.max(1400, Number(configuracoes.roulette_animation_ms) || 1800);
        wheel.style.transition = 'none';
        wheel.style.transform = `rotate(${atual}deg)`;
        manterNumerosRetos(atual);
        requestAnimationFrame(() => {
            const inicio = performance.now();
            function animar(agora) {
                const progresso = Math.min(1, (agora - inicio) / duracao);
                const ease = 1 - Math.pow(1 - progresso, 3);
                const rotacao = atual + (destino - atual) * ease;
                wheel.style.transform = `rotate(${rotacao}deg)`;
                manterNumerosRetos(rotacao);
                if (progresso < 1) return requestAnimationFrame(animar);
                roletaRotacaoAtual = destino;
                wheel.style.transform = `rotate(${destino}deg)`;
                manterNumerosRetos(destino);
                resolve();
            }
            requestAnimationFrame(animar);
        });
        tocarSom('click');
    });
};
</script>'''
s = s.replace('</script>', override + '\n</script>', 1)
p.write_text(s, encoding='utf-8')

# Defaults and labels in backend/admin.
for name in ['backend/src/server.js', 'backend/src/settings.js', 'backend/frontend/admin-settings-roleta-editavel.html']:
    p = Path(name)
    s = p.read_text(encoding='utf-8')
    s = s.replace('5x', '3x').replace('5X', '3X')
    s = s.replace('multiplier: 2, probability: 5', 'multiplier: 2, probability: 15')
    s = s.replace('multiplier: 3, probability: 5', 'multiplier: 3, probability: 15')
    s = s.replace('multiplier: 5, probability: 5', 'multiplier: 3, probability: 15')
    p.write_text(s, encoding='utf-8')

# One-time conversion of the currently saved 5x configuration.
p = Path('backend/src/settings.js')
s = p.read_text(encoding='utf-8')
old = """        if (segmentos[8] && String(segmentos[8].type || '').toLowerCase() === 'prize' && Number(segmentos[8].multiplier) === 4) {\n          segmentos[8] = {...segmentos[8], label:'2x', multiplier:2};\n        }"""
new = """        const premio5x = segmentos.find(item => String(item?.type || '').toLowerCase() === 'prize' && Number(item?.multiplier) === 5);\n        if (premio5x) {\n          premio5x.label = '3x';\n          premio5x.multiplier = 3;\n          segmentos.forEach(item => { item.probability = String(item?.type || '').toLowerCase() === 'prize' ? 15 : 5; });\n        }"""
if old not in s:
    raise SystemExit('Migração esperada não encontrada em settings.js')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# Remove this helper before the workflow commits.
Path(__file__).unlink()

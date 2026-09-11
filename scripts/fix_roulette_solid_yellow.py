from pathlib import Path
import re

path = Path('backend/frontend/dashboard.html')
text = path.read_text(encoding='utf-8')

new_script = """<script>
function obterGeometriaRoletaPesada(segmentos) {
    const pesos = segmentos.map(item => String(item || '').trim() !== '' ? 3 : 1);
    const total = pesos.reduce((sum, peso) => sum + peso, 0) || 1;
    let cursor = 0;
    return segmentos.map((item, index) => {
        const startDeg = cursor;
        const endDeg = index === segmentos.length - 1 ? 360 : cursor + (pesos[index] / total) * 360;
        cursor = endDeg;
        return { startDeg, endDeg, centerDeg: startDeg + (endDeg - startDeg) / 2 };
    });
}

function agruparSetoresAmarelos(segmentos, geometria) {
    const grupos = [];
    let grupo = null;
    segmentos.forEach((label, index) => {
        const premio = String(label || '').trim() !== '';
        if (premio) { grupo = null; return; }
        if (!grupo) {
            grupo = { startDeg: geometria[index].startDeg, endDeg: geometria[index].endDeg };
            grupos.push(grupo);
        } else {
            grupo.endDeg = geometria[index].endDeg;
        }
    });
    return grupos;
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

    agruparSetoresAmarelos(segmentos, geometria).forEach(setor => {
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', sectorPath(cx, cy, radius, setor.startDeg, setor.endDeg));
        path.setAttribute('fill', '#c99724');
        path.setAttribute('stroke', 'none');
        svg.appendChild(path);
    });

    segmentos.forEach((label, index) => {
        if (String(label || '').trim() === '') return;
        const setor = geometria[index];
        const group = document.createElementNS(ns, 'g');
        group.setAttribute('data-index', String(index));
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', sectorPath(cx, cy, radius, setor.startDeg, setor.endDeg));
        path.setAttribute('fill', '#050505');
        path.setAttribute('stroke', 'none');
        group.appendChild(path);

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
        group.appendChild(text);
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
</script>"""

pattern = re.compile(r'\n<script>\nfunction obterGeometriaRoletaPesada[\s\S]*?\n</script>\n</script>')
if not pattern.search(text):
    raise SystemExit('Bloco da roleta não encontrado.')

text = pattern.sub('\n' + new_script, text, count=1)
path.write_text(text, encoding='utf-8')
print('Roleta corrigida: prêmios com 3x o ângulo e amarelos agrupados sem divisões.')

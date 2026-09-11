from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')


def write(rel, text):
    (ROOT / rel).write_text(text, encoding='utf-8')

# ---------------- settings.js ----------------
path = 'backend/src/settings.js'
s = read(path)
segments16 = '''const segmentosRoletaPadrao = [
  {label:"2x",type:"prize",multiplier:2,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"3x",type:"prize",multiplier:3,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"2x",type:"prize",multiplier:2,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"5x",type:"prize",multiplier:5,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5}
];'''
s = re.sub(r'const segmentosRoletaPadrao = \[.*?\n\];', segments16, s, count=1, flags=re.S)
new_migration = '''    try {
        let segmentos = JSON.parse(atual);
        if (Array.isArray(segmentos) && segmentos.length > 16) {
          segmentos = segmentos.slice(0, 16);
        }
        if (Array.isArray(segmentos) && segmentos.length === 16) {
          if (segmentos[8] && String(segmentos[8].type || '').toLowerCase() === 'prize' && Number(segmentos[8].multiplier) === 4) {
            segmentos[8] = {...segmentos[8], label:'2x', multiplier:2};
          }
          await pool.query(`UPDATE site_settings SET setting_value=$1,updated_at=CURRENT_TIMESTAMP WHERE setting_key='roulette_segments_json'`,[JSON.stringify(segmentos)]);
        } else {
          await pool.query(`UPDATE site_settings SET setting_value=$1,updated_at=CURRENT_TIMESTAMP WHERE setting_key='roulette_segments_json'`,[JSON.stringify(segmentosRoletaPadrao)]);
        }
      } catch (error) { console.warn('Migração da roleta não aplicada:',error.message); }'''
s = re.sub(r'    if \(atual\.includes\("JOGUE NOVAMENTE"\).*?\n      } catch \(error\) \{ console\.warn\(\'Migração da roleta não aplicada:\',error\.message\); \}', new_migration, s, count=1, flags=re.S)
write(path, s)

# ---------------- server.js ----------------
path = 'backend/src/server.js'
s = read(path)
server_segments = '''const ROLETTE_DEFAULT_SEGMENTS = [
  { index: 0, label: "2x", type: "prize", multiplier: 2, probability: 5 },
  { index: 1, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 2, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 3, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 4, label: "3x", type: "prize", multiplier: 3, probability: 5 },
  { index: 5, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 6, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 7, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 8, label: "2x", type: "prize", multiplier: 2, probability: 5 },
  { index: 9, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 10, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 11, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 12, label: "5x", type: "prize", multiplier: 5, probability: 5 },
  { index: 13, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 14, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 15, label: "", type: "zero", multiplier: 0, probability: 5 }
];'''
s = re.sub(r'const ROLETTE_DEFAULT_SEGMENTS = \[.*?\n\];', server_segments, s, count=1, flags=re.S)
s = s.replace('ROLETA ÚNICA - 20 FATIAS', 'ROLETA ÚNICA - 16 FATIAS')
s = s.replace('parsed.length !== 20', 'parsed.length !== 16')
s = s.replace('segmentos.length !== 20', 'segmentos.length !== 16')
write(path, s)

# ---------------- dashboard.html ----------------
path = 'backend/frontend/dashboard.html'
d = read(path)
d = d.replace('Os multiplicadores são 2×, 3×, 4× e 5×. As áreas douradas não possuem multiplicador.', 'A roleta tem 16 fatias: 4 multiplicadores e 12 áreas de perda.')
d = d.replace('aria-label="Roleta com 20 posições"', 'aria-label="Roleta com 16 posições"')
d = d.replace('Aposte de R$ 0,50 a R$ 100 • Prêmios: 2×, 3×, 4× e 5×', 'Aposte de R$ 0,50 a R$ 100 • Prêmios: 2×, 3× e 5×')
# Make the player rules/config read 16 entries from the admin instead of silently requiring 20.
d = d.replace('segmentos.length === 20', 'segmentos.length === 16')
d = d.replace('segmentos.length !== 20', 'segmentos.length !== 16')
# Replace the static roulette model with the 16-slice model.
new_roletas = '''const ROLETAS = {
    sorte: {
        title: "Roda da Sorte",
        subtitle: "Faça sua aposta e gire a roda.",
        rules: "A roleta tem 16 fatias: 4 multiplicadores e 12 áreas de perda.",
        segments: [
            "2X", "", "", "",
            "3X", "", "", "",
            "2X", "", "", "",
            "5X", "", "", ""
        ]
    }
};'''
d = re.sub(r'const ROLETAS = \{.*?\n\};', new_roletas, d, count=1, flags=re.S)
# Replace the dynamic settings mapper so any saved 16-slice configuration reaches the player.
d = re.sub(r'        try \{\n            const segmentos = JSON\.parse\(String\(configuracoes\.roulette_segments_json \|\| ""\)\);\n            if \(Array\.isArray\(segmentos\) && segmentos\.length === 16\) \{.*?\n        \} catch \(_\) \{\}', '''        try {
            const segmentos = JSON.parse(String(configuracoes.roulette_segments_json || "[]"));
            if (Array.isArray(segmentos) && segmentos.length === 16) {
                ROLETAS.sorte.segments = segmentos.map(item => {
                    const tipo = String(item?.type || "zero").toLowerCase();
                    const multiplicador = Number(item?.multiplier || 0);
                    if (tipo === "prize" && multiplicador > 0) return `${multiplicador}X`;
                    return "";
                });
            }
        } catch (_) {}''', d, count=1, flags=re.S)
# Replace wheel renderer with 16 equal sectors.
new_create = '''function criarRoda() {
    const wheel = document.getElementById("wheel");
    const svg = document.getElementById("rouletteSvg");
    if (!wheel || !svg) return;

    const roleta = ROLETAS[roletaAtual] || ROLETAS.sorte;
    const segmentos = Array.isArray(roleta.segments) ? roleta.segments : [];
    if (segmentos.length !== 16) {
        console.error("A roleta precisa ter exatamente 16 fatias.");
        return;
    }

    svg.innerHTML = "";
    const ns = "http://www.w3.org/2000/svg";
    const cx = 250, cy = 250, radius = 238;
    const angle = 360 / 16;
    const prizeColors = {0:"#35ff78",4:"#3da5ff",8:"#ffc02e",12:"#ff4040"};

    segmentos.forEach((label, index) => {
        const startDeg = index * angle;
        const endDeg = startDeg + angle;
        const isPrize = String(label || "").trim() !== "";
        const group = document.createElementNS(ns, "g");
        group.setAttribute("class", "roulette-sector");
        group.setAttribute("data-index", String(index));

        const path = document.createElementNS(ns, "path");
        path.setAttribute("d", sectorPath(cx, cy, radius, startDeg, endDeg));
        path.setAttribute("fill", isPrize ? "#080808" : (index % 2 ? "#dca928" : "#c9941f"));
        path.setAttribute("stroke", "#d6a321");
        path.setAttribute("stroke-width", "2");
        group.appendChild(path);

        if (isPrize) {
            const centerDeg = startDeg + angle / 2;
            const p = polar(cx, cy, 157, centerDeg);
            const text = document.createElementNS(ns, "text");
            const texto = String(label).toUpperCase();
            const cor = prizeColors[index] || "#25e66b";
            text.textContent = texto;
            text.setAttribute("x", p.x);
            text.setAttribute("y", p.y);
            text.setAttribute("class", "roulette-label multiplier");
            text.setAttribute("font-size", "58");
            text.setAttribute("fill", cor);
            text.style.fill = cor;
            text.dataset.x = String(p.x);
            text.dataset.y = String(p.y);
            text.setAttribute("transform", `rotate(0 ${p.x} ${p.y})`);
            group.appendChild(text);
        }
        svg.appendChild(group);
    });

    const outerRing = document.createElementNS(ns, "circle");
    outerRing.setAttribute("cx", cx); outerRing.setAttribute("cy", cy); outerRing.setAttribute("r", radius);
    outerRing.setAttribute("fill", "none"); outerRing.setAttribute("stroke", "#a66f08"); outerRing.setAttribute("stroke-width", "11");
    svg.appendChild(outerRing);

    const outerHighlight = document.createElementNS(ns, "circle");
    outerHighlight.setAttribute("cx", cx); outerHighlight.setAttribute("cy", cy); outerHighlight.setAttribute("r", radius - 7);
    outerHighlight.setAttribute("fill", "none"); outerHighlight.setAttribute("stroke", "#f5d66a"); outerHighlight.setAttribute("stroke-width", "2");
    svg.appendChild(outerHighlight);

    wheel.style.transition = "none";
    wheel.style.transform = "rotate(0deg)";
    roletaRotacaoAtual = 0;
}'''
d = re.sub(r'function criarRoda\(\) \{.*?\n\}\n\nfunction formatarResultadoRoleta', new_create + '\n\nfunction formatarResultadoRoleta', d, count=1, flags=re.S)
# Replace animation with 16-sector geometry.
new_anim = '''function animarRoleta(indiceResultado) {
    return new Promise(resolve => {
        const wheel = document.getElementById("wheel");
        const visualIndex = Number(indiceResultado);
        if (!wheel || !Number.isInteger(visualIndex) || visualIndex < 0 || visualIndex >= 16) {
            resolve();
            return;
        }

        const angle = 360 / 16;
        const centro = visualIndex * angle + angle / 2;
        const alvo = -centro;
        const atual = Number(roletaRotacaoAtual) || 0;
        const moduloAlvo = ((alvo % 360) + 360) % 360;
        const moduloAtual = ((atual % 360) + 360) % 360;
        let ajuste = moduloAlvo - moduloAtual;
        if (ajuste < 0) ajuste += 360;

        const destino = atual + 4 * 360 + ajuste;
        const duracao = Math.max(1400, Number(configuracoes.roulette_animation_ms) || 1800);
        wheel.style.transition = "none";
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
        tocarSom("click");
    });
}
async function destacarVencedora'''
d = re.sub(r'function animarRoleta\(indiceResultado\) \{.*?\n\}\nasync function destacarVencedora', new_anim, d, count=1, flags=re.S)
d = d.replace('indiceResultado >= 20', 'indiceResultado >= 16')
# Same validation in free-spin path.
d = d.replace('indiceResultado >= 20', 'indiceResultado >= 16')
# Move the admin-like success-independent player rules to 16 text everywhere in this page.
d = d.replace('20 fatias', '16 fatias').replace('20 posições', '16 posições')
# Add a final compact triangular pointer override so the new pointer is visibly different from the old one.
pointer_css = '''\n/* Ponteiro compacto da roleta de 16 fatias */\n.pointer {\n    top: -7px !important;\n    width: 40px !important;\n    height: 48px !important;\n    background: linear-gradient(145deg,#fff5b8,#ffc52e 55%,#a86400) !important;\n    clip-path: polygon(0 0,100% 0,50% 100%) !important;\n    filter: drop-shadow(0 5px 7px rgba(0,0,0,.9)) !important;\n}\n.pointer::before {\n    content: "" !important;\n    position: absolute !important;\n    left: 50% !important; top: 4px !important;\n    width: 28px !important; height: 34px !important;\n    transform: translateX(-50%) !important;\n    background: #151515 !important;\n    clip-path: polygon(0 0,100% 0,50% 100%) !important;\n}\n.pointer::after {\n    content: "" !important;\n    position: absolute !important;\n    left: 50% !important; top: 7px !important;\n    width: 18px !important; height: 25px !important;\n    transform: translateX(-50%) !important;\n    background: #ff3434 !important;\n    clip-path: polygon(0 0,100% 0,50% 100%) !important;\n    filter: none !important;\n}\n'''
d = d.replace('</style>', pointer_css + '\n</style>', 1)
write(path, d)

# ---------------- admin roulette editor ----------------
path = 'backend/frontend/admin-settings-roleta-editavel.html'
a = read(path)
a = a.replace('roleta configurável de exatamente 20 fatias', 'roleta configurável de exatamente 16 fatias')
a = a.replace('A configuração precisa conter exatamente 20 fatias.', 'A configuração precisa conter exatamente 16 fatias.')
a = a.replace('segmentos.length !== 20', 'segmentos.length !== 16')
a = a.replace('rouletteSegments.length !== 20', 'rouletteSegments.length !== 16')
a = a.replace('A roleta precisa ter exatamente 20 fatias.', 'A roleta precisa ter exatamente 16 fatias.')
# Replace the fallback 20-item array with the current 16-item model.
fallback16 = '''  segmentosRoleta = [
    { index: 0, label: "2x", type: "prize", multiplier: 2, probability: 5 },
    { index: 1, label: "❌", type: "zero", multiplier: 0, probability: 5 },
    { index: 2, label: "❌", type: "zero", multiplier: 0, probability: 5 },
    { index: 3, label: "❌", type: "zero", multiplier: 0, probability: 5 },
    { index: 4, label: "3x", type: "prize", multiplier: 3, probability: 5 },
    { index: 5, label: "❌", type: "zero", multiplier: 0, probability: 5 },
    { index: 6, label: "❌", type: "zero", multiplier: 0, probability: 5 },
    { index: 7, label: "❌", type: "zero", multiplier: 0, probability: 5 },
    { index: 8, label: "2x", type: "prize", multiplier: 2, probability: 5 },
    { index: 9, label: "❌", type: "zero", multiplier: 0, probability: 5 },
    { index: 10, label: "❌", type: "zero", multiplier: 0, probability: 5 },
    { index: 11, label: "❌", type: "zero", multiplier: 0, probability: 5 },
    { index: 12, label: "5x", type: "prize", multiplier: 5, probability: 5 },
    { index: 13, label: "❌", type: "zero", multiplier: 0, probability: 5 },
    { index: 14, label: "❌", type: "zero", multiplier: 0, probability: 5 },
    { index: 15, label: "❌", type: "zero", multiplier: 0, probability: 5 }
  ];'''
a = re.sub(r'  segmentosRoleta = \[.*?\n  \];\n\n  document\.getElementById\("roulette_segments_json"\)\.value =', fallback16 + '\n\n  document.getElementById("roulette_segments_json").value =', a, count=1, flags=re.S)
# Move the green save message below the save button.
a = re.sub(r'(    <div\n      id="message"\n      class="message"\n    ></div>\n\n    <button\n      class="save-button"\n      onclick="salvarConfiguracoes\(\)"\n    >\n      💾 SALVAR CONFIGURAÇÕES\n    </button>)', '''    <button
      class="save-button"
      onclick="salvarConfiguracoes()"
    >
      💾 SALVAR CONFIGURAÇÕES
    </button>

    <div
      id="message"
      class="message"
    ></div>''', a, count=1)
write(path, a)

print('JPBET roulette 16 patch applied')

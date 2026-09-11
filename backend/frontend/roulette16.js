/* My Bets — Roleta visual de 16 fatias.
 * O servidor continua sendo a autoridade sobre o resultado e o prêmio.
 * As cores visuais vêm das configurações públicas salvas pelo administrador.
 */
(function () {
  const PADRAO = [
    {label:"2x",type:"prize",multiplier:2,probability:15},{label:"X",type:"zero",multiplier:0,probability:5},{label:"X",type:"zero",multiplier:0,probability:5},{label:"X",type:"zero",multiplier:0,probability:5},
    {label:"3x",type:"prize",multiplier:3,probability:15},{label:"X",type:"zero",multiplier:0,probability:5},{label:"X",type:"zero",multiplier:0,probability:5},{label:"X",type:"zero",multiplier:0,probability:5},
    {label:"2x",type:"prize",multiplier:2,probability:15},{label:"X",type:"zero",multiplier:0,probability:5},{label:"X",type:"zero",multiplier:0,probability:5},{label:"X",type:"zero",multiplier:0,probability:5},
    {label:"3x",type:"prize",multiplier:3,probability:15},{label:"X",type:"zero",multiplier:0,probability:5},{label:"X",type:"zero",multiplier:0,probability:5},{label:"X",type:"zero",multiplier:0,probability:5}
  ];
  let segmentos = PADRAO.map(s => ({...s}));
  let configuracao = {
    minBet:0.5,
    maxBet:100,
    animationMs:4800,
    prizeColor:"#d4af37",
    lossColor:"#171717",
    textColor:"#25e66b",
    dividerColor:"#ffdd69",
    pointerColor:"#ffd24a",
    accentColor:"#ffd43b",
    backgroundColor:"#fff7d6"
  };
  const $ = id => document.getElementById(id);
  const numero = (v,f=0) => Number.isFinite(Number(v)) ? Number(v) : f;
  const cor = (v,f) => /^#[0-9a-fA-F]{6}$/.test(String(v||"")) ? String(v) : f;
  const moeda = v => Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  function usuario(){try{return JSON.parse(localStorage.getItem("jpbet_user")||"null")||{};}catch{return {};}}
  function carregarConfigLocal(){try{const raw=localStorage.getItem("mybets_roulette_segments");const a=JSON.parse(raw||"[]");if(Array.isArray(a)&&a.length===16)segmentos=a;}catch{}}
  async function carregarConfiguracao(){
    carregarConfigLocal();
    try{
      const r=await fetch("/api/settings/public",{credentials:"same-origin"});
      const d=await r.json();
      if(!r.ok) return;
      const s=d.settings||{};
      try{const a=JSON.parse(s.roulette_segments_json||"[]");if(Array.isArray(a)&&a.length===16) segmentos=a.slice(0,16);}catch{}
      configuracao.minBet=numero(s.roulette_min_bet,0.5);
      configuracao.maxBet=numero(s.roulette_max_bet,100);
      configuracao.animationMs=Math.max(1800,numero(s.roulette_animation_ms,4800));
      configuracao.prizeColor=cor(s.roulette_prize_color,configuracao.prizeColor);
      configuracao.lossColor=cor(s.roulette_loss_color,configuracao.lossColor);
      configuracao.textColor=cor(s.roulette_text_color,configuracao.textColor);
      configuracao.dividerColor=cor(s.roulette_divider_color,configuracao.dividerColor);
      configuracao.pointerColor=cor(s.roulette_pointer_color,configuracao.pointerColor);
      configuracao.accentColor=cor(s.roulette_accent_color,configuracao.accentColor);
      configuracao.backgroundColor=cor(s.roulette_background_color,configuracao.backgroundColor);
    }catch{}
  }
  function aplicarCoresGlobais(){
    const root=document.documentElement;
    root.style.setProperty("--roulette-prize-color",configuracao.prizeColor);
    root.style.setProperty("--roulette-loss-color",configuracao.lossColor);
    root.style.setProperty("--roulette-text-color",configuracao.textColor);
    root.style.setProperty("--roulette-divider-color",configuracao.dividerColor);
    root.style.setProperty("--roulette-pointer-color",configuracao.pointerColor);
    root.style.setProperty("--roulette-accent-color",configuracao.accentColor);
    root.style.setProperty("--roulette-background-color",configuracao.backgroundColor);
  }
  window.criarRoletaSorte=function(){
    const wheel=$("rouletteWheel");if(!wheel)return;
    const angle=360/segmentos.length;wheel.innerHTML="";
    segmentos.forEach((seg,i)=>{const el=document.createElement("span");el.className=`roulette-label ${seg.type==="zero"?"zero":"prize"}`;el.textContent=String(seg.label||"X").toUpperCase();el.style.color=configuracao.textColor;el.style.fill=configuracao.textColor;el.style.stroke="rgba(0,0,0,.9)";const mid=i*angle+angle/2;el.style.transform=`translate(-50%,-50%) rotate(${mid}deg) translateY(-40%) rotate(${-mid}deg)`;wheel.appendChild(el);});
    const faixas=segmentos.map((seg,i)=>{const color=seg.type==="prize"?configuracao.prizeColor:configuracao.lossColor;return `${color} ${i*angle}deg ${(i+1)*angle}deg`;});
    wheel.style.background=`repeating-conic-gradient(from -${angle/2}deg,transparent 0deg ${angle-1.15}deg,${configuracao.dividerColor} ${angle-1.15}deg ${angle}deg),conic-gradient(from -${angle/2}deg,${faixas.join(",")})`;
    wheel.style.setProperty("--roulette-background-color",configuracao.backgroundColor);
  };
  function prepararPonteiro(){const m=document.querySelector(".custom-roulette-machine");if(!m)return;let p=m.querySelector(".roulette-pointer");if(!p){p=document.createElement("div");p.className="roulette-pointer";m.insertBefore(p,m.firstChild);}p.setAttribute("aria-hidden","true");p.style.setProperty("--roulette-pointer-color",configuracao.pointerColor);p.style.background=`linear-gradient(145deg,#fff 0%,${configuracao.pointerColor} 38%,${configuracao.accentColor} 68%,#7a4600 100%)`;}
  window.girarRoleta=async function(){
    if(window.__myBetsRouletteSpinning)return;
    await carregarConfiguracao();
    aplicarCoresGlobais();
    window.criarRoletaSorte();
    const u=usuario(),userId=u?.id??u?.userId??null;
    if(!userId)return window.mostrarToast?.("Faça login novamente.");
    const hasFree=numero(u.rouletteFreeSpins,0)>0&&numero(u.rouletteFreeSpinBet,0)>0;
    const texto=$("rouletteBetValue")?.textContent||"";
    const tela=Number(texto.replace(/[^0-9,.-]/g,"").replace(/\./g,"").replace(",","."));
    const bet=hasFree?numero(u.rouletteFreeSpinBet,0):numero(tela,configuracao.minBet);
    if(!hasFree&&(bet<configuracao.minBet||bet>configuracao.maxBet))return window.mostrarToast?.("Aposta fora dos limites.");
    if(!hasFree&&bet>numero(u.balance,0))return window.mostrarToast?.("Saldo insuficiente.");
    const btn=$("rouletteSpinButton"),wheel=$("rouletteWheel");window.__myBetsRouletteSpinning=true;
    if(btn){btn.disabled=true;btn.textContent="GIRANDO...";}
    try{
      const response=await fetch("/api/roulette/spin",{method:"POST",headers:typeof window.headersJSON==="function"?window.headersJSON():{"Content-Type":"application/json"},body:JSON.stringify({userId,betAmount:bet,betType:"roulette",rouletteId:"sorte",freeSpin:hasFree})});
      const data=await response.json();if(!response.ok)throw Error(data.message||"Não foi possível girar.");
      const r=data.spin||data.result||data,serverIndex=numero(r.index,-1);
      if(serverIndex<0||serverIndex>=16)throw Error("Resultado inválido.");
      const angle=360/16,target=360-(serverIndex*angle+angle/2),rotations=7+Math.floor(Math.random()*3),ms=configuracao.animationMs;
      if(wheel){wheel.style.transition=`transform ${ms}ms cubic-bezier(.12,.72,.12,1)`;wheel.style.transform=`rotate(${rotations*360+target}deg)`;}
      await new Promise(resolve=>setTimeout(resolve,ms+100));
      const seg=segmentos[serverIndex]||PADRAO[serverIndex],prize=numero(r.prize,0);
      if(data.user){if(typeof window.atualizarSaldos==="function")window.atualizarSaldos(data.user.balance);localStorage.setItem("jpbet_user",JSON.stringify({...u,...data.user}));}
      const win=$("winDisplay");if(win)win.textContent=moeda(prize);
      const result=$("rouletteResult");if(result)result.textContent=prize>0?`🎉 ${String(seg.label||"PRÊMIO").toUpperCase()} — Prêmio ${moeda(prize)}${hasFree?" (giro grátis)":""}`:"❌ PERDEU — Prêmio R$ 0,00";
      window.criarRoletaSorte();prepararPonteiro();if(typeof window.atualizarGiroGratis==="function")window.atualizarGiroGratis();
    }catch(error){const result=$("rouletteResult");if(result)result.textContent="Defina sua aposta e gire.";window.mostrarToast?.(error.message||"Erro ao girar.");}
    finally{window.__myBetsRouletteSpinning=false;if(btn){btn.disabled=false;btn.textContent="GIRAR ROLETA";}if(typeof window.atualizarGiroGratis==="function")window.atualizarGiroGratis();}
  };
  document.addEventListener("DOMContentLoaded",async()=>{await carregarConfiguracao();aplicarCoresGlobais();window.criarRoletaSorte();prepararPonteiro();});
})();

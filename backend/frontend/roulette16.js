/* My Bets — Roleta visual de 16 fatias.
 * O servidor continua sendo a autoridade sobre o resultado e o prêmio.
 * As 4 posições internas finais têm probabilidade zero.
 */
(function () {
  const PADRAO = [
    {label:"2x",type:"prize",multiplier:2,probability:5},{label:"X",type:"zero",multiplier:0,probability:5},{label:"X",type:"zero",multiplier:0,probability:5},{label:"X",type:"zero",multiplier:0,probability:5},
    {label:"X",type:"zero",multiplier:0,probability:5},{label:"3x",type:"prize",multiplier:3,probability:5},{label:"X",type:"zero",multiplier:0,probability:5},{label:"X",type:"zero",multiplier:0,probability:5},
    {label:"X",type:"zero",multiplier:0,probability:5},{label:"X",type:"zero",multiplier:0,probability:5},{label:"2x",type:"prize",multiplier:2,probability:5},{label:"X",type:"zero",multiplier:0,probability:5},
    {label:"X",type:"zero",multiplier:0,probability:5},{label:"X",type:"zero",multiplier:0,probability:5},{label:"X",type:"zero",multiplier:0,probability:5},{label:"5x",type:"prize",multiplier:5,probability:5}
  ];
  let segmentos = PADRAO.map(s => ({...s}));
  let configuracao = { minBet:0.5, maxBet:100, animationMs:4800 };
  const $ = id => document.getElementById(id);
  const numero = (v,f=0) => Number.isFinite(Number(v)) ? Number(v) : f;
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
      const a=JSON.parse(s.roulette_segments_json||"[]");
      if(Array.isArray(a)&&a.length>=16) segmentos=a.slice(0,16);
      configuracao.minBet=numero(s.roulette_min_bet,0.5);
      configuracao.maxBet=numero(s.roulette_max_bet,100);
      configuracao.animationMs=Math.max(1800,numero(s.roulette_animation_ms,4800));
    }catch{}
  }
  window.criarRoletaSorte=function(){
    const wheel=$("rouletteWheel");if(!wheel)return;
    const angle=360/segmentos.length;wheel.innerHTML="";
    segmentos.forEach((seg,i)=>{const el=document.createElement("span");el.className=`roulette-label ${seg.type==="zero"?"zero":"prize"}`;el.textContent=String(seg.label||"X").toUpperCase();const mid=i*angle+angle/2;el.style.transform=`translate(-50%,-50%) rotate(${mid}deg) translateY(-40%) rotate(${-mid}deg)`;wheel.appendChild(el);});
    const faixas=segmentos.map((seg,i)=>{const color=seg.type==="prize"?"#d4af37":(i%2?"#111111":"#242424");return `${color} ${i*angle}deg ${(i+1)*angle}deg`;});
    wheel.style.background=`repeating-conic-gradient(from -${angle/2}deg,transparent 0deg ${angle-1.15}deg,rgba(255,221,105,.9) ${angle-1.15}deg ${angle}deg),conic-gradient(from -${angle/2}deg,${faixas.join(",")})`;
  };
  function prepararPonteiro(){const m=document.querySelector(".custom-roulette-machine");if(!m)return;let p=m.querySelector(".roulette-pointer");if(!p){p=document.createElement("div");p.className="roulette-pointer";m.insertBefore(p,m.firstChild);}p.setAttribute("aria-hidden","true");}
  window.girarRoleta=async function(){
    if(window.__myBetsRouletteSpinning)return;
    await carregarConfiguracao();
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
  document.addEventListener("DOMContentLoaded",async()=>{await carregarConfiguracao();window.criarRoletaSorte();prepararPonteiro();});
})();

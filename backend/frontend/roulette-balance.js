(()=>{
let timer=null;
let atualizando=false;

function moedaBR(valor){
 const n=Number(valor);
 return Number.isFinite(n)?n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'0,00';
}

function criarPainelSaldo(){
 const modal=document.getElementById('rouletteModal');
 const area=document.getElementById('rouletteArea');
 if(!modal||!area)return;
 if(document.getElementById('mybetsRouletteBalance'))return;

 const painel=document.createElement('div');
 painel.id='mybetsRouletteBalance';
 painel.innerHTML='<span class="mybets-balance-icon">▣</span><div class="mybets-balance-info"><span>Saldo disponível</span><strong id="mybetsRouletteBalanceValue">R$ 0,00</strong></div><span class="mybets-balance-sync" aria-hidden="true">↻</span>';
 modal.querySelector('.modal-content')?.insertBefore(painel,area);

 const style=document.createElement('style');
 style.id='mybets-roulette-balance-css';
 style.textContent=`
#mybetsRouletteBalance{width:calc(100% - 24px);min-height:70px;margin:2px 12px 10px;padding:10px 16px;display:flex;align-items:center;gap:12px;border:1.5px solid #d9a91d;border-radius:18px;background:linear-gradient(120deg,#0b0e13,#17140b);box-shadow:0 0 0 1px rgba(255,207,65,.10),0 6px 16px rgba(0,0,0,.28);position:relative;z-index:70}
#mybetsRouletteBalance .mybets-balance-icon{width:42px;height:42px;display:grid;place-items:center;border:2px solid #ffd33d;border-radius:12px;color:#ffd33d;font-size:22px;flex:0 0 42px}
#mybetsRouletteBalance .mybets-balance-info{min-width:0;display:flex;flex-direction:column;gap:1px}
#mybetsRouletteBalance .mybets-balance-info span{font-size:14px;color:#aeb5c0;font-weight:700}
#mybetsRouletteBalance .mybets-balance-info strong{font-size:25px;color:#ffd33d;font-weight:1000;line-height:1.1;white-space:nowrap}
#mybetsRouletteBalance .mybets-balance-sync{margin-left:auto;color:#ffd33d;font-size:25px;line-height:1;opacity:.9}
#mybetsRouletteBalance.is-updating .mybets-balance-sync{animation:mybetsBalanceSpin .7s linear infinite}
@keyframes mybetsBalanceSpin{to{transform:rotate(360deg)}}
#rouletteModal .roulette-result{display:none!important;height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}
@media(max-width:600px){#mybetsRouletteBalance{min-height:62px;margin:2px 10px 8px;padding:8px 12px;border-radius:16px}#mybetsRouletteBalance .mybets-balance-icon{width:38px;height:38px;flex-basis:38px;font-size:20px}#mybetsRouletteBalance .mybets-balance-info span{font-size:12px}#mybetsRouletteBalance .mybets-balance-info strong{font-size:22px}#mybetsRouletteBalance .mybets-balance-sync{font-size:22px}}
`;
 document.head.appendChild(style);
}

async function atualizarSaldoRoleta(){
 const modal=document.getElementById('rouletteModal');
 const painel=document.getElementById('mybetsRouletteBalance');
 const valor=document.getElementById('mybetsRouletteBalanceValue');
 if(!modal||!painel||!valor||modal.style.display==='none')return;
 if(atualizando)return;
 if(typeof window.carregarSaldoServidor!=='function')return;
 atualizando=true;
 painel.classList.add('is-updating');
 try{
  await window.carregarSaldoServidor();
  const user=window.usuarioAtual;
  const saldo=Number(user?.balance??user?.saldo??0)||0;
  valor.textContent=`R$ ${moedaBR(saldo)}`;
 }catch(e){}finally{
  atualizando=false;
  painel.classList.remove('is-updating');
 }
}

function sincronizarComModal(){
 criarPainelSaldo();
 const modal=document.getElementById('rouletteModal');
 if(!modal)return;
 const visivel=modal.style.display!=='none'&&getComputedStyle(modal).display!=='none';
 if(visivel){
  atualizarSaldoRoleta();
  if(!timer)timer=setInterval(atualizarSaldoRoleta,2500);
 }else if(timer){
  clearInterval(timer);timer=null;
 }
}

function iniciar(){
 criarPainelSaldo();
 const modal=document.getElementById('rouletteModal');
 if(!modal)return;
 new MutationObserver(sincronizarComModal).observe(modal,{attributes:true,attributeFilter:['style','class']});
 sincronizarComModal();
 setInterval(sincronizarComModal,1000);
}

document.addEventListener('DOMContentLoaded',()=>setTimeout(iniciar,100));
if(document.readyState!=='loading')setTimeout(iniciar,100);
})();
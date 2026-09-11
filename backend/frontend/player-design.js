(()=>{
function apply(){
 const container=document.querySelector('.container');
 const games=document.querySelector('.games');
 if(!container||!games)return;

 // O dashboard.html já contém o layout final aprovado.
 // Este script apenas limpa a duplicação antiga do título e garante
 // que a página permaneça responsiva no celular, sem reconstruir a roleta.
 document.querySelectorAll('.roulette-section-heading').forEach(el=>{
   const nested=el.querySelectorAll('.roulette-section-heading');
   nested.forEach(n=>n.remove());
 });

 const headings=document.querySelectorAll('.roulette-section-heading');
 let heading=headings[0];
 headings.forEach((el,i)=>{ if(i>0) el.remove(); });
 if(!heading){
   heading=document.createElement('div');
   heading.className='roulette-section-heading';
   heading.innerHTML='<h2 class="section-title">🎰 Roletas</h2><span>GIRE E MULTIPLIQUE</span>';
   games.parentNode.insertBefore(heading,games);
 }

 let style=document.getElementById('mybets-player-safe-css');
 if(!style){
   style=document.createElement('style');
   style.id='mybets-player-safe-css';
   style.textContent=`
html,body{width:100%;max-width:100%;min-width:0;overflow-x:hidden!important}
*,*::before,*::after{box-sizing:border-box}
.container{width:min(1100px,calc(100% - 28px))!important;max-width:1100px!important;margin-left:auto!important;margin-right:auto!important;min-width:0!important}
.games{width:100%!important;max-width:100%!important;min-width:0!important;display:grid!important;grid-template-columns:1fr!important}
.game-card{width:100%!important;max-width:100%!important;min-width:0!important}
.roulette-feature-card{width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important}
.roulette-promo{width:100%!important;max-width:100%!important;min-width:0!important}
.roulette-art{min-width:0!important;max-width:100%!important}
.roulette-wheel-art{max-width:100%!important}
.roulette-section-heading{width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important}
@media(max-width:600px){
 .container{width:calc(100% - 20px)!important;padding-left:0!important;padding-right:0!important}
 .roulette-promo{grid-template-columns:45% 55%!important}
 .roulette-wheel-art{width:min(220px,48vw)!important}
 .roulette-brand{font-size:30px!important}
 .roulette-promo-copy p{font-size:11px!important}
}
`;
   document.head.appendChild(style);
 }
}
document.addEventListener('DOMContentLoaded',apply);
if(document.readyState!=='loading')apply();
})();
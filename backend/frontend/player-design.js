(()=>{
function aplicarRoletaNova(){
 try{
  if(typeof ROLETAS==='undefined'||!ROLETAS.sorte)return;
  ROLETAS.sorte.title='Roleta MyBets';
  ROLETAS.sorte.subtitle='Faça sua aposta e gire a roleta.';
  ROLETAS.sorte.rules='A roleta tem 16 fatias: 4 multiplicadores e 12 áreas de perda.';
  ROLETAS.sorte.segments=[
   '2X','','','',
   '3X','','','',
   '5X','','','',
   '10X','','',''
  ];
  const title=document.getElementById('rouletteTitle');
  if(title)title.textContent='Roleta MyBets';
  const explanation=document.querySelector('.roulette-explanation');
  if(explanation)explanation.innerHTML='<strong>Jogue seu valor e multiplique!</strong><br><small>Prêmios: 2x, 3x, 5x e 10x.</small>';
  if(typeof criarRoda==='function')criarRoda();
 }catch(e){console.warn('MyBets: falha ao aplicar nova roleta',e)}
}
function apply(){
 const container=document.querySelector('.container');
 const games=document.querySelector('.games');
 if(!container||!games)return;

 document.querySelectorAll('.roulette-section-heading').forEach(el=>{
  const nested=el.querySelectorAll('.roulette-section-heading');
  nested.forEach(n=>n.remove());
 });

 const headings=document.querySelectorAll('.roulette-section-heading');
 let heading=headings[0];
 headings.forEach((el,i)=>{if(i>0)el.remove()});
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
 aplicarRoletaNova();
 setTimeout(aplicarRoletaNova,250);
 setTimeout(aplicarRoletaNova,900);
}
document.addEventListener('DOMContentLoaded',apply);
if(document.readyState!=='loading')apply();
})();
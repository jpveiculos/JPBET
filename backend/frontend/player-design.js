(()=>{
function fixHeading(){
 const games=document.querySelector('.games');
 if(!games)return;
 document.querySelectorAll('.roulette-section-heading').forEach(e=>e.remove());
 const h=document.createElement('div');
 h.className='roulette-section-heading';
 h.innerHTML='<h2 class="section-title">🎰 Roletas</h2><span>GIRE E MULTIPLIQUE</span>';
 games.parentNode.insertBefore(h,games);
}
function apply(){
 if(!document.querySelector('.container')||!document.querySelector('.games'))return;
 let style=document.getElementById('mybets-player-fix-css');
 if(!style){
  style=document.createElement('style');style.id='mybets-player-fix-css';style.textContent=`
html,body{width:100%!important;min-width:0!important;max-width:100%!important;margin:0!important;padding:0!important;overflow-x:hidden!important;zoom:1!important;transform:none!important}
*,*::before,*::after{box-sizing:border-box}
.header{width:100%!important;max-width:none!important;min-width:0!important}
.container{width:100%!important;max-width:1100px!important;margin:0 auto!important;padding-left:14px!important;padding-right:14px!important}
.games{width:100%!important;max-width:100%!important;display:grid!important;grid-template-columns:1fr!important}
.roulette-section-heading{width:100%!important;max-width:100%!important;display:flex!important;align-items:flex-end!important;justify-content:space-between!important;gap:10px!important;overflow:hidden!important}
.roulette-section-heading .section-title{flex:0 0 auto!important;margin:26px 0 13px!important}
.roulette-section-heading>span{display:block!important;flex:1 1 auto!important;min-width:0!important;text-align:right!important;white-space:nowrap!important;overflow:hidden!important;color:#d9a923!important;font-size:14px!important;font-weight:900!important;letter-spacing:1.5px!important;padding-bottom:8px!important}
.roulette-feature-card{width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important}
.roulette-promo{width:100%!important;max-width:100%!important;min-width:0!important;grid-template-columns:minmax(0,42%) minmax(0,58%)!important}
.roulette-promo-copy,.roulette-art{min-width:0!important;max-width:100%!important}
.roulette-preview-original,.roulette-wheel-art{max-width:100%!important}
@media(max-width:600px){.container{width:100%!important;padding-left:14px!important;padding-right:14px!important}.header{padding-left:14px!important;padding-right:14px!important}.roulette-promo{grid-template-columns:42% 58%!important}.roulette-brand{font-size:30px!important}.roulette-promo-copy p{font-size:11px!important}}
`;
  document.head.appendChild(style);
 }
 const logo=document.querySelector('.logo');if(logo)logo.outerHTML='<a class="logo mybets-logo" href="/" aria-label="MyBets inicio"><span>My</span><b>Bets</b></a>';
 document.querySelectorAll('.header-balance,#headerBalance').forEach(e=>e.style.display='none');
 const h=document.querySelector('.header');if(h&&!h.querySelector('.player-back-button')){const b=document.createElement('button');b.className='player-back-button';b.type='button';b.textContent='←';b.setAttribute('aria-label','Voltar');b.onclick=window.voltarPaginaMyBets||(()=>history.back());h.insertBefore(b,h.querySelector('.header-right'));}
 const w=document.querySelector('.welcome');if(w)w.innerHTML='<h1>Olá, <span id="userName">Jogador</span> 👋</h1><p>Bora jogar? Boa sorte!</p>';
 fixHeading();
 const game=document.querySelector('.games .game-card');if(game){game.classList.add('roulette-feature-card');const wheel=game.querySelector('.roulette-wheel-art');if(wheel)wheel.style.width='min(220px,48vw)';}
}
document.addEventListener('DOMContentLoaded',apply);if(document.readyState!=='loading')apply();
})();
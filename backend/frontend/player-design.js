(()=>{
function draw(){
 const src=document.getElementById('rouletteSvg'), dst=document.getElementById('roulettePreviewSvg');
 if(!dst)return;
 if(src&&typeof window.criarRoda==='function'){try{window.criarRoda()}catch(e){}}
 if(src&&src.innerHTML.trim()) dst.innerHTML=src.innerHTML;
}
function apply(){
 if(!document.querySelector('.container')||!document.querySelector('.games'))return;
 const logo=document.querySelector('.logo');if(logo)logo.outerHTML='<a class="logo mybets-logo" href="/" aria-label="MyBets inicio"><span>My</span><b>Bets</b></a>';
 document.querySelectorAll('.header-balance,#headerBalance').forEach(e=>e.style.display='none');
 const h=document.querySelector('.header');if(h&&!h.querySelector('.player-back-button')){const b=document.createElement('button');b.className='player-back-button';b.textContent='←';b.type='button';b.onclick=window.voltarPaginaMyBets;h.insertBefore(b,h.querySelector('.header-right'));}
 const w=document.querySelector('.welcome');if(w)w.innerHTML='<h1>Olá, <span id="userName">Jogador</span> 👋</h1><p>Bora jogar? Boa sorte!</p>';
 const title=[...document.querySelectorAll('.section-title')].find(e=>e.textContent.includes('Roletas'));if(title){const old=title.closest('.roulette-section-heading');const x=document.createElement('div');x.className='roulette-section-heading';x.innerHTML='<h2 class="section-title">🎰 Roletas</h2><span>GIRE E MULTIPLIQUE</span>';if(old)old.replaceWith(x);else title.replaceWith(x);}
 const game=document.querySelector('.games .game-card');if(game){game.className='game-card roulette-feature-card';game.innerHTML='<div class="roulette-promo"><div class="roulette-promo-copy"><div class="roulette-brand"><i>Roleta</i><strong>MyBets</strong></div><p>GIRE, DIVIRTA-SE<br>E MULTIPLIQUE<br>SUAS CHANCES!</p><div class="chip-stack"><span></span><span></span><span></span></div></div><div class="roulette-art"><div class="roulette-preview-pointer">▼</div><div class="roulette-preview-original"><svg id="roulettePreviewSvg" viewBox="0 0 500 500"></svg></div></div></div><h3>Roleta MyBets</h3><button class="game-button" onclick="abrirRoleta(\'sorte\')">▶ JOGAR</button>';}
 draw();setTimeout(draw,400);setTimeout(draw,1200);setTimeout(draw,2500);
}
document.addEventListener('DOMContentLoaded',apply);
})();

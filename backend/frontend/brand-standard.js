(function(){'use strict';const GOLD='#ffd83d';const SELECTORS=['.brand-main','.modal-brand','.footer-brand','.logo','.brand','.game-brand'];function markup(){return '<span class="mybets-logo-main"><span class="mybets-logo-my">My</span><span class="mybets-logo-bets">Bets</span></span><span class="mybets-logo-line" aria-hidden="true"></span>';}function apply(el){if(!el||el.dataset.mybetsStandardized==='1')return;if(!((el.textContent||'').replace(/\s+/g,'').toLowerCase().includes('mybets')))return;let t=el;if(el.tagName!=='A'){const a=document.createElement('a');Array.from(el.attributes).forEach(x=>a.setAttribute(x.name,x.value));a.className=el.className;el.replaceWith(a);t=a;}t.dataset.mybetsStandardized='1';t.href='/';t.setAttribute('aria-label','MyBets — página inicial');t.innerHTML=markup();t.classList.add('mybets-logo');}function standardize(){SELECTORS.forEach(s=>document.querySelectorAll(s).forEach(apply));document.querySelectorAll('h1').forEach(el=>{if(/^🔐\s*MyBets Admin$/i.test((el.textContent||'').replace(/\s+/g,' ').trim())&&!el.dataset.mybetsAdminStandardized){el.dataset.mybetsAdminStandardized='1';el.innerHTML='<a href="/" class="mybets-admin-logo" aria-label="MyBets — página inicial">'+markup()+'</a><span class="mybets-admin-label">Admin</span>';}});}const style=document.createElement('style');style.textContent=`.mybets-logo,.mybets-admin-logo{position:relative!important;display:inline-flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:center!important;gap:0!important;padding:0 0 7px!important;margin:0!important;color:#fff!important;text-decoration:none!important;line-height:1!important;white-space:nowrap!important;cursor:pointer!important}.mybets-logo:before,.mybets-logo:after,.mybets-admin-logo:before,.mybets-admin-logo:after{content:none!important;display:none!important}.mybets-logo-main{display:inline-flex!important;align-items:baseline!important;font-family:Arial,Helvetica,sans-serif!important;font-size:clamp(24px,3.5vw,34px)!important;font-weight:950!important;font-style:italic!important;letter-spacing:-1.5px!important;line-height:1!important;text-decoration:none!important;text-shadow:0 2px 7px rgba(0,0,0,.5)!important}.mybets-logo-my{color:${GOLD}!important}.mybets-logo-bets{color:#fff!important}.mybets-logo-line{display:block!important;width:100%!important;height:3px!important;margin-top:5px!important;border-radius:999px!important;background:linear-gradient(90deg,transparent 0%,${GOLD} 10%,${GOLD} 90%,transparent 100%)!important;box-shadow:0 1px 6px rgba(255,216,61,.4)!important}.mybets-admin-logo .mybets-logo-main{font-size:27px!important}.mybets-admin-logo .mybets-logo-line{height:3px!important;margin-top:5px!important}.mybets-admin-label{margin-left:7px!important;color:#aaa!important;font-size:.55em!important;font-weight:800!important;letter-spacing:2px!important;text-transform:uppercase!important}.game-brand.mybets-logo{padding-bottom:5px!important}.game-brand.mybets-logo .mybets-logo-main{font-size:19px!important;letter-spacing:-.5px!important}.game-brand.mybets-logo .mybets-logo-line{height:2px!important;margin-top:4px!important}.footer-brand.mybets-logo .mybets-logo-main{font-size:clamp(25px,3.5vw,34px)!important}.footer-brand.mybets-logo .mybets-logo-line{height:3px!important}@media(max-width:600px){.mybets-logo-main{font-size:clamp(24px,8vw,34px)!important}.game-brand.mybets-logo .mybets-logo-main{font-size:19px!important}}.top .mybets-logo{display:inline-flex!important;flex-direction:column!important;align-items:flex-start!important;width:max-content!important;max-width:170px!important;padding:0 0 5px!important}.top .mybets-logo-main{display:inline-flex!important;flex-direction:row!important;align-items:baseline!important;white-space:nowrap!important;font-size:27px!important;letter-spacing:-1.5px!important}.top .mybets-logo-line{display:block!important;width:100%!important;height:2px!important;margin-top:4px!important}.top .mybets-logo-my{display:inline!important}.top .mybets-logo-bets{display:inline!important}@media(max-width:600px){.top .mybets-logo-main{font-size:27px!important}}`;document.head.appendChild(style);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',standardize);else standardize();
function instalarLimitesAposta(){
  if(location.pathname==='/admin-settings.html'){
    const minInput=document.getElementById('roulette207_min_bet');
    if(minInput&&!document.getElementById('roulette207_max_bet')){
      const minField=minInput.closest('.field');
      if(minField){
        const field=document.createElement('div');
        field.className='field';
        field.innerHTML='<label>Aposta máxima (R$)</label><input id="roulette207_max_bet" type="number" min="0.50" step="0.01" value="100.00"><div style="font-size:13px;color:#666;line-height:1.35">Limite máximo permitido por aposta na roleta.</div>';
        minField.parentNode.insertBefore(field,minField.nextSibling);
      }
    }
    const maxInput=document.getElementById('roulette207_max_bet');
    if(maxInput){
      fetch('/api/settings',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json()).then(d=>{
        const settings={};(d.settings||[]).forEach(x=>settings[x.setting_key]=x.setting_value);
        const value=Number(settings.roulette207_max_bet);
        maxInput.value=Number.isFinite(value)&&value>=0.50?value.toFixed(2):'100.00';
      }).catch(()=>{if(!maxInput.value)maxInput.value='100.00'});
      if(window.saveAll&&!window.saveAll.__betLimitsWrapped){
        const originalSave=window.saveAll;
        const wrapped=async function(){
          const min=Number(document.getElementById('roulette207_min_bet')?.value);
          const max=Number(document.getElementById('roulette207_max_bet')?.value);
          if(!Number.isFinite(min)||min<0.50){msg('Informe uma aposta mínima válida (mínimo de R$ 0,50).');return}
          if(!Number.isFinite(max)||max<0.50){msg('Informe uma aposta máxima válida.');return}
          if(max<min){msg('A aposta máxima não pode ser menor que a aposta mínima.');return}
          const originalFetch=window.fetch;
          window.fetch=async function(input,init){
            if(typeof input==='string'&&input==='/api/settings'&&init?.method==='PUT'&&init.body){
              try{const payload=JSON.parse(init.body);payload.roulette207_max_bet=max.toFixed(2);init={...init,body:JSON.stringify(payload)}}catch(_){ }
            }
            return originalFetch.call(this,input,init);
          };
          try{return await originalSave()}finally{window.fetch=originalFetch}
        };
        wrapped.__betLimitsWrapped=true;
        window.saveAll=wrapped;
      }
    }
  }
  if(location.pathname.endsWith('/roulette207.html')){
    const input=document.getElementById('betAmount');
    if(!input)return;
    let maxBet=100;
    const aplicarMax=()=>{
      input.max=maxBet.toFixed(2);
      const value=Number(String(input.value||'').replace(',','.'));
      if(Number.isFinite(value)&&value>maxBet)input.value=maxBet.toFixed(2);
    };
    fetch('/api/roulette207/config',{cache:'no-store'}).then(r=>r.json()).then(d=>{
      const configured=Number(d?.roulette?.maxBet);
      if(Number.isFinite(configured)&&configured>=0.50)maxBet=Number(configured.toFixed(2));
      aplicarMax();
    }).catch(()=>aplicarMax());
    input.addEventListener('input',aplicarMax);
    input.addEventListener('change',aplicarMax);
    if(window.normalizeBet&&!window.normalizeBet.__betLimitsWrapped){
      const originalNormalize=window.normalizeBet;
      const wrappedNormalize=function(){originalNormalize();aplicarMax();};
      wrappedNormalize.__betLimitsWrapped=true;
      window.normalizeBet=wrappedNormalize;
    }
    if(window.changeBet&&!window.changeBet.__betLimitsWrapped){
      const originalChange=window.changeBet;
      const wrappedChange=function(delta){originalChange(delta);aplicarMax();};
      wrappedChange.__betLimitsWrapped=true;
      window.changeBet=wrappedChange;
    }
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',instalarLimitesAposta);else instalarLimitesAposta();
if(location.pathname.endsWith('/roulette207.html')){
  const nativeRAF=window.requestAnimationFrame.bind(window);let rafBase=null;
  window.requestAnimationFrame=function(callback){return nativeRAF(function(realNow){if(window.spinning){if(rafBase===null)rafBase=realNow;const elapsed=realNow-rafBase;const p=Math.min(1,elapsed/8500);const originalProgress=p;callback(rafBase+originalProgress*5000);if(p>=1)rafBase=null}else{rafBase=null;callback(realNow)}})};
}
})();
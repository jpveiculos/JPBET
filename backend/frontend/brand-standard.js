(function(){
  'use strict';

  const LOGO_SELECTORS = [
    '.brand-main',
    '.modal-brand',
    '.footer-brand',
    '.logo',
    '.brand',
    '.game-brand'
  ];

  function makeLogoContent(el){
    el.classList.add('mybets-logo');
    el.innerHTML =
      '<span class="mybets-logo-main"><span class="mybets-logo-my">My</span><span class="mybets-logo-bets">Bets</span></span>' +
      '<span class="mybets-logo-line" aria-hidden="true"></span>';
    el.setAttribute('aria-label','MyBets — página inicial');
  }

  function makeLinkedLogo(el){
    let target = el;

    if(el.tagName !== 'A'){
      const a = document.createElement('a');
      Array.from(el.attributes).forEach(attr => a.setAttribute(attr.name, attr.value));
      a.className = el.className;
      el.replaceWith(a);
      target = a;
    }

    target.href = '/';
    target.setAttribute('aria-label','MyBets — página inicial');
    makeLogoContent(target);
  }

  function standardize(){
    LOGO_SELECTORS.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        if(el.dataset.mybetsStandardized === '1') return;
        const text = (el.textContent || '').replace(/\s+/g,'').toLowerCase();
        if(!text.includes('mybets')) return;

        el.dataset.mybetsStandardized = '1';

        if(selector === '.brand-main' && el.closest('a')){
          el.closest('a').href = '/';
          el.closest('a').setAttribute('aria-label','MyBets — página inicial');
          makeLogoContent(el);
        }else{
          makeLinkedLogo(el);
        }
      });
    });

    document.querySelectorAll('h1').forEach(el => {
      const text = (el.textContent || '').replace(/\s+/g,' ').trim();
      if(/^🔐\s*MyBets Admin$/i.test(text) && !el.dataset.mybetsAdminStandardized){
        el.dataset.mybetsAdminStandardized = '1';
        el.innerHTML = '<a href="/" class="mybets-admin-logo" aria-label="MyBets — página inicial"><span class="mybets-logo-main"><span class="mybets-logo-my">My</span><span class="mybets-logo-bets">Bets</span></span><span class="mybets-logo-line" aria-hidden="true"></span></a><span class="mybets-admin-label">Admin</span>';
      }
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    .mybets-logo,
    .mybets-admin-logo{
      position:relative !important;
      display:inline-flex !important;
      flex-direction:column !important;
      align-items:flex-start !important;
      justify-content:center !important;
      gap:0 !important;
      padding:0 0 7px !important;
      margin:0 !important;
      color:#fff !important;
      text-decoration:none !important;
      line-height:1 !important;
      white-space:nowrap !important;
      cursor:pointer !important;
    }
    .mybets-logo:after,
    .mybets-logo:before,
    .mybets-admin-logo:after,
    .mybets-admin-logo:before{
      content:none !important;
      display:none !important;
    }
    .mybets-logo-main{
      display:inline-flex !important;
      align-items:baseline !important;
      font-family:Arial,Helvetica,sans-serif !important;
      font-size:inherit !important;
      font-weight:950 !important;
      font-style:italic !important;
      letter-spacing:-1.5px !important;
      line-height:1 !important;
      color:#fff !important;
      text-decoration:none !important;
      text-shadow:0 2px 8px rgba(0,0,0,.45) !important;
    }
    .mybets-logo-my{
      color:#fff !important;
    }
    .mybets-logo-bets{
      color:#ffd83d !important;
    }
    .mybets-logo-line{
      display:block !important;
      width:100% !important;
      height:4px !important;
      margin-top:6px !important;
      border-radius:999px !important;
      background:linear-gradient(90deg,transparent 0%,#ffd83d 14%,#ffd83d 86%,transparent 100%) !important;
      box-shadow:0 1px 6px rgba(255,216,61,.42) !important;
    }
    .mybets-admin-logo{
      padding-bottom:6px !important;
      margin-right:10px !important;
    }
    .mybets-admin-logo .mybets-logo-main{
      font-size:27px !important;
    }
    .mybets-admin-logo .mybets-logo-line{
      height:3px !important;
      margin-top:5px !important;
    }
    .mybets-admin-label{
      margin-left:0 !important;
      color:#aaa !important;
      font-size:.55em !important;
      font-weight:800 !important;
      letter-spacing:2px !important;
      text-transform:uppercase !important;
      vertical-align:middle !important;
    }
    .game-brand.mybets-logo{
      align-items:flex-start !important;
      padding-bottom:5px !important;
      font-size:10px !important;
      letter-spacing:0 !important;
    }
    .game-brand.mybets-logo .mybets-logo-main{
      font-size:10px !important;
      letter-spacing:1px !important;
    }
    .game-brand.mybets-logo .mybets-logo-line{
      height:2px !important;
      margin-top:3px !important;
    }
  `;
  document.head.appendChild(style);

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', standardize);
  }else{
    standardize();
  }
})();

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

  function logoMarkup(){
    return '<span class="mybets-logo-main"><span class="mybets-logo-my">My</span><span class="mybets-logo-bets">Bets</span></span>' +
      '<span class="mybets-logo-line" aria-hidden="true"></span>';
  }

  function makeLogoContent(el){
    el.classList.add('mybets-logo');
    el.innerHTML = logoMarkup();
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

        if(el.tagName === 'A'){
          el.href = '/';
          makeLogoContent(el);
        }else if(selector === '.brand-main' && el.closest('a')){
          const parent = el.closest('a');
          parent.href = '/';
          parent.setAttribute('aria-label','MyBets — página inicial');
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
        el.innerHTML = '<a href="/" class="mybets-admin-logo" aria-label="MyBets — página inicial">' + logoMarkup() + '</a><span class="mybets-admin-label">Admin</span>';
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
      padding:0 0 8px !important;
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
      font-size:32px !important;
      font-weight:950 !important;
      font-style:italic !important;
      letter-spacing:-2px !important;
      line-height:1 !important;
      color:#ffd83d !important;
      text-decoration:none !important;
      text-shadow:0 2px 8px rgba(0,0,0,.5) !important;
    }

    .mybets-logo-my{
      color:#ffd83d !important;
    }

    .mybets-logo-bets{
      color:#fff !important;
    }

    .mybets-logo-line{
      display:block !important;
      width:100% !important;
      height:5px !important;
      margin-top:6px !important;
      border-radius:999px !important;
      background:linear-gradient(90deg,transparent 0%,#ffd83d 12%,#ffd83d 88%,transparent 100%) !important;
      box-shadow:0 1px 7px rgba(255,216,61,.45) !important;
    }

    .mybets-admin-logo .mybets-logo-main{
      font-size:30px !important;
    }

    .mybets-admin-logo .mybets-logo-line{
      height:4px !important;
      margin-top:5px !important;
    }

    .mybets-admin-label{
      margin-left:10px !important;
      color:#aaa !important;
      font-size:.55em !important;
      font-weight:800 !important;
      letter-spacing:2px !important;
      text-transform:uppercase !important;
      vertical-align:middle !important;
    }
  `;
  document.head.appendChild(style);

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', standardize);
  }else{
    standardize();
  }
})();

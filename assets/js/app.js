(() => {
  'use strict';
  const config = window.MOCHI || {};
  const $ = (selector) => document.querySelector(selector);
  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const externalURL = (value) => {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; }
    catch { return ''; }
  };
  const imageURL = (value) => {
    if (!value || typeof value !== 'string') return '';
    if (/^https?:\/\//i.test(value)) return externalURL(value);
    return !/^(?:[a-z][a-z\d+.-]*:|\/|\\)/i.test(value) ? value : '';
  };
  const outbound = (node, url) => {
    node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer';
  };
  const fallback = 'assets/images/placeholder.svg';
  const picture = (src, alt) => {
    const img = create('img'); img.src = imageURL(src) || fallback; img.alt = alt || ''; img.loading = 'lazy'; img.decoding = 'async';
    img.addEventListener('error', () => { img.src = fallback; }, { once: true });
    return img;
  };
  // 外部背景の設定は画像URLとして扱い、CSS文字列へ連結しません。
  const background = imageURL(config.visuals?.background);
  if (background) {
    const img = picture(background, ''); img.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;opacity:.2;pointer-events:none';
    document.body.prepend(img);
  }
  const stars = $('.stars');
  if (stars) for (let i = 0; i < 45; i++) {
    const star = create('i', 'star');
    star.style.left = `${(i * 37 + 3) % 100}%`; star.style.top = `${(i * 23 + 7) % 100}%`; star.style.animationDelay = `${-(i % 7)}s`;
    stars.append(star);
  }
  const hero = $('.hero-art');
  if (hero) { hero.src = imageURL(config.visuals?.hero) || 'assets/images/star-ocean.svg'; hero.alt = config.visuals?.heroAlt || ''; }
  const socialItem = (item, compact = false) => {
    const url = externalURL(item.url);
    const node = create(url ? 'a' : 'div', `social${url ? '' : ' is-pending'}`);
    if (url) { outbound(node, url); node.setAttribute('aria-label', `${item.name}：${item.label}（新しいタブで開く）`); }
    const symbol = create('span','social-symbol',item.symbol); symbol.setAttribute('aria-hidden','true'); node.append(symbol);
    const copy = create('span'); copy.append(create('b','',item.name));
    if (!compact) copy.append(create('small','',url ? item.label : '準備中'));
    node.append(copy);
    if (url) { const arrow = create('span','external','↗'); arrow.setAttribute('aria-hidden','true'); node.append(arrow); }
    return node;
  };
  document.querySelectorAll('[data-socials]').forEach((container) => {
    const compact = container.dataset.socials === 'compact';
    (config.socials || []).filter(item => !compact || externalURL(item.url)).forEach(item => container.append(socialItem(item,compact)));
  });
  const shopLink = $('[data-shop-link]');
  if (shopLink) { const booth = (config.socials || []).find(item => item.id === 'booth'); if (booth) shopLink.append(socialItem(booth)); }
  const bio = $('[data-bio]');
  if (bio) {
    bio.textContent = config.profile?.introduction || '自己紹介は準備中です。';
    const date = $('[data-started]');
    const started = config.profile?.started || '2021-02-26';
    const [y,m,d] = started.split('-'); date.textContent = `${y}年${Number(m)}月${Number(d)}日`; date.dateTime = started;
    const portrait = $('[data-portrait]');
    if (imageURL(config.profile?.image)) { portrait.replaceChildren(picture(config.profile.image,config.profile.imageAlt)); portrait.classList.add('has-image'); }
  }
  const news = $('[data-news]');
  if (news) {
    const items = [...(window.MOCHI_NEWS || [])].sort((a,b) => String(b.date).localeCompare(String(a.date))).slice(0,5);
    if (items.length) {
      news.className = 'news-list'; news.replaceChildren();
      items.forEach(item => {
        const row = create('li'); const date = create('time','',String(item.date).replaceAll('-','.')); date.dateTime = item.date;
        row.append(date); const url = externalURL(item.url); const title = create(url ? 'a' : 'span','',item.title);
        if (url) outbound(title,url); row.append(title);
        if (item.description) row.append(create('p','',item.description)); news.append(row);
      });
    }
  }
  const gallery = $('[data-gallery]');
  if (gallery) {
    const works = window.MOCHI_GALLERY || [];
    const filters = $('[data-filters]');
    const empty = $('[data-empty]');
    const dialog = $('#art-dialog');
    let opener;
    const close = () => dialog.close();
    $('.dialog-close').addEventListener('click',close);
    dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); } });
    dialog.addEventListener('close', () => { document.body.style.overflow = ''; if (opener?.isConnected) opener.focus(); });
    const open = (work,button) => {
      opener = button; const img = picture(work.image,work.alt || work.title); img.className = 'dialog-image'; img.loading = 'eager';
      $('.dialog-image').replaceWith(img); $('#art-title').textContent = work.title; $('#art-description').textContent = work.description || '';
      dialog.showModal(); document.body.style.overflow = 'hidden'; $('.dialog-close').focus();
    };
    const render = (category) => {
      const items = category === 'すべて' ? works : works.filter(work => work.category === category);
      gallery.replaceChildren(); empty.hidden = items.length > 0;
      $('[data-count]').textContent = `${String(items.length).padStart(2,'0')} WORKS`;
      items.forEach(work => {
        const card = create('article','work-card'); const button = create('button'); button.type = 'button'; button.setAttribute('aria-label',`${work.title}を拡大表示`);
        button.append(picture(work.image,work.alt || work.title)); const copy = create('div','card-copy'); copy.append(create('span','tag',work.category || '作品'),create('h2','',work.title));
        if (work.description) copy.append(create('p','',work.description)); button.append(copy); button.addEventListener('click',() => open(work,button)); card.append(button); gallery.append(card);
      });
    };
    const categories = ['すべて', ...new Set(['イラスト','ドット絵',...works.map(item => item.category).filter(Boolean)])];
    categories.forEach((category,index) => {
      const button = create('button','filter',category); button.type = 'button'; button.setAttribute('aria-pressed',String(index === 0));
      button.addEventListener('click',() => { filters.querySelectorAll('button').forEach(node => node.setAttribute('aria-pressed',String(node === button))); render(category); }); filters.append(button);
    });
    render('すべて');
  }
  const collection = $('[data-collection]');
  if (collection) {
    const games = collection.dataset.collection === 'games'; const items = (games ? window.MOCHI_GAMES : window.MOCHI_SHOP) || [];
    $('[data-empty]').hidden = items.length > 0;
    items.forEach(item => {
      const card = create('article','work-card'); card.append(picture(item.image,item.title));
      const copy = create('div','card-copy'); copy.append(create('span','tag',(games ? item.status : item.category) || '準備中'),create('h2','',item.title),create('p','',item.description || ''));
      const url = externalURL(item.url);
      if (url) { const link = create('a','button secondary',games ? 'ゲームの公開先へ ↗' : '販売ページへ ↗'); outbound(link,url); link.setAttribute('aria-label',`${item.title}の${games ? '公開先' : '販売ページ'}（新しいタブで開く）`); copy.append(link); }
      else copy.append(create('p','subtle',games ? '公開先は準備中です。' : '販売ページは準備中です。'));
      card.append(copy); collection.append(card);
    });
  }
})();

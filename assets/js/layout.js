/* 公開表示とローカル編集画面で共用する、依存ライブラリ不要のレイアウトエンジン。 */
(() => {
  'use strict';
  const types = ['text','heading','link','image','panel','widget'];
  const fonts = {
    sans: "'Yu Gothic','Hiragino Kaku Gothic ProN',Meiryo,sans-serif",
    serif: "'Yu Mincho','Hiragino Mincho ProN',serif",
    mono: "'Courier New',Meiryo,monospace",
    rounded: "'Arial Rounded MT Bold','Yu Gothic',sans-serif"
  };
  const color = value => typeof value === 'string' && /^(#[0-9a-f]{3,8}|transparent)$/i.test(value);
  const safeImage = value => typeof value === 'string' && (value === '' || /^data:image\/(png|jpeg|webp|gif);base64,[a-z\d+/=\s]+$/i.test(value) || /^assets\/images\/[a-z\d_./ -]+\.(svg|png|jpe?g|webp|gif)$/i.test(value)) && !value.includes('..');
  const safeLink = value => {
    if (typeof value !== 'string' || !value) return '';
    if (/^https?:\/\//i.test(value)) { try { return new URL(value).href; } catch { return ''; } }
    return /^(?:[a-z\d_-]+\.html(?:[?#][a-z\d_=&%#.-]*)?|#[a-z\d_-]+)$/i.test(value) ? value : '';
  };
  const number = (value,min,max) => Number.isFinite(value) && value >= min && value <= max;
  function validate(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.pages) || data.pages.length > 50) throw Error('対応していないJSON形式です。version: 1 と pages 配列が必要です。');
    const ids = new Set();
    for (const page of data.pages) {
      if (!page || !/^[a-z][a-z\d-]{0,49}$/.test(page.id) || ids.has(page.id)) throw Error('ページIDが不正、または重複しています。'); ids.add(page.id);
      if (typeof page.title !== 'string' || page.title.length > 200 || typeof page.slug !== 'string' || !safeLink(page.slug) || /^(?:https?:|#)/i.test(page.slug)) throw Error('ページ名・URLが不正です。');
      if (!page.enabled || page.deleted) continue;
      if (!color(page.background) || !safeImage(page.backgroundImage || '')) throw Error('背景色または背景画像が不正です。');
      if (!page.height || !number(page.height.desktop,200,30000) || !number(page.height.mobile,200,30000)) throw Error('ページの高さは200〜30000pxで設定してください。');
      if (!Array.isArray(page.elements) || page.elements.length > 1500) throw Error('要素数が多すぎるか、形式が不正です。');
      const elementIds = new Set();
      for (const item of page.elements) {
        if (!item || typeof item.id !== 'string' || !/^[a-z\d_-]{1,80}$/i.test(item.id) || elementIds.has(item.id) || !types.includes(item.type)) throw Error('要素IDまたは種類が不正です。'); elementIds.add(item.id);
        for (const mode of ['desktop','mobile']) {
          const box = item[mode]; if (!box || !number(box.x,-5000,30000) || !number(box.y,-5000,30000) || !number(box.w,1,10000) || !number(box.h,1,30000)) throw Error('要素の座標・サイズが不正です。');
        }
        if (item.text !== undefined && (typeof item.text !== 'string' || item.text.length > 30000)) throw Error('テキストが長すぎます。');
        if (item.type === 'widget' && !['news','compact','gallery','games','shop','links'].includes(item.widget)) throw Error('データパーツの種類が不正です。');
        if (!safeImage(item.src || '')) throw Error('画像はPNG/JPEG/WebP/GIFの埋め込み、またはassets/images内のファイルを指定してください。');
        if (item.href && !safeLink(item.href)) throw Error('リンク先はhttps://から始まるURL、またはサイト内のHTMLを指定してください。');
        const style = item.style || {};
        for (const key of ['color','background','borderColor']) if (style[key] !== undefined && !color(style[key])) throw Error('色は #rrggbb 形式で指定してください。');
        for (const [key,min,max] of [['fontSize',8,300],['lineHeight',.8,5],['radius',0,1000],['borderWidth',0,30],['padding',0,200],['paddingLeft',0,200],['paddingTop',0,200],['opacity',0,1],['z',-1000,10000]]) if (style[key] !== undefined && !number(style[key],min,max)) throw Error(`スタイル ${key} の数値が範囲外です。`);
        if (style.font && !fonts[style.font]) throw Error('フォントの指定が不正です。');
        if (style.align && !['left','center','right'].includes(style.align)) throw Error('文字の配置が不正です。');
      }
    }
    if (!data.pages.some(page => page.id === 'home' && !page.deleted)) throw Error('ホームページは削除できません。');
    return data;
  }
  const sourceURL = (src,base) => src.startsWith('data:') ? src : new URL(src,base).href;
  function apply(node,item,mode) {
    const box = item[mode]; const s = item.style || {};
    node.hidden = !!box.hidden;
    Object.assign(node.style,{
      left:`${box.x}px`,top:`${box.y}px`,width:`${box.w}px`,height:`${box.h}px`,
      color:s.color || '#f2f5ff',background:s.background || 'transparent',fontFamily:fonts[s.font] || fonts.sans,
      fontSize:`${s.fontSize || 16}px`,fontWeight:s.bold ? '700' : '400',lineHeight:s.lineHeight || 1.7,
      textAlign:s.align || 'left',justifyContent: s.align === 'center' ? 'center' : s.align === 'right' ? 'flex-end' : 'flex-start',
      padding:`${s.padding || 0}px`,paddingLeft:`${s.paddingLeft ?? s.padding ?? 0}px`,paddingTop:`${s.paddingTop ?? s.padding ?? 0}px`,alignItems:s.vertical==='bottom'?'flex-end':s.vertical==='top'?'flex-start':'center',border:`${s.borderWidth || 0}px solid ${s.borderColor || 'transparent'}`,borderRadius:`${s.radius || 0}px`,
      opacity:s.opacity ?? 1,zIndex:s.z || 0,objectFit:s.fit === 'cover' ? 'cover' : 'contain'
    });
    node.classList.toggle('pixel',!!item.pixel);
  }
  function element(item,mode,base = document.baseURI) {
    const tag = {text:'p',heading:item.level === 1 ? 'h1' : 'h2',link:'a',image:'img',panel:'div',widget:'div'}[item.type];
    const node = document.createElement(tag); node.className = `layout-element kind-${item.type}`; node.dataset.elementId = item.id;
    if (item.type === 'image') {
      node.src = sourceURL(item.src || 'assets/images/placeholder.svg',base); node.alt = item.alt || ''; node.loading = item[mode].y > 850 ? 'lazy' : 'eager'; node.decoding = 'async';
      node.addEventListener('error',() => { node.src = new URL('assets/images/placeholder.svg',base).href; },{once:true});
    } else if (item.type === 'widget') {
      const frame = document.createElement('iframe');
      frame.src = new URL(`widgets.html?widget=${item.widget}`,base).href;
      frame.title = item.name || '活動情報'; frame.loading = 'lazy'; node.append(frame);
    } else if (item.type !== 'panel') node.textContent = item.text || '';
    if (item.type === 'link') {
      const href = safeLink(item.href);
      if (href) { node.href = /^https?:/.test(href) ? href : href.startsWith('#') ? href : new URL(href,base).href; if (/^https?:/.test(href)) { node.target = '_blank'; node.rel = 'noopener noreferrer'; node.setAttribute('aria-label',`${item.text}（新しいタブで開く）`); } }
      else { node.setAttribute('aria-disabled','true'); }
    }
    if (item.type === 'panel') node.setAttribute('aria-hidden','true');
    apply(node,item,mode); return node;
  }
  function render(stage,page,mode,base) {
    stage.replaceChildren(); stage.className = 'layout-stage'; stage.style.width = `${mode === 'desktop' ? 1200 : 390}px`; stage.style.height = `${page.height[mode]}px`; stage.style.backgroundColor = page.background;
    stage.style.backgroundImage = page.backgroundImage ? `url("${sourceURL(page.backgroundImage,base || document.baseURI)}")` : 'none'; stage.style.backgroundSize = 'cover'; stage.style.backgroundPosition = 'center top';
    // DOM順序を視覚的な読み順に合わせ、キーボード移動・読み上げでも上から順にたどります。
    [...page.elements].sort((a,b) => a[mode].y-b[mode].y || a[mode].x-b[mode].x).forEach(item => stage.append(element(item,mode,base)));
  }
  window.LayoutKit = {validate,render,element,apply,safeImage,safeLink,fonts};
  if (!document.querySelector('#custom-layout') || new URLSearchParams(location.search).has('baseline')) return;
  async function load() {
    try {
      const response = await fetch('data/layout.json'); if (!response.ok) throw Error(`HTTP ${response.status}`);
      const data = validate(await response.json());
      const id = document.body.dataset.page || new URLSearchParams(location.search).get('page');
      const page = data.pages.find(item => item.id === id);
      document.querySelectorAll('.menu').forEach(menu => {
        data.pages.filter(p => p.deleted).forEach(p => menu.querySelectorAll('a').forEach(a => { if (a.getAttribute('href') === p.slug) a.remove(); }));
        data.pages.filter(p => !p.deleted && p.slug.startsWith('page.html?')).forEach(p => { const a = document.createElement('a'); a.href=p.slug; const span=document.createElement('span'); span.textContent=p.title; a.append(span); menu.append(a); });
      });
      const custom = document.querySelector('#custom-layout');
      if (page?.deleted || (!page && !document.body.dataset.page)) {
        document.querySelector('#site-shell').hidden = true; custom.hidden = false; custom.className = 'layout-notice';
        const h = document.createElement('h1'); h.textContent = 'このページは見つかりませんでした。'; const a = document.createElement('a'); a.href='index.html'; a.textContent='ホームへ戻る'; custom.append(h,a); return;
      }
      if (!page?.enabled) return;
      document.querySelector('#site-shell').hidden = true; custom.hidden = false; document.body.classList.add('custom-active');
      document.body.style.backgroundColor = page.background;
      document.title = `${page.title} | もっちーもちもち`;
      if (page.description) document.querySelector('meta[name="description"]')?.setAttribute('content',page.description);
      document.querySelector('.skip')?.setAttribute('href','#custom-layout'); custom.tabIndex=-1;
      const stage = document.createElement('div'); custom.append(stage);
      let previousMode;
      const resize = () => {
        const viewport = document.documentElement.clientWidth; const mode = viewport <= 900 ? 'mobile' : 'desktop';
        const width = mode === 'mobile' ? Math.min(viewport,600) : Math.min(viewport,1440); const scale = width/(mode === 'desktop' ? 1200 : 390);
        if (previousMode !== mode) { render(stage,page,mode); previousMode=mode; }
        stage.style.transform = `scale(${scale})`; custom.style.width=`${width}px`; custom.style.height=`${page.height[mode]*scale}px`;
      };
      resize(); window.addEventListener('resize',resize);
    } catch (error) {
      // 標準ページはデータ読み込み失敗時も利用できる。カスタムページは説明を表示する。
      if (!document.body.dataset.page) { const main=document.querySelector('#site-shell'); main.textContent='ページの読み込みに失敗しました。再読み込みしてください。'; }
      if (location.protocol !== 'file:') console.warn('レイアウトを読み込めないため標準表示を使用します。',error.message);
    }
  }
  load();
})();

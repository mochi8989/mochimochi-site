(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const kit = window.LayoutKit;
  const BASE = new URL('../',location.href).href;
  const STORAGE = 'mochimochi-layout-draft-v1';
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => `e-${crypto.randomUUID()}`;
  let data, pageId='home', mode='desktop', selectedId=null, zoom=1, preview=false, busy=false, exported=true;
  let undo=[],redo=[],gesture=null;
  const page = () => data.pages.find(p => p.id===pageId);
  const selected = () => page()?.elements?.find(e => e.id===selectedId);
  const status = text => { $('status').textContent=text; };
  const safeColor = (value,fallback='#f2f5ff') => {
    if (!value || value==='transparent' || value==='rgba(0, 0, 0, 0)') return 'transparent';
    if (/^#[a-f\d]{6}$/i.test(value)) return value;
    const parts=value.match(/[\d.]+/g); return parts?.length>=3 ? '#'+parts.slice(0,3).map(v=>Math.round(Number(v)).toString(16).padStart(2,'0')).join('') : fallback;
  };
  function checkpoint() {
    undo.push(JSON.stringify({data,pageId,selectedId})); if (undo.length>50) undo.shift(); redo=[];
  }
  function saveDraft(message='変更をこのブラウザに一時保存しました。') {
    exported=false;
    try { localStorage.setItem(STORAGE,JSON.stringify(data)); status(message); }
    catch { status('一時保存の容量を超えました。JSONを書き出して保存してください。'); }
    updateHistory();
  }
  function mutate(action,message) { if (busy || !data) return; checkpoint(); action(); render(); saveDraft(message); }
  function updateHistory() { $('undo').disabled=!undo.length; $('redo').disabled=!redo.length; }
  function travel(from,to) {
    if (!from.length || busy) return;
    to.push(JSON.stringify({data,pageId,selectedId})); const state=JSON.parse(from.pop());
    data=state.data;pageId=state.pageId;selectedId=state.selectedId; render(); saveDraft('操作を戻しました。');
  }
  function fit() {
    if (!page()?.height) return;
    const width=mode==='desktop'?1200:390;
    zoom=Math.min(1,Math.max(.12,($('canvas-scroll').clientWidth-48)/width));
    $('canvas').style.transform=`scale(${zoom})`;
    $('canvas-wrap').style.width=`${width*zoom}px`;
    $('canvas-wrap').style.height=`${page().height[mode]*zoom}px`;
    $('zoom').textContent=`${Math.round(zoom*100)}% · ${width}px`;
    drawSelection();
  }
  function drawSelection() {
    const item=selected(); const el=$('selection'); el.hidden=!item || preview || !!item[mode].hidden;
    if (item) { const b=item[mode]; Object.assign(el.style,{left:`${b.x*zoom}px`,top:`${b.y*zoom}px`,width:`${b.w*zoom}px`,height:`${b.h*zoom}px`}); $('selection-name').textContent=item.name || item.text?.slice(0,30) || item.type; }
  }
  function render() {
    const p=page(); if (!p?.elements) return;
    kit.render($('canvas'),p,mode,BASE); $('canvas').classList.toggle('preview',preview);
    $('pages').replaceChildren(); data.pages.filter(p=>!p.deleted).forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.title;$('pages').append(o);}); $('pages').value=pageId;
    $('page-title').value=p.title; $('page-description').value=p.description || ''; $('page-background').value=p.background; $('page-height').value=p.height[mode]; $('theme').value=p.theme || 'starry';
    $('delete-page').disabled=pageId==='home';
    $('layers').replaceChildren();
    [...p.elements].sort((a,b)=>(b.style?.z||0)-(a.style?.z||0)).forEach(item=>{
      const button=document.createElement('button');button.textContent=`${item[mode].hidden?'◌':'◇'} ${item.name || item.text?.slice(0,24) || item.type}`;button.classList.toggle('selected',item.id===selectedId);button.setAttribute('aria-pressed',String(item.id===selectedId));button.addEventListener('click',()=>select(item.id));$('layers').append(button);
    });
    fit(); inspect(); updateHistory();
  }
  function select(id) { selectedId=id;inspect();drawSelection();$('layers').querySelectorAll('button').forEach((node,i)=>{ const item=[...page().elements].sort((a,b)=>(b.style?.z||0)-(a.style?.z||0))[i];node.classList.toggle('selected',item.id===id);node.setAttribute('aria-pressed',String(item.id===id));}); }
  function inspect() {
    const item=selected(); $('inspector').hidden=!item; $('no-selection').hidden=!!item; if (!item) return;
    document.querySelectorAll('.for-copy').forEach(el=>el.hidden=!['text','heading','link'].includes(item.type));
    document.querySelectorAll('.for-image').forEach(el=>el.hidden=item.type!=='image'); document.querySelectorAll('.for-link').forEach(el=>el.hidden=item.type!=='link');
    for (const key of ['name','text','href','alt']) $('element-'+key).value=item[key] || '';
    for (const key of ['x','y','w','h']) $('element-'+key).value=Math.round(item[mode][key]);
    $('element-pixel').checked=!!item.pixel;$('element-hidden').checked=!!item[mode].hidden;
    const s=item.style || {}; const defaults={font:'pixel',fontSize:16,color:'#f2f5ff',align:'left',background:'#000000',radius:0,borderColor:'#344d71',borderWidth:0,z:0,fit:'contain'};
    Object.entries(defaults).forEach(([key,fallback])=>{$('element-'+key).value=s[key]==='transparent'?fallback:s[key]??fallback;});
    $('element-bold').checked=!!s.bold;
    $('element-bold').disabled=(s.font || 'pixel')==='pixel';
    $('element-bold').title=(s.font || 'pixel')==='pixel'?'ドット書体はRegularの形を保つため、太字合成を行いません。':'';
  }
  function newElement(type,overrides={}) {
    const y=Math.round(($('canvas-scroll').scrollTop+45)/zoom);
    const base={id:uid(),type,name:{heading:'見出し',text:'テキスト',image:'画像',link:'リンクボタン',panel:'装飾パネル'}[type],text:type==='heading'?'新しい見出し':type==='text'?'ここにテキストを入力します。':type==='link'?'ホームへ戻る':'',href:type==='link'?'index.html':'',level:2,
      desktop:{x:300,y:mode==='desktop'?y:page().height.desktop+24,w:type==='panel'?300:360,h:type==='image'?180:type==='panel'?160:80},
      mobile:{x:24,y:mode==='mobile'?y:page().height.mobile+24,w:342,h:type==='image'?180:type==='panel'?160:80},
      style:{font:'pixel',fontSize:type==='heading'?30:18,bold:type==='heading'||type==='link',color:'#f2f5ff',background:type==='panel'?'#263d61':type==='link'?'#365bd1':'transparent',borderColor:'#6884b0',borderWidth:type==='link'?1:0,radius:type==='link'?8:0,padding:type==='link'?14:0,lineHeight:1.7,z:Math.max(0,...page().elements.map(e=>e.style?.z||0))+1},...overrides};
    return base;
  }
  function fitAdded(item){for(const m of ['desktop','mobile'])page().height[m]=Math.min(30000,Math.max(page().height[m],item[m].y+item[m].h+40));}
  function add(type,overrides) { mutate(()=>{const item=newElement(type,overrides);page().elements.push(item);fitAdded(item);selectedId=item.id;},'パーツを追加しました。もう一方の表示ではページ下部に追加しています。'); }
  function field(id,fn) { $(id).addEventListener('change',event=>{ if (!selected()) return; mutate(()=>fn(selected(),event.target)); }); }
  ['name','text','alt'].forEach(key=>field('element-'+key,(item,input)=>{item[key]=input.value;}));
  $('element-href').addEventListener('change',()=>{const input=$('element-href');if(!selected())return;if(input.value&&!kit.safeLink(input.value)){status('リンクは https://… または profile.html の形式で指定してください。');return;}mutate(()=>{selected().href=input.value;});});
  ['x','y','w','h'].forEach(key=>field('element-'+key,(item,input)=>{item[mode][key]=Math.min(Number(input.max),Math.max(Number(input.min),Number(input.value)||Number(input.min)));}));
  ['font','align','fit','color','background','borderColor'].forEach(key=>field('element-'+key,(item,input)=>{item.style[key]=input.value;}));
  ['fontSize','radius','borderWidth','z'].forEach(key=>field('element-'+key,(item,input)=>{item.style[key]=Math.min(Number(input.max),Math.max(Number(input.min),Number(input.value)||0));}));
  field('element-pixel',(item,input)=>{item.pixel=input.checked;});field('element-bold',(item,input)=>{item.style.bold=input.checked;});field('element-hidden',(item,input)=>{item[mode].hidden=input.checked;});
  // 入力中もプレビューを即時更新。履歴は変更確定時にまとめて記録する。
  ['element-text','element-color','element-background','element-fontSize'].forEach(id=>$(id).addEventListener('input',()=>{
    const item=selected();if(!item)return;const temporary=clone(item);const key=id.replace('element-','');
    if(key==='text') temporary.text=$(id).value;else temporary.style[key]=key==='fontSize'?Math.max(8,Math.min(300,Number($(id).value)||16)):$(id).value;
    const node=$('canvas').querySelector(`[data-element-id="${item.id}"]`);if(node)node.replaceWith(kit.element(temporary,mode,BASE));
  }));
  $('transparent').onclick=()=>mutate(()=>{if(selected())selected().style.background='transparent';});
  $('forward').onclick=()=>mutate(()=>{if(selected())selected().style.z=Math.min(10000,Math.max(...page().elements.map(e=>e.style?.z||0))+1);});
  $('backward').onclick=()=>mutate(()=>{if(selected())selected().style.z=Math.max(-1000,Math.min(...page().elements.map(e=>e.style?.z||0))-1);});
  $('duplicate').onclick=()=>{if(!selected())return;mutate(()=>{const item=clone(selected());item.id=uid();item.name=(item.name||'パーツ')+' コピー';for(const m of ['desktop','mobile']){item[m].x+=16;item[m].y+=16;}page().elements.push(item);selectedId=item.id;});};
  function remove(){if(!selected())return;mutate(()=>{page().elements=page().elements.filter(e=>e.id!==selectedId);selectedId=null;});}
  $('delete').onclick=remove;$('undo').onclick=()=>travel(undo,redo);$('redo').onclick=()=>travel(redo,undo);
  document.querySelectorAll('[data-add]').forEach(button=>button.onclick=()=>add(button.dataset.add));
  $('add-menu').onclick=()=>mutate(()=>{
    const current=page();data.pages.filter(p=>!p.deleted).forEach((p,i)=>{const item=newElement('link',{name:`メニュー / ${p.title}`,text:p.title,href:p.slug});item.desktop={x:40,y:160+i*60,w:200,h:48};item.mobile={x:24,y:100+i*54,w:342,h:44};current.elements.push(item);});
  },'ページ一覧へのメニューを追加しました。');
  $('page-title').onchange=()=>mutate(()=>{page().title=$('page-title').value.trim()||'名称未設定';});
  $('page-description').onchange=()=>mutate(()=>{page().description=$('page-description').value;});
  $('page-background').onchange=()=>mutate(()=>{page().background=$('page-background').value;});
  $('page-height').onchange=()=>mutate(()=>{page().height[mode]=Math.max(200,Math.min(30000,Number($('page-height').value)||1200));});
  $('clear-background').onclick=()=>mutate(()=>{page().backgroundImage='';});
  $('pixel-page').onclick=()=>mutate(()=>{page().elements.filter(item=>['text','heading','link'].includes(item.type)).forEach(item=>{item.style.font='pixel';});},'このページの文字をドットゴシックに変更しました。');
  const themes={starry:{bg:'#0b142c',panel:'#182849',text:'#f2f5ff',button:'#a8daff',buttonText:'#10213b'},paper:{bg:'#f7f2e8',panel:'#e9e0cf',text:'#362e29',button:'#655044',buttonText:'#fffaf0'},garden:{bg:'#edf1e8',panel:'#d5e1d1',text:'#294737',button:'#3b6d51',buttonText:'#f2fff7'},pop:{bg:'#f0eaff',panel:'#dfd3fa',text:'#413369',button:'#7951c4',buttonText:'#ffffff'}};
  $('theme').onchange=()=>mutate(()=>{const theme=themes[$('theme').value];page().theme=$('theme').value;page().background=theme.bg;page().elements.forEach(item=>{item.style.color=item.type==='link'?theme.buttonText:theme.text;if(item.type==='panel')item.style.background=theme.panel;if(item.type==='link'){item.style.background=theme.button;item.style.radius=$('theme').value==='starry'?0:10;}if(item.role==='hero-art'){item.desktop.hidden=$('theme').value!=='starry';item.mobile.hidden=$('theme').value!=='starry';}});},'テーマを適用しました。明るいテーマでは初期の星空画像を隠しています。画像は個別に変更できます。');
  for(const m of ['desktop','mobile'])$(m).onclick=()=>{mode=m;selectedId=null;for(const n of ['desktop','mobile'])$(n).setAttribute('aria-pressed',String(n===mode));render();};
  $('preview').onclick=()=>{preview=!preview;$('preview').setAttribute('aria-pressed',String(preview));$('preview').textContent=preview?'✎ 編集に戻る':'▶ 閲覧プレビュー';$('hint').textContent=preview?'公開表示のプレビューです。リンクは新しいタブで確認できます。':'クリックで選択、ドラッグで移動。右下のハンドルでサイズ変更。PCとスマホの配置は個別に保存します。';render();};
  function startGesture(event,resize=false) {
    if(preview||busy||event.button!==0)return;
    const target=event.target.closest('[data-element-id]');if(!resize&&!target)return;
    if(!resize)select(target.dataset.elementId);const item=selected();if(!item)return;
    event.preventDefault();checkpoint();gesture={id:item.id,x:event.clientX,y:event.clientY,box:clone(item[mode]),resize};
    document.addEventListener('pointermove',moveGesture);document.addEventListener('pointerup',endGesture,{once:true});document.addEventListener('pointercancel',endGesture,{once:true});
  }
  function moveGesture(event){if(!gesture)return;const item=selected();const b=item[mode];const g=gesture;const dx=(event.clientX-g.x)/zoom,dy=(event.clientY-g.y)/zoom;
    const snap=value=>$('snap').checked?Math.round(value/8)*8:Math.round(value);
    if(g.resize){b.w=Math.min(10000,Math.max(8,snap(g.box.w+dx)));b.h=Math.min(30000,Math.max(8,snap(g.box.h+dy)));}
    else{b.x=Math.max(-5000,Math.min(30000,snap(g.box.x+dx)));b.y=Math.max(-5000,Math.min(30000,snap(g.box.y+dy)));}
    const node=$('canvas').querySelector(`[data-element-id="${item.id}"]`);if(node)kit.apply(node,item,mode);drawSelection();inspect();
  }
  function endGesture(){if(!gesture)return;gesture=null;document.removeEventListener('pointermove',moveGesture);document.removeEventListener('pointerup',endGesture);document.removeEventListener('pointercancel',endGesture);render();saveDraft();}
  $('canvas').addEventListener('pointerdown',e=>startGesture(e));$('resize-handle').addEventListener('pointerdown',e=>startGesture(e,true));
  $('canvas').addEventListener('click',event=>{const a=event.target.closest('a');if(a){event.preventDefault();if(preview&&a.href)window.open(a.href,'_blank','noopener');}if(event.target===$('canvas'))select(null);});
  $('canvas-scroll').addEventListener('dragover',event=>{event.preventDefault();});
  $('canvas-scroll').addEventListener('drop',async event=>{event.preventDefault();if(!preview)await addImages(event.dataTransfer.files);});
  window.addEventListener('keydown',event=>{
    if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)||$('page-dialog').open)return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?travel(redo,undo):travel(undo,redo);return;}
    if(preview)return;if(event.key==='Delete'||event.key==='Backspace'){if(selected()){event.preventDefault();remove();}}
    if(event.key==='Escape')select(null);
    if(selected()&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();mutate(()=>{const b=selected()[mode];const step=event.shiftKey?10:1;if(event.key==='ArrowLeft')b.x-=step;if(event.key==='ArrowRight')b.x+=step;if(event.key==='ArrowUp')b.y-=step;if(event.key==='ArrowDown')b.y+=step;});}
  });
  async function readImage(file){
    if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type))throw Error('PNG・JPEG・WebP・GIF画像を選んでください。');
    if(file.size>5*1024*1024)throw Error('1枚5MB以下の画像を選んでください。');
    const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('画像を読めませんでした。'));reader.readAsDataURL(file);});
    const img=new Image();img.src=src;await img.decode();return{src,width:img.naturalWidth,height:img.naturalHeight};
  }
  async function addImages(files){for(const file of files){try{const img=await readImage(file);mutate(()=>{const item=newElement('image',{src:img.src,alt:file.name.replace(/\.[^.]+$/,''),name:file.name,pixel:file.type==='image/png'});for(const m of ['desktop','mobile']){item[m].w=Math.min(m==='desktop'?360:300,img.width);item[m].h=Math.max(8,Math.round(item[m].w*img.height/img.width));}page().elements.push(item);fitAdded(item);selectedId=item.id;},'画像を追加しました。画像データもJSONに保存されます。');}catch(error){status(error.message);}}}
  $('add-image').onclick=()=>$('image-file').click();$('image-file').onchange=async()=>{await addImages($('image-file').files);$('image-file').value='';};
  $('background-image').onclick=()=>$('background-file').click();$('background-file').onchange=async()=>{try{const file=$('background-file').files[0];if(!file)return;const img=await readImage(file);mutate(()=>{page().backgroundImage=img.src;});}catch(error){status(error.message);}finally{$('background-file').value='';}};
  $('replace-image').onclick=()=>$('replace-file').click();$('replace-file').onchange=async()=>{try{const file=$('replace-file').files[0];if(!file||!selected())return;const id=selectedId;const img=await readImage(file);mutate(()=>{const item=page().elements.find(e=>e.id===id);if(item)item.src=img.src;});}catch(error){status(error.message);}finally{$('replace-file').value='';}};

  // 標準HTMLをPC・スマホそれぞれの実寸で取り込み、すべてのパーツを編集要素に変換する。
  function capture(doc){
    const result=[];const root=doc.querySelector('#site-shell');const nodes=[...root.querySelectorAll('*')];
    const panels='.hero,.window,.destination,.portrait,.empty-state,.work-card,.quiet';
    const textSelector='h1,h2,h3,p,dt,dd,.window-title,.hero-coordinate,.header-note,.breadcrumb>span,.site-footer>span,.portrait>span,.tag,.collection-count,.brand small';
    nodes.forEach((node,index)=>{
      const rect=node.getBoundingClientRect();const css=doc.defaultView.getComputedStyle(node);if(!rect.width||!rect.height||css.visibility==='hidden')return;
      if(node.parentElement.closest('[data-widget]'))return;
      let type;if(node.hasAttribute('data-widget'))type='widget';else if(node.matches(panels)&&node.tagName!=='A')type='panel';else if(node.tagName==='A')type='link';else if(node.tagName==='IMG'||node.tagName.toLowerCase()==='svg')type='image';else if(node.matches(textSelector)&&(!node.closest('a')||node.matches('.brand small'))&&!node.parentElement.closest(textSelector))type=/^H[1-3]$/.test(node.tagName)?'heading':'text';else return;
      if(type==='link'&&node.parentElement.closest('a'))return;
      const text=(node.innerText||'').trim();if(['text','heading','link'].includes(type)&&!text)return;
      const box={x:Math.round(rect.x),y:Math.round(rect.y+doc.defaultView.scrollY),w:Math.max(1,Math.round(rect.width)),h:Math.max(1,Math.round(rect.height))};
      const item={id:`captured-${index}`,type,name:text.slice(0,30)||node.alt||'装飾',text,level:node.tagName==='H1'?1:2,box,style:{color:safeColor(css.color),background:type==='panel'||type==='link'?safeColor(css.backgroundColor):'transparent',font:/DotGothic16/.test(css.fontFamily)?'pixel':/Courier|monospace/.test(css.fontFamily)?'mono':'sans',fontSize:parseFloat(css.fontSize),bold:Number(css.fontWeight)>=600,lineHeight:Math.max(.8,Math.min(5,parseFloat(css.lineHeight)/parseFloat(css.fontSize)||1.7)),borderColor:safeColor(css.borderColor),borderWidth:parseFloat(css.borderTopWidth)||0,radius:parseFloat(css.borderRadius)||0,padding:0,align:['left','center','right'].includes(css.textAlign)?css.textAlign:'left',z:type==='panel'?0:type==='image'?1:3}};
      if(type==='link'){item.href=node.getAttribute('href')||'';item.style.padding=node.classList.contains('button')?9:node.closest('.menu')?8:0;item.style.fontSize=node.closest('.menu')?12:item.style.fontSize;if(node.classList.contains('destination')){item.style.background='#192a48';item.style.padding=16;item.style.fontSize=14;}if(node.classList.contains('brand'))item.style.fontSize=17;}
      if(type==='image'){const src=node.getAttribute('src')||'';if(!kit.safeImage(src))return;item.src=src;item.alt=node.alt;item.pixel=css.imageRendering==='pixelated';item.style.fit=css.objectFit==='cover'?'cover':'contain';if(node.classList.contains('hero-art'))item.style.z=1;}
      if(type==='image'&&node.tagName.toLowerCase()==='svg'){const href=node.closest('a')?.getAttribute('href');const key=href?.replace('.html','').replace('index','home');if(!['home','profile','gallery','games','shop','links'].includes(key))return;item.src=`assets/images/icon-${key}.svg`;item.alt='';item.pixel=true;item.style.z=4;}
      if(type==='panel')item.text='';
      if(node.classList.contains('hero-art'))item.role='hero-art';
      if(node.classList.contains('window-title')){item.style.paddingTop=parseFloat(css.paddingTop)||0;item.style.paddingLeft=parseFloat(css.paddingLeft)||0;}
      if(node.classList.contains('button'))item.text=text.replace(/\s+/g,' ');
      if(node.classList.contains('header-note'))item.text=text.replace(/\s+/g,' ');
      if(node.classList.contains('brand')){const strong=node.querySelector('strong');const r=strong.getBoundingClientRect();item.text=strong.textContent;item.box={x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};item.style.fontSize=parseFloat(doc.defaultView.getComputedStyle(strong).fontSize);item.style.bold=true;}
      if(node.closest('.menu')&&type==='link'){item.style.padding=9;item.style.paddingLeft=42;}
      if(node.classList.contains('destination')){item.text=text.replace(/^↗\s*/,'');item.style.vertical='bottom';item.style.fontSize=13;}
      if(type==='widget'){item.widget=node.dataset.widget;item.name=`活動データ / ${item.widget}`;item.style.background='transparent';item.style.borderWidth=0;item.text='';}
      result.push(item);
    });return result;
  }
  const frames=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  async function importBaseline(p){
    busy=true;status('標準デザインをPC・スマホ別に取り込んでいます…');
    try{
      const frame=$('baseline-frame');frame.style.width='1200px';
      await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('標準ページを読み込めませんでした。ローカルサーバーで起動してください。')),15000);frame.onload=()=>{clearTimeout(timeout);resolve();};frame.onerror=()=>{clearTimeout(timeout);reject(Error('ページ読み込みに失敗しました。'));};frame.src=new URL(p.slug+'?baseline=1',BASE).href;});
      await frames();const doc=frame.contentDocument;
      // 画面外の取り込み用iframeでは遅延画像が表示領域に入らないため、ここだけ先に読み込む。
      [...doc.images].forEach(img=>{img.loading='eager';});
      await Promise.all([...doc.images].map(img=>img.decode().catch(()=>{})));
      await doc.fonts.ready;await document.fonts.load('16px DotGothic16');await frames();
      const desktop=capture(doc);const desktopHeight=Math.max(doc.body.scrollHeight,doc.documentElement.scrollHeight);
      frame.style.width='390px';await frames();const mobile=capture(doc);const mobileHeight=Math.max(doc.body.scrollHeight,doc.documentElement.scrollHeight);
      const elements=desktop.map(item=>{const small=mobile.find(e=>e.id===item.id);const {box,...rest}=item;return{...rest,desktop:box,mobile:small?.box||{x:0,y:0,w:100,h:50,hidden:true}};});
      mobile.filter(item=>!desktop.some(e=>e.id===item.id)).forEach(item=>{const{box,...rest}=item;elements.push({...rest,mobile:box,desktop:{x:0,y:0,w:100,h:50,hidden:true}});});
      Object.assign(p,{enabled:true,background:'#0b142c',backgroundImage:'',theme:'starry',height:{desktop:Math.ceil(desktopHeight),mobile:Math.ceil(mobileHeight)},elements});
      // 見出しがスマホで収まるよう文字サイズを保守的に調整。位置と枠は各画面専用。
      p.elements.filter(e=>e.type==='heading').forEach(e=>{e.style.fontSize=Math.min(e.style.fontSize,35);});
      kit.validate(data);status('標準デザインを取り込みました。パーツをクリックして編集できます。');
    }finally{busy=false;}
  }
  $('pages').onchange=async()=>{
    const next=$('pages').value;if(busy)return;checkpoint();pageId=next;selectedId=null;
    try{if(!page().enabled)await importBaseline(page());render();saveDraft('ページを切り替えました。');}catch(error){status(error.message);}
  };
  $('reset-page').onclick=async()=>{
    if(busy)return;if(!confirm('このページを標準デザインに戻します。変更は「戻す」で復元できます。'))return;
    checkpoint();try{if(page().slug.startsWith('page.html?')){page().elements=[];}else await importBaseline(page());selectedId=null;render();saveDraft('標準デザインに戻しました。');}catch(error){status(error.message);}
  };
  $('add-page').onclick=()=>$('page-dialog').showModal();
  $('page-dialog').addEventListener('close',()=>{if($('page-dialog').returnValue!=='create')return;mutate(()=>{
    const id='page-'+Date.now().toString(36);const title=$('new-page-title').value.trim()||'新しいページ';
    const p={id,title,slug:`page.html?page=${id}`,description:'',enabled:true,background:page().background,backgroundImage:'',theme:page().theme,height:{desktop:1000,mobile:1000},elements:[]};data.pages.push(p);pageId=id;selectedId=null;
    p.elements.push(newElement('heading',{name:'ページ見出し',text:title,level:1,desktop:{x:80,y:80,w:800,h:80},mobile:{x:24,y:60,w:342,h:90}}));
    p.elements.push(newElement('link',{text:'ホームへ戻る',href:'index.html',desktop:{x:80,y:200,w:240,h:55},mobile:{x:24,y:180,w:342,h:55}}));
    // 編集済みページに新ページへのリンクを追加。標準ページには公開レンダラーが自動で追加します。
    data.pages.filter(q=>q!==p&&q.enabled&&!q.deleted).forEach(q=>{const link=newElement('link',{text:title,href:p.slug,name:`追加ページ / ${title}`});link.desktop={x:80,y:q.height.desktop+20,w:240,h:50};link.mobile={x:24,y:q.height.mobile+20,w:342,h:50};q.height.desktop+=100;q.height.mobile+=100;q.elements.push(link);});
  },'ページを追加しました。各ページに移動リンクも追加しています。');});
  $('delete-page').onclick=()=>{if(pageId==='home'||!confirm('このページを削除します。操作は「戻す」で復元できます。'))return;mutate(()=>{const slug=page().slug;page().deleted=true;data.pages.forEach(p=>{if(p.elements)p.elements=p.elements.filter(e=>e.type!=='link'||e.href!==slug);});pageId='home';selectedId=null;},'ページと、そのページへのリンクを削除しました。');};
  $('export').onclick=()=>{
    try{kit.validate(data);const json=JSON.stringify(data,null,2);const blob=new Blob([json],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);exported=true;status(`layout.jsonを書き出しました（${(blob.size/1024).toFixed(0)}KB）。data/layout.jsonに保存してください。`);}catch(error){status(error.message);}
  };
  $('import').onclick=()=>$('import-file').click();$('import-file').onchange=async()=>{
    const file=$('import-file').files[0];if(!file)return;
    try{if(file.size>30*1024*1024)throw Error('JSONは30MB以下にしてください。');const imported=kit.validate(JSON.parse(await file.text()));checkpoint();data=imported;pageId='home';selectedId=null;if(!page().enabled)await importBaseline(page());render();saveDraft('JSONを読み込みました。画像・ページ・配置を復元しました。');}
    catch(error){status(`読み込みできませんでした：${error.message}`);}finally{$('import-file').value='';}
  };
  window.addEventListener('resize',fit);window.addEventListener('beforeunload',event=>{if(!exported){event.preventDefault();event.returnValue='';}});
  async function init(){
    try{
      if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname))throw Error('編集画面はローカル専用です。start-editor.cmdから起動してください。');
      const response=await fetch(new URL('data/layout.json',BASE));if(!response.ok)throw Error('配置ファイルを読み込めませんでした。');data=kit.validate(await response.json());
      let restored=false;try{const draft=localStorage.getItem(STORAGE);if(draft){data=kit.validate(JSON.parse(draft));restored=true;}}catch{status('以前の一時保存は読み込めませんでした。公開データを使用します。');}
      if(!page().enabled)await importBaseline(page());render();status(restored?'前回の一時保存を復元しました。公開データを使う場合は「JSONを開く」で読み込んでください。':'HOMEの準備ができました。クリックして編集を始められます。');
    }catch(error){status(error.message);$('hint').textContent=error.message;}
  }
  init();
})();

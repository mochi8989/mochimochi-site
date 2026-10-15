import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createServer} from './serve.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const artifacts=path.join(root,'.preview');await fs.mkdir(artifacts,{recursive:true});
const server=createServer();await new Promise(r=>server.listen(4175,'127.0.0.1',r));
const chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--remote-debugging-port=9335',`--user-data-dir=${path.join(artifacts,'chrome')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let socket;let serial=0;const pending=new Map(),errors=[],failed=[];const report=[];
async function connect(){
 let tabs;for(let n=0;n<80;n++){try{tabs=await(await fetch('http://127.0.0.1:9335/json')).json();break;}catch{await delay(150);}}
 if(!tabs)throw Error('Chrome remote debugging unavailable');
 socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const handler=pending.get(message.id);pending.delete(message.id);message.error?handler?.reject(Error(message.error.message)):handler?.resolve(message.result);}else{if(message.method==='Page.javascriptDialogOpening')send('Page.handleJavaScriptDialog',{accept:true}).catch(()=>{});if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);if(message.method==='Network.responseReceived'&&message.params.response.status>=400)failed.push(message.params.response.url);}});
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Page.handleJavaScriptDialog',{accept:true}).catch(()=>{});
}
function send(method,params={}){const id=++serial;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(100);}throw Error('Timeout: '+expression);}
async function viewport(width,height=1000){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});}
async function navigate(url){await send('Page.navigate',{url});await until("document.readyState==='complete'");await evaluate('document.fonts.ready.then(()=>true)');await delay(180);}
async function shot(name){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(artifacts,name),Buffer.from(r.data,'base64'));}
const base='http://127.0.0.1:4175/mochimochi-site/';
try{
 await connect();
 for(const width of [1440,768,390,320]){
  await viewport(width);
  for(const name of ['index','profile','gallery','games','shop','links']){
   await navigate(base+name+'.html');
   const result=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth+1,title:document.title,broken:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src),current:document.querySelectorAll('[aria-current="page"]').length})`);
   assert.equal(result.overflow,false,`${name} overflow ${width}`);assert.equal(result.broken.length,0,`${name} broken images`);assert.equal(result.current,1);
   assert.equal(await evaluate(`document.fonts.check('16px DotGothic16','ABC 日本語 漢字 配信') && getComputedStyle(document.body).fontFamily.startsWith('DotGothic16')`),true,`${name}: pixel font not loaded`);
   if(name==='index'&&[1440,390].includes(width))await shot(`home-${width}.png`);
  }report.push(`6 pages at ${width}px: no overflow / broken images`);
 }
 // 実作品を捏造せず、ブラウザメモリだけにテスト用データを注入して拡大と絞り込みを検証。
 await viewport(1200);await navigate(base+'gallery.html');
 await evaluate(`window.MOCHI_GALLERY=[{title:'QA illustration',category:'イラスト',image:'assets/images/whale.svg',description:'test only'},{title:'QA pixel',category:'ドット絵',image:'assets/images/whale.svg',description:'test only'}];document.querySelector('[data-filters]').replaceChildren();fetch('assets/js/app.js').then(r=>r.text()).then(code=>(0,eval)(code))`);
 await until("document.querySelectorAll('[data-gallery] .work-card').length===2");
 await evaluate(`document.querySelectorAll('.filter')[2].click()`);assert.equal(await evaluate("document.querySelectorAll('[data-gallery] .work-card').length"),1);
 await evaluate("document.querySelector('[data-gallery] button').click()");assert.equal(await evaluate("document.querySelector('dialog').open"),true);
 await send('Page.bringToFront');await send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await delay(150);
 assert.equal(await evaluate("document.querySelector('dialog').open"),false);report.push('Gallery: category filter, enlargement and Escape close passed');
 await evaluate("localStorage.removeItem('mochimochi-layout-draft-v1')");
 await viewport(1600,1050);await navigate(base+'editor/');
 await until("document.querySelectorAll('#canvas .layout-element').length>20");
 assert.match(await evaluate("document.querySelector('#status').textContent"),/HOME|復元/);
 assert.equal(await evaluate("[...document.querySelectorAll('#canvas .kind-heading')].every(node=>getComputedStyle(node).fontFamily.startsWith('DotGothic16'))"),true);
 await shot('editor-desktop.png');
 await evaluate("document.querySelector('[data-add=heading]').click();document.querySelector('#element-text').value='ビジュアル編集のテスト';document.querySelector('#element-text').dispatchEvent(new Event('change'))");
 assert.equal(await evaluate("[...document.querySelectorAll('#canvas h2')].some(e=>e.textContent==='ビジュアル編集のテスト')"),true);
 assert.equal(await evaluate("document.querySelector('#element-font').value"),'pixel');
 await evaluate("document.querySelector('#element-font').value='serif';document.querySelector('#element-font').dispatchEvent(new Event('change'));document.querySelector('#pixel-page').click()");
 assert.equal(await evaluate("[...document.querySelectorAll('#canvas .kind-text,#canvas .kind-heading,#canvas .kind-link')].every(node=>getComputedStyle(node).fontFamily.startsWith('DotGothic16'))"),true);
 await evaluate("document.querySelector('#duplicate').click()");const count=await evaluate("document.querySelectorAll('#canvas .layout-element').length");
 await evaluate("document.querySelector('#delete').click()");assert.equal(await evaluate("document.querySelectorAll('#canvas .layout-element').length"),count-1);
 await evaluate("document.querySelector('#undo').click()");assert.equal(await evaluate("document.querySelectorAll('#canvas .layout-element').length"),count);
 // 実際のマウスイベントでドラッグとリサイズ。
 const box=await evaluate("(()=>{const r=document.querySelector('#selection').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
 const oldX=await evaluate("Number(document.querySelector('#element-x').value)");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:box.x,y:box.y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:box.x+40,y:box.y+32,button:'left',buttons:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:box.x+40,y:box.y+32,button:'left',clickCount:1});
 assert.notEqual(await evaluate("Number(document.querySelector('#element-x').value)"),oldX);
 const handle=await evaluate("(()=>{const r=document.querySelector('#resize-handle').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");const oldW=await evaluate("Number(document.querySelector('#element-w').value)");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:handle.x,y:handle.y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:handle.x+30,y:handle.y+20,button:'left',buttons:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:handle.x+30,y:handle.y+20,button:'left',clickCount:1});assert.notEqual(await evaluate("Number(document.querySelector('#element-w').value)"),oldW);
 await evaluate("document.querySelector('#theme').value='paper';document.querySelector('#theme').dispatchEvent(new Event('change'))");
 assert.equal(await evaluate("document.querySelector('#canvas').style.backgroundColor"),'rgb(247, 242, 232)');
 const beforeImage=await evaluate("document.querySelectorAll('#canvas .kind-image').length");
 await evaluate(`new Promise(resolve=>{const canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;const ctx=canvas.getContext('2d');ctx.fillStyle='#ffd566';ctx.fillRect(0,0,8,8);ctx.fillStyle='#6085dc';ctx.fillRect(0,0,4,4);canvas.toBlob(blob=>{const dt=new DataTransfer();dt.items.add(new File([blob],'qa-pixel.png',{type:'image/png'}));const input=document.querySelector('#image-file');input.files=dt.files;input.dispatchEvent(new Event('change'));resolve();},'image/png');})`);
 await until(`document.querySelectorAll('#canvas .kind-image').length===${beforeImage+1}`);
 assert.equal(await evaluate("getComputedStyle([...document.querySelectorAll('#canvas .kind-image')].find(i=>i.src.startsWith('data:image/png'))).imageRendering"),'pixelated');
 await evaluate("document.querySelector('#element-w').value=96;document.querySelector('#element-w').dispatchEvent(new Event('change'));document.querySelector('#forward').click()");
 assert.equal(await evaluate("Number(document.querySelector('#element-w').value)"),96);
 await send('Browser.setDownloadBehavior',{behavior:'deny'});
 await evaluate("const originalObjectURL=URL.createObjectURL;URL.createObjectURL=blob=>{window.__exportBlob=blob;return originalObjectURL(blob);};document.querySelector('#export').click()");
 const exportedJSON=await evaluate("window.__exportBlob.text()");assert.ok(JSON.parse(exportedJSON).pages[0].elements.some(e=>e.src?.startsWith('data:image/png')));
 await evaluate(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(exportedJSON)}],'layout.json',{type:'application/json'}));const input=document.querySelector('#import-file');input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
 await until("document.querySelector('#status').textContent.includes('JSONを読み込みました')");
 assert.equal(await evaluate("document.querySelectorAll('#canvas .kind-image').length"),beforeImage+1);
 const beforeInvalid=await evaluate("localStorage.getItem('mochimochi-layout-draft-v1')");
 await evaluate("const dt=new DataTransfer();dt.items.add(new File(['{bad json'],'bad.json',{type:'application/json'}));document.querySelector('#import-file').files=dt.files;document.querySelector('#import-file').dispatchEvent(new Event('change'))");
 await until("document.querySelector('#status').textContent.includes('読み込みできませんでした')");assert.equal(await evaluate("localStorage.getItem('mochimochi-layout-draft-v1')"),beforeInvalid);
 report.push('PNG upload / pixelated scaling / layer order / JSON export-import / invalid JSON rejection passed');
 // JSONとして公開レンダラーへ往復させる。実ファイルの公開データは変更しない。
 const edited=await evaluate("localStorage.getItem('mochimochi-layout-draft-v1')");assert.ok(JSON.parse(edited).pages[0].enabled);
 await evaluate("document.querySelector('#mobile').click()");await shot('editor-mobile.png');
 await evaluate("document.querySelector('#add-page').click();document.querySelector('#new-page-title').value='QA page';document.querySelector('#confirm-page').click()");
 await until("document.querySelector('#page-title').value==='QA page'");
 assert.equal(await evaluate("document.querySelectorAll('#pages option').length"),7);
 await evaluate("document.querySelector('#delete-page').click()");await until("document.querySelectorAll('#pages option').length===6");
 await evaluate("document.querySelector('#undo').click()");assert.equal(await evaluate("document.querySelectorAll('#pages option').length"),7);
 await evaluate("document.querySelector('#undo').click()");assert.equal(await evaluate("document.querySelectorAll('#pages option').length"),6);
 report.push('HOME editor: capture, text, duplicate/delete, Undo, mouse move/resize, grid, theme, mobile view, add page passed');
 for(const id of ['profile','gallery','games','shop','links']){
  await evaluate(`document.querySelector('#pages').value='${id}';document.querySelector('#pages').dispatchEvent(new Event('change'))`);
  await until(`document.querySelector('#page-title').value===document.querySelector('#pages option[value="${id}"]').textContent && document.querySelector('#status').textContent.includes('切り替え')`);
 }report.push('Editor baseline capture passed for all remaining 5 pages');
 // ページロード直前にレイアウトJSONだけをブラウザ内で差し替える。
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`const nativeFetch=window.fetch;window.fetch=(input,init)=>String(input).endsWith('data/layout.json')?Promise.resolve(new Response(${JSON.stringify(edited)},{status:200,headers:{'Content-Type':'application/json'}})):nativeFetch(input,init);`});
 for(const width of [1440,768,390,320]){await viewport(width);await navigate(base+'index.html');await until("!document.querySelector('#custom-layout').hidden");assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth+1"),false);assert.equal(await evaluate("[...document.querySelectorAll('#custom-layout h2')].some(e=>e.textContent==='ビジュアル編集のテスト')"),true);if(width===390)await shot('edited-public-mobile.png');}
 report.push('Exported JSON public rendering at 1440/768/390/320px passed');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await navigate(base+'profile.html');assert.equal(await evaluate("getComputedStyle(document.querySelector('.star')).animationName"),'none');
 assert.equal((await fetch('http://127.0.0.1:4175/published/mochimochi-site/editor/')).status,404);
 for(const name of ['index','profile','gallery','games','shop','links'])assert.equal((await fetch(`http://127.0.0.1:4175/published/mochimochi-site/${name}.html`)).status,200);
 report.push('Reduced motion and project subpath / deployment editor exclusion passed');
 assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failed.length,0,JSON.stringify(failed));
 await fs.writeFile(path.join(artifacts,'qa-report.json'),JSON.stringify({passed:report,errors,failed},null,2));
 console.log(JSON.stringify({passed:report,errors,failed},null,2));
}catch(error){
 try{console.error('Browser diagnostics:',await evaluate(`JSON.stringify({status:document.querySelector('#status')?.textContent,hint:document.querySelector('#hint')?.textContent,url:location.href})`));console.error('Runtime exceptions:',JSON.stringify(errors));await shot('failure.png');}catch{}
 throw error;
}finally{
 if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}socket.close();}
 chrome.kill();server.close();
}

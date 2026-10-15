import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist');
const pages=['index.html','profile.html','gallery.html','games.html','shop.html','links.html','page.html','widgets.html'];
const layout=JSON.parse(await fs.readFile(path.join(root,'data/layout.json'),'utf8'));
const context={window:{},document:{querySelector:()=>null}};
vm.runInNewContext(await fs.readFile(path.join(root,'assets/js/layout.js'),'utf8'),context);
context.window.LayoutKit.validate(layout);
// 出力先をこのプロジェクトの dist に固定し、既存出力だけを再作成する。
if(path.dirname(out)!==root||path.basename(out)!=='dist')throw Error('Unsafe output path');
await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
for(const name of pages)await fs.copyFile(path.join(root,name),path.join(out,name));
for(const name of ['assets','data'])await fs.cp(path.join(root,name),path.join(out,name),{recursive:true});
await fs.writeFile(path.join(out,'.nojekyll'),'');
await fs.copyFile(path.join(root,'index.html'),path.join(out,'404.html'));
const errors=[];
for(const file of pages){
 const content=await fs.readFile(path.join(out,file),'utf8');
 if(!content.includes('lang="ja"')||!content.includes('name="description"'))errors.push(`${file}: 日本語/SEO設定がありません`);
 for(const match of content.matchAll(/(?:href|src)="([^"#]+)"/g)){
  const ref=match[1];if(/^(https?:|data:)/.test(ref))continue;
  if(ref.startsWith('/'))errors.push(`${file}: 絶対パス ${ref}`);
  try{await fs.access(path.join(out,ref.split(/[?#]/)[0]));}catch{errors.push(`${file}: リンク切れ ${ref}`);}
 }
}
for(const page of layout.pages.filter(p=>p.enabled&&!p.deleted)){
 const assets=[page.backgroundImage,...page.elements.filter(e=>e.type==='image').map(e=>e.src)].filter(src=>src?.startsWith('assets/'));
 for(const src of assets)try{await fs.access(path.join(out,src));}catch{errors.push(`${page.title}: 画像がありません ${src}`);}
}
for(const privatePath of ['editor','tools','.git','README.md'])try{await fs.access(path.join(out,privatePath));errors.push(`公開対象に編集用ファイルが混入: ${privatePath}`);}catch{}
if(errors.length)throw Error(errors.join('\n'));
console.log('Build OK: 6 content pages + custom page and widgets, local links and layout validated. Editor/tools/Git files excluded from dist.');

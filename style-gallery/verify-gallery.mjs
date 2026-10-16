import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const context={window:{}};
vm.runInNewContext(await fs.readFile(path.join(root,'styles-data.js'),'utf8'),context);
const styles=context.window.CHAOYUN_STYLES;
const source=JSON.parse(await fs.readFile(path.join(root,'..','references','style-index.json'),'utf8'));
assert.equal(styles.length,207);assert.equal(new Set(styles.map(s=>s.id)).size,207);
let originalBytes=0,thumbnailBytes=0;
for(let i=0;i<styles.length;i++){
  const s=styles[i],row=source.find(r=>String(r['序号']).padStart(3,'0')===s.id);
  assert.equal(s.id,String(i+1).padStart(3,'0'));
  assert.equal(s.name,row['风格名称']);assert.equal(s.description,row['简单描述']);
  for(const field of ['scenes','categories','tags','capacity','useCases','structures','layouts','materials'])assert.ok(Array.isArray(s[field])&&s[field].length,`${s.id} ${field}`);
  assert.ok(s.prompt.length>30&&s.evidence.length>10&&s.width>0&&s.height>0,`Incomplete ${s.id}`);
  const image=await fs.readFile(path.join(root,decodeURIComponent(s.image)));originalBytes+=image.length;
  assert.equal(crypto.createHash('sha256').update(image).digest('hex'),s.sha256);
  thumbnailBytes+=(await fs.stat(path.join(root,s.thumbnail))).size;
}
assert.equal(new Set(styles.flatMap(s=>s.scenes)).size,8);
assert.equal(new Set(styles.flatMap(s=>s.categories)).size,21);
assert.equal(new Set(styles.flatMap(s=>s.capacity)).size,5);
for(const file of ['index.html','app.css','app.js','server.py','start-gallery.ps1','README.md'])assert.ok((await fs.stat(path.join(root,file))).size);
new vm.Script(await fs.readFile(path.join(root,'app.js'),'utf8'));
console.log(JSON.stringify({ok:true,styles:styles.length,originalImages:207,thumbnails:207,fieldsMatchSource:true,originalHashesVerified:true,scenes:8,categories:21,capacities:5,originalMB:Math.round(originalBytes/1048576*100)/100,thumbnailMB:Math.round(thumbnailBytes/1048576*100)/100},null,2));

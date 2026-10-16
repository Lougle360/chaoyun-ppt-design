import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(process.argv[2] || path.dirname(root));
const require = createRequire(path.join(source, 'package.json'));
const sharp = require('sharp');
const indexPath = path.join(source,'references','style-index.json');
const catalogPath = path.join(source,'references','style-catalog.md');
const indexText = await fs.readFile(indexPath,'utf8');
const catalogText = await fs.readFile(catalogPath,'utf8');
const index = JSON.parse(indexText);
const sections = new Map([...catalogText.matchAll(/^## (\d{3})｜[^\r\n]+\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)].map(m=>[m[1],m[2]]));
if(index.length !== 207 || sections.size !== 207) throw new Error(`Unexpected source count: index=${index.length}, catalog=${sections.size}`);
await fs.mkdir(path.join(root,'thumbnails'),{recursive:true});
const styles=[];
for(const row of index){
  const id=String(row['序号']).padStart(3,'0');
  const preview=path.resolve(source,'references',row['预览图']);
  if(!preview.startsWith(path.join(source,'assets','ppt-previews')+path.sep))throw new Error(`Invalid image path: ${id}`);
  const ext=path.extname(preview).toLowerCase();
  const image=`../assets/ppt-previews/${encodeURIComponent(path.basename(preview))}`;
  const thumbnail=`thumbnails/${id}.webp`;
  const prompt=sections.get(id)?.split(/- 完整提示词：\s*\r?\n/)[1]?.trim();
  if(!prompt)throw new Error(`Missing prompt: ${id}`);
  const imageBytes=await fs.readFile(preview);
  const metadata=await sharp(imageBytes).metadata();
  await sharp(imageBytes).rotate().resize({width:720,height:450,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toFile(path.join(root,thumbnail));
  const style={id,name:row['风格名称'],description:row['简单描述'],scenes:row['PPT主要使用场景'],categories:row['类别'],tags:row['风格标签'],capacity:row['建议正文容量'],useCases:row['推荐使用场景'],structures:row['擅长的内容结构'],layouts:row['页面组织方式'],materials:row['素材承载方式'],evidence:row['判断依据'],prompt,image,thumbnail,width:metadata.width,height:metadata.height,sourceImage:path.basename(preview),sha256:crypto.createHash('sha256').update(imageBytes).digest('hex')};
  style.search=[id,style.name,style.description,...style.scenes,...style.categories,...style.tags,...style.capacity,...style.useCases,...style.structures,...style.layouts,...style.materials].join(' ').toLocaleLowerCase();
  styles.push(style);
}
await fs.writeFile(path.join(root,'styles-data.js'),`// Generated from the installed chaoyun-ppt-design catalog.\nwindow.CHAOYUN_STYLES = ${JSON.stringify(styles,null,2).replace(/</g,'\\u003c')};\n`);
console.log(`Built ${styles.length} complete styles and optimized thumbnails in ${root}; original images are reused from assets/ppt-previews`);

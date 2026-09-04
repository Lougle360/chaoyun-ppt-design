import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("用法：sync_style_catalog.mjs <飞书记录.ndjson> <风格目录.md>");
}

const source = await fs.readFile(path.resolve(inputPath), "utf8");
const records = source.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
records.sort((a, b) => Number(a["序号"]) - Number(b["序号"]));

if (records.length !== 207) throw new Error(`预期 207 条风格，实际 ${records.length} 条`);

const required = ["序号", "类别", "风格名称", "风格标签", "简单描述", "建议正文容量", "PPT主要使用场景", "推荐使用场景", "擅长的内容结构", "页面组织方式", "素材承载方式", "判断依据", "完整提示词"];
for (const record of records) {
  for (const field of required) {
    const value = record[field];
    if (value == null || (Array.isArray(value) && value.length === 0) || value === "") {
      throw new Error(`第 ${record["序号"]} 条缺少字段：${field}`);
    }
  }
}

const lines = [
  "# 超云PPT设计中文风格目录",
  "",
  "> 唯一权威来源：[飞书多维表格](https://xcn5phmhnu1z.feishu.cn/base/JvecbWMEwaLv8as3NGXcQxjgnn9?table=tbl1DwIeLHneaDRX&view=vew2lCosPH)",
  "> 本文件是离线快照。风格选择、名称、描述、场景和提示词均以飞书表格为准。",
  "",
  `共 ${records.length} 种PPT模板。先检索全库，再根据文章的表达任务、正文容量和视觉需求选择候选，核对完整提示词。不得因编号靠前、熟悉程度或仅命中“教程”标签而优先推荐。`,
  "",
  "PPT主要使用场景为单选，用于优先匹配而非排除其他模板。建议正文容量不是PPT适用性评分。推荐使用场景为多选标签，不是用途限制。图片按稳定编号关联，文件名中的旧名称不作为检索依据。",
  "",
];

const previewDir = path.resolve(path.dirname(outputPath), "../assets/ppt-previews");
const previewFiles = await fs.readdir(previewDir);
const index = [];
const seen = new Set();
for (const record of records) {
  const seq = String(record["序号"]).padStart(3, "0");
  if (seen.has(seq)) throw new Error(`重复编号：${seq}`);
  seen.add(seq);
  const previews = previewFiles.filter(name => name.startsWith(`${seq}-`));
  if (previews.length !== 1) throw new Error(`编号 ${seq} 预览图数量异常：${previews.length}`);
  const preview = `../assets/ppt-previews/${previews[0]}`;
  const category = Array.isArray(record["类别"]) ? record["类别"].join("、") : record["类别"];
  const density = Array.isArray(record["建议正文容量"]) ? record["建议正文容量"].join("、") : record["建议正文容量"];
  const tags = Array.isArray(record["风格标签"]) ? record["风格标签"].join("、") : record["风格标签"];
  const scenes = Array.isArray(record["推荐使用场景"]) ? record["推荐使用场景"].join("、") : record["推荐使用场景"];
  index.push({擅长的内容结构:record["擅长的内容结构"],页面组织方式:record["页面组织方式"],素材承载方式:record["素材承载方式"],判断依据:record["判断依据"],PPT主要使用场景:record["PPT主要使用场景"],序号:record["序号"],风格名称:record["风格名称"],类别:record["类别"],风格标签:record["风格标签"],简单描述:record["简单描述"],建议正文容量:record["建议正文容量"],推荐使用场景:record["推荐使用场景"],预览图:preview});
  lines.push(
    `## ${seq}｜${record["风格名称"]}`,
    "",
    `- 类别：${category}`,
    `- PPT主要使用场景：${Array.isArray(record["PPT主要使用场景"]) ? record["PPT主要使用场景"].join("、") : record["PPT主要使用场景"]}`,
    `- 风格标签：${tags}`,
    `- 简单描述：${record["简单描述"]}`,
    `- 建议正文容量：${density}`,
    `- 推荐使用场景：${scenes}`,
    `- 预览图：[${record["风格名称"]}](<${preview}>)`,
    `- 擅长的内容结构：${Array.isArray(record["擅长的内容结构"]) ? record["擅长的内容结构"].join("、") : record["擅长的内容结构"]}`,
    `- 页面组织方式：${Array.isArray(record["页面组织方式"]) ? record["页面组织方式"].join("、") : record["页面组织方式"]}`,
    `- 素材承载方式：${Array.isArray(record["素材承载方式"]) ? record["素材承载方式"].join("、") : record["素材承载方式"]}`,
    `- 判断依据：${Array.isArray(record["判断依据"]) ? record["判断依据"].join("、") : record["判断依据"]}`,
    "- 完整提示词：",
    "",
    record["完整提示词"],
    "",
  );
}

await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
await fs.writeFile(path.resolve(outputPath), `${lines.join("\n").trimEnd()}\n`, "utf8");
await fs.writeFile(path.join(path.dirname(path.resolve(outputPath)), "style-index.json"), JSON.stringify(index, null, 2)+"\n", "utf8");
process.stdout.write(`${JSON.stringify({ records: records.length, output: path.resolve(outputPath) }, null, 2)}\n`);

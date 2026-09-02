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

const required = ["序号", "类别", "风格名称", "风格标签", "简单描述", "信息密度 | PPT适配度", "推荐使用场景", "完整提示词"];
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
  `共 ${records.length} 种风格。选择风格时，先按使用场景和信息密度筛选，再读取对应完整提示词；不得引用旧英文或日文案例库作为风格名称或提示词来源。`,
  "",
];

for (const record of records) {
  const seq = String(record["序号"]).padStart(3, "0");
  const category = Array.isArray(record["类别"]) ? record["类别"].join("、") : record["类别"];
  const density = Array.isArray(record["信息密度 | PPT适配度"]) ? record["信息密度 | PPT适配度"].join("、") : record["信息密度 | PPT适配度"];
  const tags = Array.isArray(record["风格标签"]) ? record["风格标签"].join("、") : record["风格标签"];
  lines.push(
    `## ${seq}｜${record["风格名称"]}`,
    "",
    `- 类别：${category}`,
    `- 风格标签：${tags}`,
    `- 简单描述：${record["简单描述"]}`,
    `- 信息密度与PPT适配度：${density}`,
    `- 推荐使用场景：${record["推荐使用场景"]}`,
    "- 完整提示词：",
    "",
    record["完整提示词"],
    "",
  );
}

await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
await fs.writeFile(path.resolve(outputPath), `${lines.join("\n")}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ records: records.length, output: path.resolve(outputPath) }, null, 2)}\n`);

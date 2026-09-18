import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { generateImage } from "./generate_image.mjs";

/**
 * 批量生成 PPT 页面图片。
 *
 * 用法：
 *   node scripts/batch_generate.mjs <prompts目录> <输出目录> [比例] [并发数]
 *
 * 功能：
 *   - 扫描 prompts 目录下所有 .txt 文件，按文件名排序
 *   - 已存在的输出图片自动跳过（断点续跑）
 *   - 前台串行执行，避免后台任务被清理
 *   - 单页失败不中断，记录后继续，最后汇总
 *
 * 示例：
 *   node scripts/batch_generate.mjs ./prompts ./pages 16:9 2
 */

async function main() {
  const [promptsDir, outputDir, aspectRatio = "16:9", concurrencyArg = "1"] = process.argv.slice(2);

  if (!promptsDir || !outputDir) {
    throw new Error("用法：batch_generate.mjs <prompts目录> <输出目录> [比例] [并发数]");
  }

  const concurrency = Math.max(1, parseInt(concurrencyArg, 10) || 1);
  const promptsAbs = path.resolve(promptsDir);
  const outputAbs = path.resolve(outputDir);

  await fs.mkdir(outputAbs, { recursive: true });

  // 扫描所有提示词文件
  const files = (await fs.readdir(promptsAbs))
    .filter((f) => f.toLowerCase().endsWith(".txt"))
    .sort();

  if (files.length === 0) {
    throw new Error(`提示词目录为空：${promptsAbs}`);
  }

  const tasks = files.map((file) => {
    const promptPath = path.join(promptsAbs, file);
    const outputName = file.replace(/\.txt$/i, ".png");
    const outputPath = path.join(outputAbs, outputName);
    return { file, promptPath, outputPath, outputName };
  });

  // 统计已完成
  let skipped = 0;
  for (const task of tasks) {
    try {
      await fs.access(task.outputPath);
      skipped++;
    } catch {
      // 未生成
    }
  }

  const total = tasks.length;
  const pending = total - skipped;
  process.stderr.write(
    `[batch] 共 ${total} 页，已完成 ${skipped} 页，待生成 ${pending} 页，并发 ${concurrency}\n`
  );

  if (pending === 0) {
    process.stdout.write(JSON.stringify({ ok: true, total, skipped, generated: 0, failed: 0 }, null, 2) + "\n");
    return;
  }

  const results = { generated: [], failed: [] };
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const current = index++;
      const task = tasks[current];

      // 断点续跑：已存在则跳过
      try {
        await fs.access(task.outputPath);
        process.stderr.write(`[batch] [${current + 1}/${total}] 跳过（已存在）：${task.outputName}\n`);
        continue;
      } catch {
        // 需要生成
      }

      try {
        const prompt = (await fs.readFile(task.promptPath, "utf8")).trim();
        if (!prompt) throw new Error("提示词文件为空");
        const result = await generateImage(prompt, task.outputPath, { aspectRatio });
        results.generated.push(task.outputName);
        process.stderr.write(`[batch] [${current + 1}/${total}] 完成：${task.outputName} (${result.width}x${result.height})\n`);
      } catch (error) {
        results.failed.push({ file: task.file, error: error.message });
        process.stderr.write(`[batch] [${current + 1}/${total}] 失败：${task.file} — ${error.message}\n`);
      }
    }
  }

  // 启动并发 worker
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, pending); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  const report = {
    ok: results.failed.length === 0,
    total,
    skipped,
    generated: results.generated.length,
    failed: results.failed.length,
    failedDetails: results.failed,
  };

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (!report.ok) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  });
}

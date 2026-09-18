import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const API_BASE = "https://api.kie.ai";
const GENERATE_ENDPOINT = "/api/v1/jobs/createTask";
const QUERY_ENDPOINT = "/api/v1/jobs/recordInfo";
const MODEL = "gpt-image-2-text-to-image";
const DEFAULT_API_KEY = "f4e186a727d55fbcbe9faf851baed7c4";
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 300000; // 5 minutes
const SUPPORTED_RATIOS = ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"];

// 重试配置
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

function getApiKey() {
  return process.env.KIE_API_KEY || DEFAULT_API_KEY;
}

/**
 * 带指数退避的重试包装器。
 * 仅对网络错误（fetch failed / TypeError）重试，业务错误不重试。
 */
async function withRetry(fn, label, maxRetries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isNetworkError =
        error instanceof TypeError ||
        (error.message && /fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(error.message));
      if (!isNetworkError || attempt === maxRetries) {
        throw error;
      }
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      process.stderr.write(`[KIE] ${label} 网络错误，第 ${attempt + 1}/${maxRetries} 次重试，等待 ${delay}ms: ${error.message}\n`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

async function submitTask(prompt, aspectRatio = "16:9") {
  if (!SUPPORTED_RATIOS.includes(aspectRatio)) {
    throw new Error(`不支持的比例 ${aspectRatio}，可选：${SUPPORTED_RATIOS.join("、")}`);
  }
  return withRetry(async () => {
    const response = await fetch(`${API_BASE}${GENERATE_ENDPOINT}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: { prompt, aspect_ratio: aspectRatio },
      }),
    });
    const data = await response.json();
    if (data.code !== 200 || !data.data?.taskId) {
      throw new Error(`任务提交失败: ${JSON.stringify(data)}`);
    }
    return data.data.taskId;
  }, "提交任务");
}

async function queryTask(taskId) {
  const url = `${API_BASE}${QUERY_ENDPOINT}?taskId=${encodeURIComponent(taskId)}`;
  return withRetry(async () => {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Authorization": `Bearer ${getApiKey()}` },
    });
    const data = await response.json();
    if (data.code !== 200) {
      throw new Error(`任务查询失败: ${JSON.stringify(data)}`);
    }
    return data.data;
  }, "查询任务");
}

async function waitForCompletion(taskId) {
  const startTime = Date.now();
  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    const task = await queryTask(taskId);
    const state = task.state || task.status;
    if (state === "success" || state === "SUCCESS") {
      let resultJson = task.resultJson;
      if (typeof resultJson === "string") {
        resultJson = JSON.parse(resultJson);
      }
      const urls = resultJson?.resultUrls || resultJson?.info?.result_urls || [];
      if (urls.length === 0) {
        throw new Error("任务成功但未返回图片 URL");
      }
      return urls[0];
    }
    if (state === "fail" || state === "FAIL") {
      throw new Error(`任务失败: ${task.failMsg || task.msg || JSON.stringify(task)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`任务超时（${POLL_TIMEOUT_MS / 1000}秒）: ${taskId}`);
}

async function downloadImage(url, outputPath) {
  return withRetry(async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`图片下载失败: HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
    await fs.writeFile(outputPath, buffer);
    return buffer;
  }, "下载图片");
}

export async function generateImage(prompt, outputPath, options = {}) {
  const aspectRatio = options.aspectRatio || options.size || "16:9";
  const taskId = await submitTask(prompt, aspectRatio);
  process.stderr.write(`[KIE] 任务已提交: ${taskId} (ratio=${aspectRatio}, model=${MODEL})\n`);

  const imageUrl = await waitForCompletion(taskId);
  process.stderr.write(`[KIE] 生成完成: ${imageUrl}\n`);

  await downloadImage(imageUrl, outputPath);

  const metadata = await sharp(outputPath).metadata();
  process.stderr.write(`[KIE] 原始尺寸 ${metadata.width}x${metadata.height}\n`);

  return { outputPath: path.resolve(outputPath), taskId, width: metadata.width, height: metadata.height };
}

async function main() {
  const [promptFile, outputPath, aspectRatio] = process.argv.slice(2);
  if (!promptFile || !outputPath) {
    throw new Error("用法：generate_image.mjs <提示词文件.txt> <输出图片.png> [比例 auto|1:1|9:16|16:9|4:3|3:4]");
  }
  const prompt = (await fs.readFile(path.resolve(promptFile), "utf8")).trim();
  if (!prompt) {
    throw new Error("提示词文件为空");
  }
  const result = await generateImage(prompt, outputPath, { aspectRatio });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  });
}

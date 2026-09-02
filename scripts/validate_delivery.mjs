import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

function runtimeModulesPath() {
  const value = process.env.RUNTIME_NODE_MODULES;
  if (!value) {
    throw new Error("缺少 RUNTIME_NODE_MODULES；请使用 load_workspace_dependencies，并原样传入返回路径。");
  }
  return value;
}

async function loadArtifactTool() {
  const modulePath = path.join(
    runtimeModulesPath(),
    "@oai",
    "artifact-tool",
    "dist",
    "artifact_tool.mjs",
  );
  return import(pathToFileURL(modulePath).href);
}

function loadSharp() {
  const resolver = createRequire(path.join(runtimeModulesPath(), "runtime-resolver.cjs"));
  return resolver("sharp");
}

function resolveFromManifest(manifestPath, relativePath) {
  return path.resolve(path.dirname(manifestPath), relativePath);
}

export async function validateDelivery(manifestPath, pptxPath) {
  manifestPath = path.resolve(manifestPath);
  pptxPath = path.resolve(pptxPath);
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const errors = [];
  const warnings = [];
  const slideSize = manifest.slideSize ?? { width: 1280, height: 720 };
  const expectedRatio = slideSize.width / slideSize.height;
  const slides = Array.isArray(manifest.slides) ? manifest.slides : [];
  const sharp = loadSharp();

  if (!manifest.deckTitle || typeof manifest.deckTitle !== "string") {
    errors.push("缺少 deckTitle");
  }
  if (slides.length === 0) {
    errors.push("构建清单中没有页面");
  }

  for (const [index, slide] of slides.entries()) {
    const page = index + 1;
    if (slide.page !== page) errors.push(`第 ${page} 条页面记录的 page=${slide.page}，预期为 ${page}`);
    if (!Array.isArray(slide.sourceAnchors) || slide.sourceAnchors.length === 0) {
      errors.push(`第 ${page} 页缺少原文锚点`);
    }
    if (!Array.isArray(slide.coverageIds) || slide.coverageIds.length === 0) {
      warnings.push(`第 ${page} 页缺少内容覆盖编号`);
    }

    for (const [field, relativePath] of [["image", slide.image], ["promptFile", slide.promptFile]]) {
      if (!relativePath || typeof relativePath !== "string") {
        errors.push(`第 ${page} 页缺少 ${field}`);
        continue;
      }
      const filePath = resolveFromManifest(manifestPath, relativePath);
      try {
        await fs.access(filePath);
      } catch {
        errors.push(`第 ${page} 页的 ${field} 不存在：${filePath}`);
      }
    }

    if (slide.image) {
      const imagePath = resolveFromManifest(manifestPath, slide.image);
      try {
        const metadata = await sharp(imagePath).metadata();
        if (!metadata.width || !metadata.height) {
          errors.push(`第 ${page} 页图片尺寸无法读取`);
        } else {
          const ratio = metadata.width / metadata.height;
          if (Math.abs(ratio - expectedRatio) > 0.01) {
            errors.push(`第 ${page} 页图片比例 ${metadata.width}x${metadata.height} 与 ${slideSize.width}x${slideSize.height} 不一致`);
          }
        }
      } catch (error) {
        errors.push(`第 ${page} 页图片无法读取：${error.message}`);
      }
    }

    if (slide.mode === "hybrid" && (!Array.isArray(slide.textBlocks) || slide.textBlocks.length === 0)) {
      errors.push(`第 ${page} 张混合页没有文本块`);
    }
  }

  let deckSlideCount = null;
  try {
    const { FileBlob, PresentationFile } = await loadArtifactTool();
    const presentation = await PresentationFile.importPptx(await FileBlob.load(pptxPath));
    deckSlideCount = presentation.slides.items.length;
    if (deckSlideCount !== slides.length) {
      errors.push(`PPTX 有 ${deckSlideCount} 页，构建清单有 ${slides.length} 页`);
    }
  } catch (error) {
    errors.push(`PPTX 无法读取：${error.message}`);
  }

  return {
    ok: errors.length === 0,
    manifestSlides: slides.length,
    deckSlides: deckSlideCount,
    errors,
    warnings,
  };
}

async function main() {
  const [manifestPath, pptxPath] = process.argv.slice(2);
  if (!manifestPath || !pptxPath) {
    throw new Error("用法：validate_delivery.mjs <构建清单.json> <演示文稿.pptx>");
  }
  const report = await validateDelivery(manifestPath, pptxPath);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  });
}

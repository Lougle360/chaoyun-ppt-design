import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const MODES = new Set(["full-image", "hybrid", "native-data"]);

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

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} 必须是非空字符串`);
  }
}

function requirePosition(position, label) {
  if (!position || typeof position !== "object") {
    throw new Error(`${label} 必须是对象`);
  }
  for (const key of ["left", "top", "width", "height"]) {
    if (!Number.isFinite(position[key])) {
      throw new Error(`${label}.${key} 必须是有限数值`);
    }
  }
}

export function validateManifestShape(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("构建清单必须是 JSON 对象");
  }
  requireString(manifest.deckTitle, "deckTitle");
  if (!Array.isArray(manifest.slides) || manifest.slides.length === 0) {
    throw new Error("slides 必须是非空数组");
  }

  const seen = new Set();
  for (const [index, slide] of manifest.slides.entries()) {
    const expectedPage = index + 1;
    if (slide.page !== expectedPage) {
      throw new Error(`slides[${index}].page 必须为 ${expectedPage}`);
    }
    if (seen.has(slide.page)) {
      throw new Error(`页码重复：${slide.page}`);
    }
    seen.add(slide.page);
    requireString(slide.type, `slides[${index}].type`);
    if (!MODES.has(slide.mode)) {
      throw new Error(`slides[${index}].mode 只能是 full-image、hybrid 或 native-data`);
    }
    requireString(slide.image, `slides[${index}].image`);
    requireString(slide.alt, `slides[${index}].alt`);
    requireString(slide.promptFile, `slides[${index}].promptFile`);
    if (!Array.isArray(slide.sourceAnchors) || slide.sourceAnchors.length === 0) {
      throw new Error(`slides[${index}].sourceAnchors 必须是非空数组`);
    }
    if (slide.mode === "hybrid" && (!Array.isArray(slide.textBlocks) || slide.textBlocks.length === 0)) {
      throw new Error(`混合页 ${slide.page} 必须包含 textBlocks`);
    }
    for (const [blockIndex, block] of (slide.textBlocks ?? []).entries()) {
      requireString(block.name, `slides[${index}].textBlocks[${blockIndex}].name`);
      requireString(block.text, `slides[${index}].textBlocks[${blockIndex}].text`);
      requirePosition(block.position, `slides[${index}].textBlocks[${blockIndex}].position`);
    }
  }
}

function resolveFromManifest(manifestPath, relativePath) {
  return path.resolve(path.dirname(manifestPath), relativePath);
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  throw new Error(`不支持的图片扩展名：${ext}`);
}

function arrayBufferFrom(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function writeBlob(filePath, blob) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function textStyleFor(block) {
  const style = {
    fontSize: block.fontSize ?? 24,
    fontFamily: block.fontFamily ?? "PingFang SC",
    color: block.color ?? "#111827",
    bold: block.bold ?? false,
    italic: block.italic ?? false,
  };
  if (block.alignment) style.alignment = block.alignment;
  return style;
}

export async function buildPpt(manifestPath, outputPptx, montagePath = null) {
  manifestPath = path.resolve(manifestPath);
  outputPptx = path.resolve(outputPptx);
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  validateManifestShape(manifest);

  const { Presentation, PresentationFile } = await loadArtifactTool();
  const slideSize = manifest.slideSize ?? { width: 1280, height: 720 };
  requirePosition({ left: 0, top: 0, ...slideSize }, "slideSize");
  const presentation = Presentation.create({ slideSize });

  for (const spec of manifest.slides) {
    const imagePath = resolveFromManifest(manifestPath, spec.image);
    const imageBytes = await fs.readFile(imagePath);
    const slide = presentation.slides.add();
    slide.images.add({
      blob: arrayBufferFrom(imageBytes),
      contentType: contentTypeFor(imagePath),
      alt: spec.alt,
      fit: "cover",
      position: { left: 0, top: 0, width: slideSize.width, height: slideSize.height },
    });

    for (const block of spec.textBlocks ?? []) {
      const shape = slide.shapes.add({
        geometry: "textbox",
        name: block.name,
        position: block.position,
        fill: block.fill ?? "none",
        line: { style: "solid", fill: "none", width: 0 },
      });
      shape.text = block.text;
      shape.text.style = textStyleFor(block);
    }

    const notes = [];
    if (spec.notes) notes.push(spec.notes.trim());
    notes.push("[Sources]");
    for (const source of spec.sourceAnchors) notes.push(`- ${source}`);
    slide.speakerNotes.textFrame.setText(notes.join("\n"));
  }

  await fs.mkdir(path.dirname(outputPptx), { recursive: true });
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPptx);

  if (montagePath) {
    const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
    await writeBlob(path.resolve(montagePath), montage);
  }

  return { outputPptx, slideCount: manifest.slides.length, montagePath: montagePath ? path.resolve(montagePath) : null };
}

async function main() {
  const [manifestPath, outputPptx, montagePath] = process.argv.slice(2);
  if (!manifestPath || !outputPptx) {
    throw new Error("用法：build_ppt.mjs <构建清单.json> <输出.pptx> [缩略图.webp]");
  }
  const result = await buildPpt(manifestPath, outputPptx, montagePath ?? null);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  });
}

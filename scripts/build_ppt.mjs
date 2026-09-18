import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import PptxGenJS from "pptxgenjs";

const MODES = new Set(["full-image"]);
const PX_PER_INCH = 96;

function pxToIn(px) {
  return px / PX_PER_INCH;
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
      throw new Error(`slides[${index}].mode 只能是 full-image`);
    }
    requireString(slide.image, `slides[${index}].image`);
    requireString(slide.alt, `slides[${index}].alt`);
    requireString(slide.promptFile, `slides[${index}].promptFile`);
    if (!Array.isArray(slide.sourceAnchors) || slide.sourceAnchors.length === 0) {
      throw new Error(`slides[${index}].sourceAnchors 必须是非空数组`);
    }
  }
}

function resolveFromManifest(manifestPath, relativePath) {
  return path.resolve(path.dirname(manifestPath), relativePath);
}

async function generateMontage(manifest, manifestPath, montagePath) {
  const sharp = (await import("sharp")).default;
  const slides = manifest.slides;
  const slideSize = manifest.slideSize ?? { width: 1280, height: 720 };
  const cols = Math.ceil(Math.sqrt(slides.length));
  const rows = Math.ceil(slides.length / cols);
  const thumbW = 320;
  const thumbH = Math.round((thumbW * slideSize.height) / slideSize.width);
  const canvasW = cols * thumbW;
  const canvasH = rows * thumbH;

  const composites = [];
  for (let i = 0; i < slides.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const imagePath = resolveFromManifest(manifestPath, slides[i].image);
    const buffer = await sharp(imagePath).resize(thumbW, thumbH).toBuffer();
    composites.push({ input: buffer, left: col * thumbW, top: row * thumbH });
  }

  await fs.mkdir(path.dirname(path.resolve(montagePath)), { recursive: true });
  await sharp({
    create: { width: canvasW, height: canvasH, channels: 3, background: "#ffffff" },
  })
    .composite(composites)
    .webp()
    .toFile(path.resolve(montagePath));
}

export async function buildPpt(manifestPath, outputPptx, montagePath = null) {
  manifestPath = path.resolve(manifestPath);
  outputPptx = path.resolve(outputPptx);
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  validateManifestShape(manifest);

  const slideSize = manifest.slideSize ?? { width: 1280, height: 720 };
  requirePosition({ left: 0, top: 0, ...slideSize }, "slideSize");
  const slideW = pxToIn(slideSize.width);
  const slideH = pxToIn(slideSize.height);

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "CHAoyunCustom", width: slideW, height: slideH });
  pptx.layout = "CHAoyunCustom";
  pptx.author = "chaoyun-ppt-design";
  pptx.title = manifest.deckTitle;

  for (const spec of manifest.slides) {
    const imagePath = resolveFromManifest(manifestPath, spec.image);
    const slide = pptx.addSlide();

    slide.addImage({
      path: imagePath,
      x: 0,
      y: 0,
      w: slideW,
      h: slideH,
    });

    const notes = [];
    if (spec.notes) notes.push(spec.notes.trim());
    notes.push("[Sources]");
    for (const source of spec.sourceAnchors) notes.push(`- ${source}`);
    slide.addNotes(notes.join("\n"));
  }

  await fs.mkdir(path.dirname(outputPptx), { recursive: true });
  await pptx.writeFile({ fileName: outputPptx });

  if (montagePath) {
    await generateMontage(manifest, manifestPath, montagePath);
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

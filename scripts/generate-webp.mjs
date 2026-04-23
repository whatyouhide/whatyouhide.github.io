// Walk public/ image roots and generate a .webp sibling next to every .png/.jpg/.jpeg.
// Idempotent: skips files whose .webp already exists and is newer than the source.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const ROOTS = ["public/posts", "public/places", "public/assets/media"];
const EXT = new Set([".png", ".jpg", ".jpeg"]);

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return;
    throw err;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && EXT.has(path.extname(entry.name).toLowerCase())) {
      yield full;
    }
  }
}

async function needsRebuild(src, webp) {
  try {
    const [srcStat, webpStat] = await Promise.all([fs.stat(src), fs.stat(webp)]);
    return webpStat.mtimeMs < srcStat.mtimeMs;
  } catch {
    return true;
  }
}

let generated = 0;
let skipped = 0;

for (const rel of ROOTS) {
  const dir = path.join(ROOT, rel);
  for await (const src of walk(dir)) {
    const webp = src.replace(/\.(png|jpg|jpeg)$/i, ".webp");
    if (!(await needsRebuild(src, webp))) {
      skipped += 1;
      continue;
    }
    await sharp(src).webp({ quality: 82 }).toFile(webp);
    generated += 1;
    console.log(`  ${path.relative(ROOT, webp)}`);
  }
}

console.log(`\n${generated} generated, ${skipped} up-to-date.`);

// One-shot: move post & place images out of content collections and into public/,
// then rewrite references so Astro doesn't touch them (no hashing, no WebP, no /_astro/).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

function moveCollection(srcDir, publicMountPrefix) {
  const slugs = fs
    .readdirSync(srcDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const slug of slugs) {
    const postDir = path.join(srcDir, slug);
    const publicTargetDir = path.join(
      ROOT,
      "public",
      publicMountPrefix,
      slug
    );
    const assets = fs
      .readdirSync(postDir, { withFileTypes: true })
      .filter(
        (d) => d.isFile() && IMAGE_EXT.has(path.extname(d.name).toLowerCase())
      )
      .map((d) => d.name);

    if (assets.length === 0) continue;

    fs.mkdirSync(publicTargetDir, { recursive: true });
    for (const name of assets) {
      fs.renameSync(
        path.join(postDir, name),
        path.join(publicTargetDir, name)
      );
    }
    console.log(`  ${slug}: moved ${assets.length} asset(s)`);

    // Rewrite the MDX.
    const mdxPath = path.join(postDir, "index.mdx");
    if (!fs.existsSync(mdxPath)) continue;
    let mdx = fs.readFileSync(mdxPath, "utf8");

    for (const name of assets) {
      const newUrl = `/${publicMountPrefix}/${slug}/${name}`;
      // markdown: ![alt](./name) or ![alt](name)
      mdx = mdx.replace(
        new RegExp(
          `\\]\\(\\.?\\/?${escapeRegex(name)}\\)`,
          "g"
        ),
        `](${newUrl})`
      );
      // frontmatter coverImage: ./name  →  coverImage: /prefix/slug/name
      mdx = mdx.replace(
        new RegExp(
          `^(coverImage:\\s*)\\.?\\/?${escapeRegex(name)}\\s*$`,
          "m"
        ),
        `$1${newUrl}`
      );
      // MDX imports: import foo from "./name" — collect & remove, convert usages.
      const importRe = new RegExp(
        `^import\\s+(\\w+)\\s+from\\s+["']\\.\\/${escapeRegex(name)}["'];?\\s*\\n`,
        "m"
      );
      const importMatch = mdx.match(importRe);
      if (importMatch) {
        const varName = importMatch[1];
        mdx = mdx.replace(importRe, "");
        // Replace JSX `src={varName}` with string: src="/prefix/slug/name"
        mdx = mdx.replace(
          new RegExp(`src=\\{${escapeRegex(varName)}\\}`, "g"),
          `src="${newUrl}"`
        );
      }
    }
    fs.writeFileSync(mdxPath, mdx);
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

console.log("Posts:");
moveCollection(path.join(ROOT, "src/content/posts"), "posts");
console.log("Places:");
moveCollection(path.join(ROOT, "src/content/places"), "places");
console.log("\nDone.");

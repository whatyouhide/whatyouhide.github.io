import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, "../../content/posts");
const DEST = path.resolve(__dirname, "../src/content/posts");

const DIR_RE = /^(\d{4})-(\d{2})-(\d{2})-(.+)$/;

const SHORTCODE_IMPORTS = {
  Callout: 'import Callout from "../../../components/Callout.astro";',
  UnsplashCredit: 'import UnsplashCredit from "../../../components/UnsplashCredit.astro";',
  YouTube: 'import YouTube from "../../../components/YouTube.astro";',
};

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error("No frontmatter found");
  const data = yaml.load(match[1]);
  const body = match[2];
  return { data, body };
}

function normalizeFrontmatter(data, date) {
  const out = {
    title: data.title,
    description: String(data.description).trim(),
    date,
  };
  if (data.updated) out.updated = data.updated;

  const extra = data.extra || {};
  if (extra.cover_image) out.coverImage = "./" + extra.cover_image;
  if (extra.math) out.math = true;

  const tags = data.taxonomies?.tags ?? data.tags;
  if (tags?.length) out.tags = tags;

  if (data.aliases?.length) out.aliases = data.aliases;

  return out;
}

function transformBody(body) {
  const used = new Set();

  // {% raw %} / {% endraw %} — redundant inside MDX code fences.
  body = body.replace(/\{%\s*raw\s*%\}\n?/g, "");
  body = body.replace(/\{%\s*endraw\s*%\}\n?/g, "");

  // <!-- more --> → MDX comment
  body = body.replace(/<!--\s*more\s*-->/g, "{/* more */}");

  // Self-close void HTML tags (MDX requires JSX-compliant tags).
  body = body.replace(/<(img|br|hr|input)([^>]*?)(?<!\/)>/g, "<$1$2 />");

  // {% callout(type="X", title="Y") %} ... {% end %}
  body = body.replace(
    /\{%\s*callout\((.*?)\)\s*%\}([\s\S]*?)\{%\s*end\s*%\}/g,
    (_, args, inner) => {
      used.add("Callout");
      const attrs = parseArgs(args);
      return `<Callout${renderAttrs(attrs)}>\n${inner.trim()}\n</Callout>`;
    }
  );

  // {{ unsplash_credit(name="X", link="Y") }}
  body = body.replace(
    /\{\{\s*unsplash_credit\((.*?)\)\s*\}\}/g,
    (_, args) => {
      used.add("UnsplashCredit");
      const attrs = parseArgs(args);
      return `<UnsplashCredit${renderAttrs(attrs)} />`;
    }
  );

  // {{ youtube(id="X", class="Y") }}
  body = body.replace(/\{\{\s*youtube\((.*?)\)\s*\}\}/g, (_, args) => {
    used.add("YouTube");
    const attrs = parseArgs(args);
    // Zola passes `class=`; HTML attr in JSX would be `class` in Astro (Astro accepts class).
    return `<YouTube${renderAttrs(attrs)} />`;
  });

  // {{ summary_tag(text="`X`") }} — always inline-code in practice, inline directly.
  body = body.replace(/\{\{\s*summary_tag\((.*?)\)\s*\}\}/g, (_, args) => {
    const attrs = parseArgs(args);
    const text = attrs.text ?? "";
    // strip wrapping backticks if present — Zola ran markdown(inline=true).
    const m = text.match(/^`(.+)`$/);
    const inner = m ? `<code>${escapeHtml(m[1])}</code>` : escapeHtml(text);
    return `<summary>${inner}</summary>`;
  });

  return { body, used };
}

function parseArgs(str) {
  // Parses `name="value", name2="value2"` — values are always double-quoted in practice.
  const out = {};
  const re = /(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(str))) {
    out[m[1]] = m[2];
  }
  return out;
}

function renderAttrs(attrs) {
  return Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${v.replace(/"/g, "&quot;")}"`)
    .join("");
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildMdx(frontmatter, usedShortcodes, body) {
  const fm = yaml.dump(frontmatter, { lineWidth: -1 }).trimEnd();
  const imports = [...usedShortcodes]
    .map((name) => SHORTCODE_IMPORTS[name])
    .filter(Boolean);
  const importBlock = imports.length ? "\n" + imports.join("\n") + "\n" : "";
  return `---\n${fm}\n---\n${importBlock}\n${body.trimStart()}\n`;
}

function copyAssets(srcDir, destDir) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name !== "index.md") {
      fs.copyFileSync(path.join(srcDir, entry.name), path.join(destDir, entry.name));
    }
  }
}

function migrate() {
  const dirs = fs
    .readdirSync(SRC, { withFileTypes: true })
    .filter((d) => d.isDirectory() && DIR_RE.test(d.name));

  let migrated = 0;
  for (const dir of dirs) {
    const m = dir.name.match(DIR_RE);
    const [, y, mo, d, slug] = m;
    const date = `${y}-${mo}-${d}`;
    const srcDir = path.join(SRC, dir.name);
    const destDir = path.join(DEST, slug);

    fs.mkdirSync(destDir, { recursive: true });

    const raw = fs.readFileSync(path.join(srcDir, "index.md"), "utf8");
    const { data, body } = parseFrontmatter(raw);
    const frontmatter = normalizeFrontmatter(data, date);
    const { body: newBody, used } = transformBody(body);
    const mdx = buildMdx(frontmatter, used, newBody);

    fs.writeFileSync(path.join(destDir, "index.mdx"), mdx);
    copyAssets(srcDir, destDir);
    migrated += 1;
    console.log(`✓ ${slug}`);
  }
  console.log(`\nMigrated ${migrated} posts.`);
}

migrate();

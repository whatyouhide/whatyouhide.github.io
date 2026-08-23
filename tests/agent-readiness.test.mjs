import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, ROOT), "utf8");
}

test("robots.txt allows each audited agent crawler", async () => {
  const robots = await read("dist/robots.txt");
  const agents = [
    "OAI-SearchBot",
    "GPTBot",
    "ChatGPT-User",
    "ClaudeBot",
    "PerplexityBot",
    "Google-Extended",
    "DeepSeekBot",
    "ora-agent",
  ];

  for (const agent of agents) {
    const group = new RegExp(`User-agent: ${agent}\\s+Allow: /`, "i");
    assert.match(robots, group, `${agent} must have an explicit Allow rule`);
  }
});

test("robots.txt blocks training-only crawlers", async () => {
  const robots = await read("dist/robots.txt");
  const agents = ["CCBot", "Bytespider"];

  for (const agent of agents) {
    const group = new RegExp(`User-agent: ${agent}\\s+Disallow: /`, "i");
    assert.match(robots, group, `${agent} must have an explicit Disallow rule`);
  }
});

test("all blog posts have valid sitemap lastmod dates", async () => {
  const sitemap = await read("dist/sitemap.xml");
  const postEntries = sitemap.match(
    /<url><loc>[^<]+\/posts\/[^<]+<\/loc>(?:<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>)?<\/url>/g
  ) ?? [];
  const datedPostEntries = postEntries.filter((entry) =>
    /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(entry)
  );

  assert.ok(postEntries.length > 0, "sitemap must contain blog posts");
  assert.equal(
    datedPostEntries.length,
    postEntries.length,
    "every blog post must have a lastmod date"
  );
  assert.match(
    sitemap,
    /<loc>https:\/\/andrealeopardi\.com\/posts\/advent-of-code-2022\/<\/loc><lastmod>2022-12-26<\/lastmod>/,
    "updated must take precedence over the original publication date"
  );
});

test("the raw homepage HTML has useful text and a heading hierarchy", async () => {
  const html = await read("dist/index.html");
  const h1Position = html.search(/<h1\b/i);
  const h2Position = html.search(/<h2\b/i);
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  assert.ok(h1Position >= 0, "homepage must contain an H1");
  assert.ok(h2Position > h1Position, "homepage must contain an H2 after its H1");
  assert.ok(text.length >= 500, `homepage must contain at least 500 text chars, got ${text.length}`);
});

test("the homepage Markdown representation is useful and structured", async () => {
  const markdown = await read("dist/index.md");

  assert.match(markdown, /^# Andrea Leopardi$/m);
  assert.match(markdown, /^## Site sections$/m);
  assert.match(markdown, /^## Recent posts$/m);
  assert.ok(markdown.length >= 500, "homepage Markdown must contain at least 500 chars");
});

test("all machine-readable site files build with content", async () => {
  const files = ["robots.txt", "llms.txt", "sitemap.xml", "feed.xml", "index.md"];

  for (const file of files) {
    const body = await read(`dist/${file}`);
    assert.ok(body.trim().length > 0, `${file} must not be empty`);
  }
});

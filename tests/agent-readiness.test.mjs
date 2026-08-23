import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, ROOT), "utf8");
}

function jsonLdNodes(html) {
  const scripts = [...html.matchAll(
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  )].map((match) => JSON.parse(match[1]));

  return scripts.flatMap((data) =>
    Array.isArray(data["@graph"]) ? data["@graph"] : [data]
  );
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

test("JSON-LD describes the site, profile, blog, and posts", async () => {
  const homepageNodes = jsonLdNodes(await read("dist/index.html"));
  const person = homepageNodes.find((node) => node["@type"] === "Person");
  const website = homepageNodes.find((node) => node["@type"] === "WebSite");
  const profile = homepageNodes.find((node) => node["@type"] === "ProfilePage");

  assert.ok(person, "homepage must describe Andrea as a Person");
  assert.ok(website, "homepage must describe the WebSite");
  assert.ok(profile, "homepage must describe itself as a ProfilePage");
  assert.equal(person["@id"], "https://andrealeopardi.com/#person");
  assert.equal(website["@id"], "https://andrealeopardi.com/#website");
  assert.equal(website.author["@id"], person["@id"]);
  assert.equal(profile.mainEntity["@id"], person["@id"]);
  assert.equal(profile.isPartOf["@id"], website["@id"]);
  assert.ok(profile.hasPart.length > 0, "profile must reference recent posts");

  const postsNodes = jsonLdNodes(await read("dist/posts/index.html"));
  const blog = postsNodes.find((node) => node["@type"] === "Blog");
  assert.ok(blog, "posts index must describe itself as a Blog");
  assert.equal(blog["@id"], "https://andrealeopardi.com/posts/#blog");
  assert.ok(blog.blogPost.length > 0, "blog must reference its posts");
  assert.ok(
    blog.blogPost.every((post) => post.author["@id"] === person["@id"]),
    "every blog post must reference the canonical Person"
  );

  const postNodes = jsonLdNodes(
    await read("dist/posts/sharing-protobuf-schemas-across-services/index.html")
  );
  const post = postNodes.find((node) => node["@type"] === "BlogPosting");
  assert.ok(post, "post page must describe itself as a BlogPosting");
  assert.equal(post.headline, "Sharing Protobuf schemas across services");
  assert.equal(post.author["@id"], person["@id"]);
  assert.equal(post.isPartOf["@id"], blog["@id"]);
  assert.equal(post.mainEntityOfPage["@id"], post.url);
  assert.match(post.datePublished, /^2020-02-24T/);
  assert.match(post.dateModified, /^2020-02-24T/);
});

test("the homepage Markdown representation is useful and structured", async () => {
  const markdown = await read("dist/index.md");

  assert.ok(markdown.startsWith("---\n"), "homepage Markdown must open with frontmatter");
  assert.match(markdown, /^title: Andrea Leopardi$/m);
  assert.match(markdown, /^description: .+$/m);
  assert.match(markdown, /^canonical: https:\/\/andrealeopardi\.com\/$/m);
  assert.match(markdown, /^last-updated: \d{4}-\d{2}-\d{2}$/m);
  assert.match(markdown, /^# Andrea Leopardi$/m);
  assert.match(markdown, /^## Site sections$/m);
  assert.match(markdown, /^## Recent posts$/m);
  assert.ok(markdown.length >= 500, "homepage Markdown must contain at least 500 chars");
});

test("blog posts have portable Markdown representations", async () => {
  const markdown = await read("dist/posts/sharing-protobuf-schemas-across-services.md");

  assert.match(markdown, /^---$/m);
  assert.match(markdown, /^title: Sharing Protobuf schemas across services$/m);
  assert.match(markdown, /^date: '2020-02-24'$/m);
  assert.doesNotMatch(markdown, /^import\s/m);
  assert.ok(markdown.length >= 500, "post Markdown must contain at least 500 chars");
});

test("all machine-readable site files build with content", async () => {
  const files = ["robots.txt", "llms.txt", "sitemap.xml", "feed.xml", "index.md"];

  for (const file of files) {
    const body = await read(`dist/${file}`);
    assert.ok(body.trim().length > 0, `${file} must not be empty`);
  }
});

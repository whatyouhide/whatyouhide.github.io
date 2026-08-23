import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import worker, {
  addMissingAgentCrawlerRules,
  rewriteHomepageHeading,
} from "../andrealeopardi-worker/src/index.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function setOrigin(routes) {
  globalThis.fetch = async (request) => {
    const url = new URL(typeof request === "string" ? request : request.url);
    const route = routes[url.pathname];
    if (!route) return new Response("Not found", { status: 404 });
    return new Response(route.body, {
      status: route.status ?? 200,
      headers: {
        "Content-Type": route.contentType,
        "Vary": "Accept-Encoding",
      },
    });
  };
}

function varyTokens(response) {
  return response.headers
    .get("Vary")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .sort();
}

test("serves HTML by default and advertises homepage Markdown", async () => {
  setOrigin({
    "/": { body: "<h1>Andrea</h1>", contentType: "text/html; charset=utf-8" },
  });

  const response = await worker.fetch(new Request("https://example.com/"));

  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /^text\/html/);
  assert.deepEqual(varyTokens(response), ["accept", "accept-encoding"]);
  assert.equal(
    response.headers.get("Link"),
    '</index.md>; rel="alternate"; type="text/markdown"'
  );
});

test("serves the direct homepage Markdown alternate from llms.txt during rollout", async () => {
  setOrigin({
    "/llms.txt": { body: "# Andrea from llms.txt\n", contentType: "text/plain; charset=utf-8" },
  });

  const response = await worker.fetch(new Request("https://example.com/index.md"));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/markdown; charset=utf-8");
  assert.equal(await response.text(), "# Andrea from llms.txt\n");
});

test("serves homepage Markdown with protocol headers", async () => {
  setOrigin({
    "/index.md": { body: "# Andrea Leopardi\n", contentType: "text/plain; charset=utf-8" },
  });

  const response = await worker.fetch(
    new Request("https://example.com/", { headers: { Accept: "text/markdown" } })
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/markdown; charset=utf-8");
  assert.deepEqual(varyTokens(response), ["accept", "accept-encoding"]);
  assert.equal(await response.text(), "# Andrea Leopardi\n");
});

test("uses llms.txt while the homepage Markdown sibling is missing", async () => {
  setOrigin({
    "/llms.txt": { body: "# Andrea from llms.txt\n", contentType: "text/plain; charset=utf-8" },
  });

  const response = await worker.fetch(
    new Request("https://example.com/", { headers: { Accept: "text/markdown" } })
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/markdown; charset=utf-8");
  assert.deepEqual(varyTokens(response), ["accept", "accept-encoding"]);
  assert.equal(await response.text(), "# Andrea from llms.txt\n");
});

test("honors quality values and client order", async () => {
  setOrigin({
    "/": { body: "<h1>Andrea</h1>", contentType: "text/html; charset=utf-8" },
    "/index.md": { body: "# Andrea\n", contentType: "text/plain; charset=utf-8" },
  });

  const html = await worker.fetch(
    new Request("https://example.com/", {
      headers: { Accept: "text/markdown;q=0.5, text/html;q=0.9" },
    })
  );
  assert.match(html.headers.get("Content-Type"), /^text\/html/);

  const markdown = await worker.fetch(
    new Request("https://example.com/", {
      headers: { Accept: "text/markdown, text/html;q=0.8" },
    })
  );
  assert.equal(markdown.headers.get("Content-Type"), "text/markdown; charset=utf-8");
});

test("a specific rejection overrides a wildcard", async () => {
  setOrigin({
    "/index.md": { body: "# Andrea\n", contentType: "text/plain; charset=utf-8" },
  });

  const response = await worker.fetch(
    new Request("https://example.com/", {
      headers: { Accept: "text/html;q=0, */*;q=1" },
    })
  );

  assert.equal(response.headers.get("Content-Type"), "text/markdown; charset=utf-8");
});

test("returns 406 when no offered representation is acceptable", async () => {
  setOrigin({});

  const response = await worker.fetch(
    new Request("https://example.com/", { headers: { Accept: "application/pdf" } })
  );

  assert.equal(response.status, 406);
  assert.equal(response.headers.get("Content-Type"), "text/plain; charset=utf-8");
  assert.deepEqual(varyTokens(response), ["accept", "accept-encoding"]);
});

test("returns 406 when a required Markdown sibling is missing", async () => {
  setOrigin({});

  const response = await worker.fetch(
    new Request("https://example.com/about/", {
      headers: { Accept: "text/markdown, text/html;q=0" },
    })
  );

  assert.equal(response.status, 406);
  assert.deepEqual(varyTokens(response), ["accept", "accept-encoding"]);
});

test("adds only missing audited crawler groups to robots.txt", () => {
  const robots = addMissingAgentCrawlerRules("User-agent: GPTBot\nAllow: /\n");

  assert.equal((robots.match(/^User-agent: GPTBot$/gim) ?? []).length, 1);
  assert.match(robots, /^User-agent: ChatGPT-User\s+Allow: /im);
  assert.match(robots, /^User-agent: ClaudeBot\s+Allow: /im);
});

test("rewrites the homepage label as an H2 without layout margins", () => {
  class FakeHTMLRewriter {
    static element;

    on(selector, handlers) {
      assert.equal(selector, ".shell-section-label");
      this.handlers = handlers;
      return this;
    }

    transform(response) {
      const attributes = new Map();
      const element = {
        tagName: "span",
        getAttribute(name) {
          return attributes.get(name) ?? null;
        },
        setAttribute(name, value) {
          attributes.set(name, value);
        },
      };
      this.handlers.element(element);
      FakeHTMLRewriter.element = { element, attributes };
      return response;
    }
  }

  const response = new Response("<span class=\"shell-section-label\">posts</span>");
  assert.equal(rewriteHomepageHeading(response, FakeHTMLRewriter), response);
  assert.equal(FakeHTMLRewriter.element.element.tagName, "h2");
  assert.equal(
    FakeHTMLRewriter.element.attributes.get("style"),
    "margin:0;line-height:inherit"
  );
});

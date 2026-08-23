function parseAccept(header) {
  return header
    .split(",")
    .map((raw) => {
      const parts = raw.trim().split(";").map((part) => part.trim());
      const type = parts[0].toLowerCase();
      if (!type) return null;

      let q = 1;
      for (const parameter of parts.slice(1)) {
        const [name, value] = parameter.split("=").map((part) => part.trim());
        if (name.toLowerCase() === "q") {
          const parsed = Number(value);
          if (!Number.isNaN(parsed)) q = Math.max(0, Math.min(1, parsed));
        }
      }

      const specificity = type === "*/*" ? 0 : type.endsWith("/*") ? 1 : 2;
      return { type, q, specificity };
    })
    .filter((entry) => entry !== null);
}

function matches(entry, candidate) {
  if (entry.type === "*/*") return true;
  if (entry.type.endsWith("/*")) {
    return candidate.startsWith(entry.type.slice(0, -1));
  }
  return entry.type === candidate;
}

function preferredType(header, produces) {
  if (!header) return produces[0] ?? null;

  const entries = parseAccept(header);
  if (entries.length === 0) return produces[0] ?? null;

  let bestType = null;
  let bestQ = -1;
  let bestPosition = Infinity;

  for (const candidate of produces) {
    let matched = null;
    let matchedPosition = Infinity;

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (!matches(entry, candidate)) continue;
      if (
        matched === null ||
        entry.specificity > matched.specificity ||
        (entry.specificity === matched.specificity && index < matchedPosition)
      ) {
        matched = entry;
        matchedPosition = index;
      }
    }

    if (matched === null || matched.q <= 0) continue;
    if (matched.q > bestQ || (matched.q === bestQ && matchedPosition < bestPosition)) {
      bestType = candidate;
      bestQ = matched.q;
      bestPosition = matchedPosition;
    }
  }

  return bestType;
}

function ensureVary(headers) {
  const existing = headers.get("Vary");
  const tokens = existing
    ? existing.split(",").map((value) => value.trim()).filter(Boolean)
    : [];
  const lower = tokens.map((value) => value.toLowerCase());

  for (const value of ["Accept", "Accept-Encoding"]) {
    if (!lower.includes(value.toLowerCase())) tokens.push(value);
  }

  headers.set("Vary", tokens.join(", "));
}

const AUDITED_AGENT_CRAWLERS = [
  "OAI-SearchBot",
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
  "DeepSeekBot",
  "ora-agent",
];

const MARKDOWN_NOT_FOUND = `# Page not found

The requested URL does not exist. Use one of these links to find the content you need:

- [Home](/)
- [All posts](/posts/)
- [Agent guide](/llms.txt)
- [Sitemap](/sitemap.xml)
`;

export function addMissingAgentCrawlerRules(robots) {
  const additions = AUDITED_AGENT_CRAWLERS
    .filter((agent) => !new RegExp(`^User-agent: ${agent}$`, "im").test(robots))
    .map((agent) => `User-agent: ${agent}\nAllow: /`);

  if (additions.length === 0) return robots;
  return `${robots.trimEnd()}\n\n${additions.join("\n\n")}\n`;
}

export function rewriteHomepageHeading(response, Rewriter = globalThis.HTMLRewriter) {
  if (!Rewriter) return response;

  return new Rewriter()
    .on(".shell-section-label", {
      element(element) {
        element.tagName = "h2";
        const currentStyle = element.getAttribute("style");
        const stableHeadingStyle = "margin:0;line-height:inherit";
        element.setAttribute(
          "style",
          currentStyle ? `${currentStyle};${stableHeadingStyle}` : stableHeadingStyle
        );
      },
    })
    .transform(response);
}

// Astro emits content-hashed filenames under /_astro/, safe to cache forever.
// Fonts never change, so also get a long TTL. Other static assets are left
// with origin cache headers: their filenames are stable, so replacing them
// in place would strand stale versions in browsers for too long.
const IMMUTABLE_PATH = /^\/_astro\//;
const LONG_LIVED_PATH = /^\/assets\/fonts\//;

function cacheControlFor(pathname) {
  if (IMMUTABLE_PATH.test(pathname)) return "public, max-age=31536000, immutable";
  if (LONG_LIVED_PATH.test(pathname)) return "public, max-age=2592000";
  return null;
}

export default {
  async fetch(request) {
    // Content negotiation only applies to safe, read-only methods.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return fetch(request);
    }

    const url = new URL(request.url);

    if (url.pathname === "/robots.txt") {
      const res = await fetch(request);
      const body = addMissingAgentCrawlerRules(await res.text());
      const out = new Response(request.method === "HEAD" ? null : body, res);
      out.headers.delete("Content-Length");
      return out;
    }

    if (url.pathname === "/.well-known/ai-catalog.json") {
      const res = await fetch(request);
      const out = new Response(res.body, res);
      if (res.status === 200) {
        out.headers.set("Content-Type", "application/ai-catalog+json; charset=utf-8");
      }
      return out;
    }

    if (url.pathname === "/index.md") {
      let res = await fetch(request);
      if (res.status === 404) {
        const llmsUrl = new URL("/llms.txt" + url.search, url.origin);
        res = await fetch(new Request(llmsUrl, request));
      }

      const out = new Response(res.body, res);
      if (res.status === 200) {
        out.headers.set("Content-Type", "text/markdown; charset=utf-8");
      }
      return out;
    }

    // Only rewrite "page-like" paths: no file extension.
    const looksLikePage = !/\.[a-z0-9]+$/i.test(url.pathname);
    if (!looksLikePage) {
      const res = await fetch(request);
      const out = new Response(res.body, res);
      if (url.pathname.endsWith(".md") && res.status === 200) {
        out.headers.set("Content-Type", "text/markdown; charset=utf-8");
      }
      const cc = cacheControlFor(url.pathname);
      if (cc) out.headers.set("Cache-Control", cc);
      return out;
    }

    const accept = request.headers.get("accept");
    const chosen = preferredType(accept, ["text/html", "text/markdown"]);

    if (chosen === null && accept) {
      const out = new Response(
        "Not Acceptable\n\nAvailable: text/html, text/markdown.\n",
        {
          status: 406,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }
      );
      ensureVary(out.headers);
      return out;
    }

    if (chosen !== "text/markdown") {
      const res = await fetch(request);
      const out = new Response(res.body, res);
      ensureVary(out.headers);

      if (url.pathname === "/" && res.headers.get("content-type")?.includes("text/html")) {
        out.headers.append(
          "Link",
          '</index.md>; rel="alternate"; type="text/markdown"'
        );
        return rewriteHomepageHeading(out);
      }

      return out;
    }

    // /foo/ -> /foo.md ; /foo -> /foo.md ; / -> /index.md
    let mdPath;
    if (url.pathname === "/") {
      mdPath = "/index.md";
    } else {
      const trimmed = url.pathname.replace(/\/$/, "");
      mdPath = trimmed + ".md";
    }

    const mdUrl = new URL(mdPath + url.search, url.origin);
    let mdRes = await fetch(new Request(mdUrl, request));

    // Keep homepage negotiation live while GitHub Pages deploys /index.md.
    if (mdRes.status === 404 && url.pathname === "/") {
      const llmsUrl = new URL("/llms.txt" + url.search, url.origin);
      mdRes = await fetch(new Request(llmsUrl, request));
    }

    if (mdRes.status === 404) {
      const res = await fetch(request);

      if (res.status === 404) {
        const out = new Response(
          request.method === "HEAD" ? null : MARKDOWN_NOT_FOUND,
          {
            status: 404,
            headers: { "Content-Type": "text/markdown; charset=utf-8" },
          }
        );
        ensureVary(out.headers);
        return out;
      }

      const htmlChoice = preferredType(accept, ["text/html"]);
      if (htmlChoice) {
        const out = new Response(res.body, res);
        ensureVary(out.headers);
        return out;
      }

      const out = new Response(
        "Not Acceptable\n\nMarkdown representation is not available for this URL.\n",
        {
          status: 406,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }
      );
      ensureVary(out.headers);
      return out;
    }

    const out = new Response(mdRes.body, mdRes);
    out.headers.set("Content-Type", "text/markdown; charset=utf-8");
    ensureVary(out.headers);
    return out;
  },
};

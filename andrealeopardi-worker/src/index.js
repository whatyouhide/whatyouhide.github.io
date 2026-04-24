// Parse Accept into [{type, q, spec}]. Shared by all helpers below.
function parseAccept(accept) {
  return accept.split(",").map(raw => {
    const [type, ...params] = raw.trim().split(";").map(s => s.trim());
    const qp = params.find(p => p.startsWith("q="));
    const q = qp ? parseFloat(qp.slice(2)) : 1.0;
    let spec = 3;                               // fully specific, e.g. text/markdown
    if (type === "*/*") spec = 1;
    else if (type.endsWith("/*")) spec = 2;
    return { type: type.toLowerCase(), q, spec };
  });
}

// True iff text/markdown is the preferred satisfiable type over HTML-family types.
function prefersMarkdown(accept) {
  if (!accept) return false;
  const entries = parseAccept(accept);

  const md = entries.find(e =>
    e.type === "text/markdown" || e.type.startsWith("text/markdown;")
  );
  if (!md || md.q === 0) return false;

  const htmlQ = entries
    .filter(e =>
      e.type === "text/html" ||
      e.type === "application/xhtml+xml" ||
      e.type === "text/*" ||
      e.type === "*/*"
    )
    .sort((a, b) => b.spec - a.spec || b.q - a.q)[0]?.q ?? 0;

  return md.q >= htmlQ;
}

// True iff the client can accept HTML (text/html, application/xhtml+xml, text/*, or */*) with q>0.
// Missing Accept header means "accept anything".
function acceptsHtml(accept) {
  if (!accept) return true;
  const entries = parseAccept(accept);
  return entries.some(e =>
    (e.type === "text/html" ||
     e.type === "application/xhtml+xml" ||
     e.type === "text/*" ||
     e.type === "*/*") && e.q > 0
  );
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

    // Only rewrite "page-like" paths: no file extension.
    const looksLikePage = !/\.[a-z0-9]+$/i.test(url.pathname);
    const accept = request.headers.get("accept");

    if (!looksLikePage || !prefersMarkdown(accept)) {
      // Client explicitly refuses HTML and we have no markdown to offer here → 406.
      if (looksLikePage && !acceptsHtml(accept)) {
        return new Response(
          "No acceptable representation. Available: text/html, text/markdown.\n",
          {
            status: 406,
            headers: {
              "Content-Type": "text/plain",
              "Vary": "Accept",
            },
          }
        );
      }

      const res = await fetch(request);
      const out = new Response(res.body, res);
      out.headers.append("Vary", "Accept");
      const cc = cacheControlFor(url.pathname);
      if (cc) out.headers.set("Cache-Control", cc);
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
    const mdRes = await fetch(mdUrl, { method: request.method });

    if (mdRes.status === 404) {
      return new Response(
        "No text/markdown representation available for this URL.\n",
        {
          status: 406,
          headers: {
            "Content-Type": "text/plain",
            "Vary": "Accept",
          },
        }
      );
    }

    const out = new Response(mdRes.body, mdRes);
    out.headers.set("Content-Type", "text/markdown; charset=utf-8");
    out.headers.set("Vary", "Accept");
    return out;
  },
};
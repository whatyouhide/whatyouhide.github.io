import type { APIContext } from "astro";
import { getCollection } from "astro:content";
import { siteConfig } from "../config";
import { getSortedPosts, postUrl } from "../lib/posts";

const STATIC_PATHS = [
  "/",
  "/about/",
  "/books/",
  "/now/",
  "/posts/",
  "/privacy/",
  "/teaching/",
  "/travels/",
  "/uses/",
];

export async function GET(context: APIContext) {
  const baseUrl = (context.site ?? new URL(siteConfig.baseUrl)).toString().replace(/\/$/, "");

  const posts = await getSortedPosts();
  const places = await getCollection("places");

  const paths = [
    ...STATIC_PATHS,
    ...posts.map(postUrl),
    ...places.map((p) => `/places/${p.id.replace(/\/index$/, "")}/`),
  ];

  const urls = paths
    .map((p) => `  <url><loc>${baseUrl}${p}</loc></url>`)
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml" },
  });
}

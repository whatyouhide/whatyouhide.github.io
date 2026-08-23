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

  const entries = [
    ...STATIC_PATHS.map((path) => ({ path })),
    ...posts.map((post) => ({
      path: postUrl(post),
      lastmod: (post.data.updated ?? post.data.date).toISOString().slice(0, 10),
    })),
    ...places.map((place) => ({
      path: `/places/${place.id.replace(/\/index$/, "")}/`,
    })),
  ];

  const urls = entries
    .map(({ path, lastmod }) => {
      const lastmodElement = lastmod ? `<lastmod>${lastmod}</lastmod>` : "";
      return `  <url><loc>${baseUrl}${path}</loc>${lastmodElement}</url>`;
    })
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

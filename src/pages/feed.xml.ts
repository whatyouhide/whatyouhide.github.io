import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { siteConfig } from "../config";
import { getSortedPosts, postUrl } from "../lib/posts";

const FEED_LIMIT = 20;

export async function GET(context: APIContext) {
  const posts = (await getSortedPosts()).slice(0, FEED_LIMIT);
  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: context.site ?? siteConfig.baseUrl,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description,
      link: postUrl(post),
    })),
    customData: `<language>en</language>`,
  });
}

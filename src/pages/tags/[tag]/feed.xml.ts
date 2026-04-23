import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { siteConfig } from "../../../config";
import { getTagCounts, postUrl } from "../../../lib/posts";

const FEED_LIMIT = 20;

export async function getStaticPaths() {
  const tags = await getTagCounts();
  return [...tags.entries()].map(([tag, posts]) => ({
    params: { tag },
    props: { tag, posts },
  }));
}

export async function GET(context: APIContext) {
  const { tag, posts } = context.props as {
    tag: string;
    posts: Awaited<ReturnType<typeof getTagCounts>> extends Map<
      string,
      infer P
    >
      ? P
      : never;
  };
  const items = posts.slice(0, FEED_LIMIT);
  const tagTitle = tag.charAt(0).toUpperCase() + tag.slice(1);
  return rss({
    title: `${siteConfig.title} – ${tagTitle}`,
    description: siteConfig.description,
    site: context.site ?? siteConfig.baseUrl,
    items: items.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description,
      link: postUrl(post),
    })),
    customData: `<language>en</language>`,
  });
}

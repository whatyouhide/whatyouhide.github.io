import type { APIContext } from "astro";
import { siteConfig } from "../config";
import { getSortedPosts, postUrl } from "../lib/posts";

export async function GET(_: APIContext) {
  const posts = (await getSortedPosts()).slice(0, 10);
  const lastUpdated = new Date().toISOString().slice(0, 10);
  const recentPosts = posts
    .map((post) => {
      const url = `${siteConfig.baseUrl}${postUrl(post)}`;
      return `- [${post.data.title}](${url}): ${post.data.description}`;
    })
    .join("\n");

  const body = `---
title: Andrea Leopardi
description: The personal website of Andrea Leopardi, with articles about Elixir, distributed systems, software platforms, testing, and system design.
canonical: ${siteConfig.baseUrl}/
last-updated: ${lastUpdated}
---

# Andrea Leopardi

Andrea Leopardi is a software engineer from Italy. He works as a platform engineer at [Knock](https://knock.app) and has been a member of the [Elixir](https://elixir-lang.org) core team since 2016. His work focuses on Elixir, distributed systems, software platforms, testing, and system design.

He writes technical articles, teaches, and speaks at software events. He co-authored *Testing Elixir* and wrote *Network Programming in Elixir and Erlang*. This site is his public home for articles, teaching material, books, talks, travel notes, and open-source work.

## Site sections

- [Posts](${siteConfig.baseUrl}/posts/): Technical writing about Elixir and software systems
- [Teaching](${siteConfig.baseUrl}/teaching/): Livebooks, videos, and guides
- [Talks](${siteConfig.talksYoutubePlaylistUrl}): Conference talks and other videos
- [Books](${siteConfig.baseUrl}/books/): Books by Andrea
- [Uses](${siteConfig.baseUrl}/uses/): Hardware and software that Andrea uses
- [Travels](${siteConfig.baseUrl}/travels/): Places that Andrea visited
- [Now](${siteConfig.baseUrl}/now/): What Andrea is doing now

## Recent posts

${recentPosts}

## Contact

- [GitHub](https://github.com/${siteConfig.githubUsername})
- Email: ${siteConfig.email}
- RSS: ${siteConfig.baseUrl}/feed.xml
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}

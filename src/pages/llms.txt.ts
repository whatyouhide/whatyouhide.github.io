import type { APIContext } from "astro";
import { siteConfig } from "../config";
import { getSortedPosts, postSlug, postUrl } from "../lib/posts";

const PROSE = `# Andrea Leopardi

> Personal website of Andrea Leopardi, a platform software engineer and Elixir core team member since 2016. Contains blog posts about Elixir, system architecture, and software engineering, along with teaching materials, talks, and open-source work.

Andrea Leopardi is a software engineer from Italy working as a platform engineer at [Knock](https://knock.app). He has been a member of the Elixir programming language core team since 2016 and is an active contributor to the open-source community. His work focuses on Elixir, distributed systems, testing, and system architecture.

He is also a public speaker, trainer, co-author of "Testing Elixir" and author of "Network Programming in Elixir and Erlang" (both published by The Pragmatic Bookshelf). This site serves as his home on the web, featuring technical blog posts, teaching resources, and information about his work.

## Main Pages

- [Home](BASE/): Introduction and overview of the site
- [About](BASE/about/): Biography, career history, and open-source contributions
- [Blog](BASE/posts/): Technical writing about Elixir, system architecture, and software engineering
- [Teaching](BASE/teaching/): Educational materials including Livebooks, screencasts, and guides
- [Books](BASE/books/): Books authored by Andrea
- [Uses](BASE/uses/): Tech stack, tools, and software setup

## Key Open-Source Projects

- [Redix](https://github.com/whatyouhide/redix): Redis client for Elixir
- [Mint](https://github.com/elixir-mint/mint): Functional HTTP client for Elixir
- [Gettext](https://github.com/elixir-gettext/gettext): Internationalization library for Elixir
- [StreamData](https://github.com/whatyouhide/stream_data): Property-based testing library for Elixir

## Notable Content

- [Interactive Guide to Asynchronous Data Processing in Elixir](https://github.com/whatyouhide/guide_async_processing_in_elixir): Series of Livebooks covering async processing patterns
- [Protohackers in Elixir](https://www.youtube.com/playlist?list=PLd7I3U4fDsULTLqbRAkWzA002-IzMe8fl): Screencast series solving network programming puzzles
- [Conference Talks](https://youtube.com/playlist?list=PLd7I3U4fDsUJfNM-N7Kyss66gmml_OSDq): YouTube playlist of public speaking engagements
- [Testing Elixir Book](https://pragprog.com/titles/lmelixir/testing-elixir/): Co-authored book about testing practices in Elixir

## Blog Topics

The blog covers technical topics including:
- Elixir language features and patterns (macros, compilation, parsing)
- TCP and network programming in Elixir
- Property-based testing and library internals
- Using C from Elixir with NIFs
- Connection management with gen_statem
- Protocol Buffers and service architecture
- Process pools and Registry patterns
- Open-source library maintenance

## Contact

- Email: hi@andrealeopardi.com
- Twitter/X: @whatyouhide
- GitHub: @whatyouhide

## Optional

- RSS Feed: Available at BASE/feed.xml for blog updates
- Tags: Blog posts are categorized by tags, with individual tag feeds available
- Raw Markdown: Every post page (e.g. BASE/posts/<slug>/) also exposes its source as BASE/posts/<slug>.md
`;

export async function GET(_: APIContext) {
  const posts = await getSortedPosts();
  const postList = posts
    .map((post) => {
      const url = `${siteConfig.baseUrl}${postUrl(post)}`;
      const rawUrl = `${siteConfig.baseUrl}/posts/${postSlug(post)}.md`;
      return `- [${post.data.title}](${url}) — ${post.data.description} (raw: ${rawUrl})`;
    })
    .join("\n");

  const body =
    PROSE.replace(/BASE/g, siteConfig.baseUrl) +
    "\n## All Blog Posts\n\n" +
    postList +
    "\n";

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

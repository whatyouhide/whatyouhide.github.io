import type { APIContext } from "astro";
import { siteConfig } from "../../config";
import { getSortedPosts, postUrl } from "../../lib/posts";

export async function GET(_: APIContext) {
  const posts = await getSortedPosts();
  const entries = posts
    .map((post) => {
      const path = postUrl(post);
      const canonical = `${siteConfig.baseUrl}${path}`;
      const markdown = `${siteConfig.baseUrl}${path.replace(/\/$/, ".md")}`;
      const date = post.data.date.toISOString().slice(0, 10);
      const description = post.data.description.replace(/\s+/g, " ").trim();
      return `- [${post.data.title}](${markdown}): ${description} Published ${date}. Canonical HTML: ${canonical}`;
    })
    .join("\n");

  const body = `# Andrea Leopardi's posts

> A full index of Andrea Leopardi's writing about Elixir, system design, testing, and software engineering. Each title links to portable Markdown.

## Posts

${entries}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

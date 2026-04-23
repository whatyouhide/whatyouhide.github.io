import type { APIContext } from "astro";
import { getCollection } from "astro:content";
import yaml from "js-yaml";
import { postSlug, type PostEntry } from "../../lib/posts";

export async function getStaticPaths() {
  const posts = await getCollection("posts");
  return posts.map((post) => ({
    params: { slug: postSlug(post) },
    props: { post },
  }));
}

export async function GET({ props }: APIContext) {
  const { post } = props as { post: PostEntry };

  // Drop internal MDX plumbing (component imports) so the file reads as markdown.
  const body = post.body.replace(/^import\s+.+?\s+from\s+["'].+?["'];?\s*\n/gm, "");

  const frontmatter: Record<string, unknown> = {
    title: post.data.title,
    description: post.data.description,
    date: post.data.date.toISOString().slice(0, 10),
  };
  if (post.data.updated) {
    frontmatter.updated = post.data.updated.toISOString().slice(0, 10);
  }
  if (post.data.tags?.length) {
    frontmatter.tags = post.data.tags;
  }

  const output = `---\n${yaml.dump(frontmatter, { lineWidth: -1 })}---\n\n${body.trimStart()}`;

  return new Response(output, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}

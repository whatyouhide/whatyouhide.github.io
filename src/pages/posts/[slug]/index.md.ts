import type { APIContext } from "astro";
import { getCollection } from "astro:content";
import { postSlug } from "../../../lib/posts";

export async function getStaticPaths() {
  const posts = await getCollection("posts");
  return posts.map((post) => ({
    params: { slug: postSlug(post) },
    props: { post },
  }));
}

function yamlScalar(value: string): string {
  // Quote if the string contains YAML-unfriendly chars.
  if (/[:#&*!|>'"%@`\n]/.test(value) || /^\s|\s$/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}

export async function GET({ props }: APIContext) {
  const { post } = props as { post: Awaited<ReturnType<typeof getCollection<"posts">>>[number] };

  // Drop internal MDX plumbing (component imports) so the file reads as markdown.
  const body = post.body
    ? post.body.replace(/^import\s+.+?\s+from\s+["'].+?["'];?\s*\n/gm, "")
    : "";

  const data = post.data;
  const lines = [
    "---",
    `title: ${yamlScalar(data.title)}`,
    `description: ${yamlScalar(data.description)}`,
    `date: ${data.date.toISOString().slice(0, 10)}`,
  ];
  if (data.updated) {
    lines.push(`updated: ${data.updated.toISOString().slice(0, 10)}`);
  }
  if (data.tags?.length) {
    lines.push(`tags: [${data.tags.map((t) => yamlScalar(t)).join(", ")}]`);
  }
  lines.push("---", "");

  const output = lines.join("\n") + body.trimStart();

  return new Response(output, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}

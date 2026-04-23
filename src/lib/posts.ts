import { getCollection, type CollectionEntry } from "astro:content";

export type PostEntry = CollectionEntry<"posts">;

export function postSlug(post: PostEntry): string {
  return post.id.replace(/\/index$/, "");
}

export function postUrl(post: PostEntry): string {
  return `/posts/${postSlug(post)}/`;
}

export async function getSortedPosts(): Promise<PostEntry[]> {
  const posts = await getCollection("posts");
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getTagCounts(): Promise<Map<string, PostEntry[]>> {
  const posts = await getSortedPosts();
  const tags = new Map<string, PostEntry[]>();
  for (const post of posts) {
    for (const tag of post.data.tags ?? []) {
      if (!tags.has(tag)) tags.set(tag, []);
      tags.get(tag)!.push(post);
    }
  }
  return tags;
}

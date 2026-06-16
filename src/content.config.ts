import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const posts = defineCollection({
  loader: glob({ pattern: "**/index.{md,mdx}", base: "./src/content/posts" }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    coverImage: z.union([z.string().startsWith("/"), image()]).optional(),
    math: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    aliases: z.array(z.string().startsWith("/posts/")).default([]),
  }),
});

const places = defineCollection({
  loader: glob({ pattern: "**/index.{md,mdx}", base: "./src/content/places" }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    country: z.string(),
    countryName: z.string(),
    flag: z.string().optional(),
    placeClass: z.string().optional(),
    // Bespoke per-place layouts (ignored by the shared PlaceLayout):
    variant: z.enum(["monument"]).optional(),
    folio: z.string().optional(),
    tagline: z.string().optional(),
    heroStatue: z.string().startsWith("/").optional(),
    heroAlt: z.string().optional(),
  }),
});

export const collections = { posts, places };

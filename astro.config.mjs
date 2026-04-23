import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypePictureWebp from "./scripts/rehype-picture-webp.mjs";

export default defineConfig({
  site: "https://andrealeopardi.com",
  trailingSlash: "always",
  build: {
    format: "directory",
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "ayu-dark",
      },
    },
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex, rehypePictureWebp],
  },
  integrations: [mdx(), sitemap()],
});

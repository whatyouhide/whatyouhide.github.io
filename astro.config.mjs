import { defineConfig } from "astro/config";
import { copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypePictureWebp from "./scripts/rehype-picture-webp.mjs";
import postcssCustomMedia from "postcss-custom-media";

// @astrojs/sitemap emits sitemap-index.xml; mirror it to sitemap.xml so the
// URL advertised in robots.txt resolves.
function aliasSitemapIndex() {
  return {
    name: "alias-sitemap-index",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const outDir = fileURLToPath(dir);
        await copyFile(
          path.join(outDir, "sitemap-index.xml"),
          path.join(outDir, "sitemap.xml"),
        );
      },
    },
  };
}

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
  vite: {
    css: {
      postcss: {
        plugins: [postcssCustomMedia()],
      },
    },
  },
  integrations: [mdx(), sitemap(), aliasSitemapIndex()],
});

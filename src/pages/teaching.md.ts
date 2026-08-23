import type { APIContext } from "astro";
import source from "./teaching.md?raw";
import { siteConfig } from "../config";
import { markdownPageResponse } from "../lib/markdown-page";

export function GET(_: APIContext) {
  return markdownPageResponse({
    source,
    title: "Teaching",
    description: "Talks, screencasts, and interactive guides by Andrea, mostly about Elixir.",
    canonical: `${siteConfig.baseUrl}/teaching/`,
  });
}

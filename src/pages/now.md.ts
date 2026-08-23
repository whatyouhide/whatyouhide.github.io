import type { APIContext } from "astro";
import source from "./now.md?raw";
import { siteConfig } from "../config";
import { markdownPageResponse } from "../lib/markdown-page";

export function GET(_: APIContext) {
  return markdownPageResponse({
    source,
    title: "Now",
    description: "What Andrea is up to right now: work, life, and travel.",
    canonical: `${siteConfig.baseUrl}/now/`,
  });
}

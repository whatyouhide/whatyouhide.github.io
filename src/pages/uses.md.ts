import type { APIContext } from "astro";
import source from "./uses.md?raw";
import { siteConfig } from "../config";
import { markdownPageResponse } from "../lib/markdown-page";

export function GET(_: APIContext) {
  return markdownPageResponse({
    source,
    title: "Uses",
    description: "Hardware, software, and travel tools Andrea actually uses.",
    canonical: `${siteConfig.baseUrl}/uses/`,
  });
}

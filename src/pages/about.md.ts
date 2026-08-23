import type { APIContext } from "astro";
import source from "./about.md?raw";
import { siteConfig } from "../config";
import { markdownPageResponse } from "../lib/markdown-page";

export function GET(_: APIContext) {
  return markdownPageResponse({
    source,
    title: "About",
    description: "About Andrea Leopardi: software engineer, Elixir core team member, author, and speaker.",
    canonical: `${siteConfig.baseUrl}/about/`,
  });
}

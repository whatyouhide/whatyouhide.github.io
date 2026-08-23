import type { APIContext } from "astro";
import { siteConfig } from "../config";
import { markdownPageResponse } from "../lib/markdown-page";

const source = `# Books

I wrote two books about [Elixir](https://elixir-lang.org).

## [Testing Elixir](https://pragprog.com/titles/lmelixir/testing-elixir/)

This book is about testing in Elixir. I co-authored it with [Jeffrey Matthias](https://x.com/idlehands).

## [Network Programming in Elixir and Erlang](https://pragprog.com/titles/alnpee/network-programming-in-elixir-and-erlang/)

This book explains how to design and build fast, scalable network applications in Elixir and Erlang.`;

export function GET(_: APIContext) {
  return markdownPageResponse({
    source,
    title: "Books",
    description: "Books by Andrea Leopardi.",
    canonical: `${siteConfig.baseUrl}/books/`,
  });
}

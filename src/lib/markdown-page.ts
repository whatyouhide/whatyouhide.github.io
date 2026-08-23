type MarkdownPageOptions = {
  source: string;
  title: string;
  description: string;
  canonical: string;
};

function removeFrontmatter(source: string): string {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

export function markdownPageResponse({
  source,
  title,
  description,
  canonical,
}: MarkdownPageOptions): Response {
  const sourceBody = removeFrontmatter(source);
  const body = /^#\s+/m.test(sourceBody) ? sourceBody : `# ${title}\n\n${sourceBody}`;
  const lastUpdated = new Date().toISOString().slice(0, 10);
  const markdown = `---
title: ${title}
description: ${JSON.stringify(description)}
canonical: ${canonical}
last-updated: ${lastUpdated}
---

${body}
`;

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}

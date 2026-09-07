# Project guide

Andrea Leopardi's personal site: <https://andrealeopardi.com>. Built with Astro and MDX; GitHub Actions deploys `dist/` to GitHub Pages.

## Working rules

* Follow nearby code and `.markdownlint.json`. Use kebab-case for new files and directories.
* Give images alt text. Use `UnsplashCredit` for Unsplash photos.
* Use HTTPS for external links.
* Reuse existing components for embeds and callouts.

## Commands

* `npm run dev`: local preview at `http://localhost:4321`.
* `npm run build`: build to `dist/`.
* `npm test`: build, then run Node tests.
* `npm run preview`: preview the build.
* `make check-all-links`: check Markdown links with Docker; see `link_check_config.json`.

For site changes, run the build and relevant tests. For design changes, check mobile and desktop layouts in both color modes. Dev and build commands generate WebP images through their pre-scripts.

## Source map

* `src/pages/`: routes and standalone pages.
* `src/content/posts/YYYY-MM-DD-slug/index.md` or `index.mdx`: blog posts; keep post images beside the post.
* `src/content/places/`: place pages.
* `src/content.config.ts`: content schemas. Posts require `title`, `description`, and `date`; use `coverImage` for an optional cover.
* `src/components/`: shared UI and MDX components, including `Callout`, `YouTube`, and `UnsplashCredit`.
* `src/layouts/`: shared page layouts. Reuse `BaseLayout.astro`, `ExtraPageLayout.astro`, and `PostLayout.astro` as appropriate.
* `src/styles/`: CSS. Shared values and breakpoints live in `variables.css`.
* `src/config.ts`: site details. `astro.config.mjs`: build and Markdown setup.
* `src/lib/posts.ts`: post URLs and sorting. Preserve existing URLs and aliases.
* `src/data/travels.yaml`: travel data; country keys use ISO alpha-3 codes.
* `public/`: static source assets. `dist/` and `.astro/`: generated output; do not edit.
* `tests/`: Node tests. `.github/workflows/deploy-astro.yml`: deployment.

## Design

Whenever doing any design work read @.impeccable.md.

* Use shared CSS variables for colors, fonts, and spacing. Follow existing page-specific styles.
* Color mode follows `prefers-color-scheme`. Keep layout the same across modes. Dark mode has glows and background effects; light mode has none.
* Use the existing custom media queries: `--medium` at 760px, `--wide` at 1280px, `--dark`, and `--light`.

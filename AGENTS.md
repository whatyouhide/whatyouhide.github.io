## Project Overview

This is Andrea Leopardi's personal website (<https://andrealeopardi.com>), built with [Zola](https://www.getzola.org) v0.22.1, a static site generator written in Rust. The site features blog posts about Elixir, system architecture, teaching materials, and personal information.

**Key characteristics:**

* Static site generator: Zola
* Content: Markdown files with YAML frontmatter
* Styling: SCSS (compiled by Zola)
* Templates: Tera template engine (Zola's default)
* Deployment: Static HTML output to `/public` directory

## Essential Commands

Zola is installed, don't check.

### Build and Development

```bash
# Serve the site locally with live reload (default: http://127.0.0.1:1111)
zola serve

# Build the site (outputs to /public directory)
zola build

# Check the site without rendering (validates links)
zola check
```

### Link Checking

```bash
# Check all markdown links using Docker
make check-all-links
```

Note: This runs `markdown-link-check` via Docker on all `.md` files in the repository.

### Linting

The project uses markdownlint for markdown files. Configuration is in `.markdownlint.json`.

## Project Structure

```
.
├── config.toml              # Zola configuration
├── content/                 # Markdown content
│   ├── _index.md           # Homepage
│   ├── about.md            # About page
│   ├── blog.md             # Blog index
│   ├── books.md            # Books page
│   ├── teaching.md         # Teaching resources
│   ├── travels.md          # Travel page
│   ├── uses.md             # Tech stack page
│   └── posts/              # Blog posts
│       ├── _index.md       # Posts configuration
│       └── YYYY-MM-DD-slug/
│           └── index.md    # Individual posts
├── templates/              # Tera templates
│   ├── base.html           # Master template (header, body, content blocks)
│   ├── base_sidebar.html   # Sidebar layout (extends base, adds sidebar)
│   ├── index.html          # Landing page (own top bar + sidebar + posts)
│   ├── post.html           # Blog post (full-width, no sidebar)
│   ├── posts.html          # Blog listing (with sidebar)
│   ├── extra_page.html     # Generic page (with sidebar)
│   ├── books.html          # Books page (with sidebar)
│   ├── travels.html        # Travels page (with sidebar)
│   ├── section.html        # Section template (with sidebar)
│   ├── shortcodes/         # Custom shortcodes
│   │   ├── callout.html
│   │   ├── unsplash_credit.html
│   │   ├── youtube.html
│   │   └── ...
│   └── snippets/           # Reusable template snippets
│       ├── sidebar.html    # Shared sidebar (portrait, identity, roles, nav)
│       ├── header.html     # Top bar (~ site + /now link)
│       ├── footer.html     # Terminal footer (social + pid)
│       ├── meta.html
│       └── ...
├── sass/                   # SCSS stylesheets
│   ├── style.scss          # Main stylesheet
│   ├── _variables.scss     # Colors, fonts, sizes
│   ├── _mixins.scss        # Reusable SCSS mixins
│   ├── _reset.scss         # CSS reset
│   ├── _books.scss         # Books page styles
│   ├── _travels.scss       # Travels page styles
│   └── components/         # Component-specific styles
│       ├── _landing_page.scss
│       ├── _header.scss
│       └── _footer.scss
├── static/                 # Static assets (copied as-is)
│   ├── assets/
│   │   ├── fonts/
│   │   ├── geo/            # Geography/map assets
│   │   ├── icons/
│   │   ├── js/
│   │   └── media/
│   ├── favicons/
│   ├── CNAME               # GitHub Pages custom domain
│   ├── favicon.ico
│   ├── llms.txt            # LLM context file
│   └── manifest.webmanifest
├── data/                   # Data files (YAML)
│   └── travels.yaml        # Travel data for /travels page
└── .agents/                # Agent skills
    └── skills/
        └── frontend-design/ # Frontend design skill definition
```

## Content Management

### Blog Posts

**Location:** `content/posts/YYYY-MM-DD-title-slug/index.md`

**Frontmatter format:**

```yaml
---
title: Post Title
description: |
  Multi-line description
  can span multiple lines
extra:
  cover_image: cover-image.jpg  # Optional, relative to post directory
---
```

**Content features:**

* Posts use `<!-- more -->` comment to mark excerpt cutoff
* Dates in filenames: `YYYY-MM-DD-slug` format
* Images stored alongside post in same directory
* Shortcodes available (see below)

**Posts configuration:** `content/posts/_index.md` sets:

* `page_template: "post.html"`
* `generate_feeds: true`
* `insert_anchor_links: "heading"`

### Available Shortcodes

Use in markdown with `{{ shortcode_name(param="value") }}` syntax:

1. **unsplash_credit** - Photo attribution
   ```
   {{ unsplash_credit(name="Photographer Name", link="https://unsplash.com/...") }}
   ```

2. **callout** - Info/warning boxes
   ```
   {% callout(type="info", title="Title") %}
   Content here (supports markdown)
   {% end %}
   ```
   Types: `info`, `warning`

3. **youtube** - Embed YouTube videos
4. **youtube_playlist_url** - YouTube playlist links
5. **summary_tag** - Summary/details tags

### Pages

Regular pages (about, blog, etc.) are markdown files in `content/` root with frontmatter:

```yaml
---
title: Page Title
template: template_name.html  # Optional
---
```

## Design Direction: Terminal Hacker

The site was redesigned in March 2026 around a **terminal/hacker aesthetic**. The guiding metaphor is a personal computer terminal — monospace typography, green accents, command-line structural patterns — applied as a personal website rather than an actual terminal emulator.

### Design Philosophy

* **Terminal structure, human content.** The chrome (header, sidebar, footer, nav, meta elements) is fully terminal-styled. Blog post body text uses sans-serif for comfortable long-form reading.
* **One accent color.** Green (`#3FB950` dark / `#4A6B56` light) is the single accent, used for `$` prompts, `>` cursors, status dot, active links. No other accent colors.
* **Monospace as the primary voice.** IBM Plex Mono is the personality of the site. IBM Plex Sans is used only where readability demands it (blog post body text, book descriptions).
* **Persistent sidebar.** The sidebar (portrait, identity, `$`-prefixed roles, `/slash` nav) persists across all section pages (essays, books, travels, uses, teaching, now). Blog post reading pages go full-width (no sidebar) to give content room.
* **Earned decorative elements.** Every visual element serves a purpose. The green status dot links to `/now`. The `$` prompts echo the terminal metaphor. The `pid 1 · uptime 99.9%` footer is playful but restrained.

### Dual Color Scheme

The site supports two modes via `prefers-color-scheme`, both expressing the same terminal personality through different physical metaphors:

**Dark mode (default) — CRT Terminal:**
* Background: `#0D1117` (void black)
* Text: `#E6EDF3` (phosphor white)
* Green: `#3FB950` (neon terminal green)
* Borders: `#21262D` (dark steel)
* Background effects: phosphor glows, scanlines (1px lines at 3% opacity), dot grid, corner vignettes
* Status dot has a green box-shadow glow

**Light mode — E-Ink Paper:**
* Background: `#F4F1EB` (warm paper)
* Text: `#1C1917` (warm ink)
* Green: `#4A6B56` (forest ink, desaturated)
* Borders: `#D8D3CB` (pencil line)
* Background effects: all disabled (transparent) — e-ink doesn't emit light
* Status dot has no glow — just a solid ink circle
* No vignette, no scanlines, no glows

The color swap is purely CSS variables in `_variables.scss`. Zero structural/layout changes between modes.

### Font Stack

* **Mono (primary):** `IBM Plex Mono` — used for all UI chrome, headings, nav, sidebar, post titles, meta elements
* **Sans (reading):** `IBM Plex Sans` — used for blog post body text (`.entry`), book descriptions, page intro text
* **Handwritten:** `Andrea` (custom `@font-face`) — available but rarely used

### Color Variables

All colors are CSS custom properties in `:root` (dark) with `@media (prefers-color-scheme: light)` overrides. Key semantic tokens:

* `--color-text` / `--color-text-dimmer` / `--color-text-faint` / `--color-text-faintest` — four-level text hierarchy
* `--color-links` / `--color-links-hover` — green accent
* `--color-box-borders` / `--color-post-border` — structural borders (two weights)
* `--color-entry-text` — blog post body text (slightly dimmer than `--color-text` for reading comfort)
* `--color-roles-surface` / `--color-footer-surface` — semi-transparent surface fills
* `--color-status-glow` — box-shadow for the status dot (value or `none`)
* `--portrait-filter` — CSS filter for the portrait image (`none` in both modes currently)

### SCSS Mixins

Available in `sass/_mixins.scss`:

* `@include mediumScreen { ... }` — min-width: 760px (sidebar becomes vertical)
* `@include wideScreen { ... }` — min-width: 1280px
* `@include darkMode { ... }` — `prefers-color-scheme: dark`
* `@include lightMode { ... }` — `prefers-color-scheme: light`

### Layout Architecture

* **Landing page** (`index.html`): top bar + sidebar + post list. Extends `base.html` directly, overrides the header block (uses its own top bar instead).
* **Section pages** (books, travels, uses, teaching, now, essays index): extend `base_sidebar.html` which wraps content in `shell-layout` with the shared sidebar. The sidebar is in `snippets/sidebar.html`.
* **Blog posts** (`post.html`): extend `base.html` directly. Full-width, no sidebar. Just header bar + content + footer.
* **Responsive behavior**: on mobile (<760px), the sidebar stacks above content. Nav links wrap horizontally. Portrait shrinks to 72px avatar.

### Terminal Visual Patterns

These patterns recur throughout and define the aesthetic:

* `$` — role/credential prompt prefix (sidebar roles, post date sigil)
* `>` — content item cursor (post entries on landing page)
* `/slash` — nav link prefix (`/essays`, `/books`, `/now`)
* `── LABEL ──` — section dividers with rule lines
* `pid 1 · uptime 99.9%` — footer status line
* `~` — tilde home symbol in header
* Dashed borders — role boxes, used sparingly for "form field" feel
* Right-aligned dates in `YYYY-MM` format on post entries

### Background Effects (Dark Mode Only)

Applied via `::before` and `::after` pseudo-elements on `.wrapper-masthead`:

* **Phosphor glows** — two subtle radial gradients (top-right, bottom-left) at ~6% opacity
* **Scanlines** — horizontal 1px green lines repeating every 4px at 3% opacity
* **Dot grid** — 24px grid of 0.6px dots at 12% opacity
* **Corner vignettes** — radial gradients darkening the four corners

All effects use `z-index: -1` so they sit behind content. In light mode, all are set to `transparent`.

### Design Conventions

* Max content width: `800px` (`$maxContentWidth`)
* Base font size: 18px, line-height: 1.6
* Blog post entry text: 18px, line-height: 1.7
* Code blocks: `14px` mono, background `--color-site-background-accented`, border `--color-box-borders`
* Inline code: dark chip with border, 4px radius
* Blockquotes: green left border + subtle green-tinted background
* Syntax highlighting: dark theme (`ayu-dark`) in dark mode, light theme (`github-light`) in light mode

## Templates and Templating

### Template Engine

Zola uses [Tera](https://keats.github.io/tera/), similar to Jinja2/Liquid.

**Common patterns:**

```html
{# Comments #}
{{ variable }}
{{ variable | filter }}
{% if condition %}...{% endif %}
{% for item in items %}...{% endfor %}
{% block name %}...{% endblock %}
{% extends "base.html" %}
{% include "snippets/file.html" %}
```

### Key Templates

* **base.html** — Master template with `<head>`, analytics, schema.org metadata. Has `header`, `body`, and `content` blocks.
* **base_sidebar.html** — Extends base. Wraps content in `shell-layout` with the shared sidebar (`snippets/sidebar.html`). Used by all section/index pages.
* **index.html** — Landing page. Extends base directly (overrides header with its own top bar). Uses `snippets/sidebar.html` for the sidebar.
* **post.html** — Individual blog post. Extends base directly (no sidebar, full-width).
* **extra_page.html** — Generic content page. Extends base_sidebar. Used by uses, teaching, now.
* **books.html** / **travels.html** — Specific page templates. Extend base_sidebar.
* **posts.html** / **section.html** — Post listing. Extend base_sidebar.

### Key Snippets

* **snippets/sidebar.html** — The shared sidebar (portrait, identity, roles, nav). Single source of truth, used by both `index.html` and `base_sidebar.html`. Nav items auto-highlight based on `current_path`.
* **snippets/header.html** — Top bar for inner pages (`~ andrealeopardi.com` + `/now` link). Not used on landing page (which has its own top bar in `index.html`).
* **snippets/footer.html** — Terminal footer (`github email bluesky rss` + `pid 1 · uptime 99.9%`).

### Template Variables

Common Zola variables:

* `config.title`, `config.base_url`, `config.extra.*`
* `page.title`, `page.content`, `page.date`, `page.extra.*`
* `section.pages` - List of pages in a section

## Configuration

### config.toml

Key settings:

```toml
base_url = "https://andrealeopardi.com/"
compile_sass = true
build_search_index = false
title = "Andrea Leopardi"
generate_feeds = true
feed_filenames = ["feed.xml"]
feed_limit = 20

[extra]
# Custom variables accessible via config.extra.*
full_name = "Andrea Leopardi"
username = "whatyouhide"
email = "hi@andrealeopardi.com"
twitter_username = "whatyouhide"
github_username = "whatyouhide"
analytics_umami_website_id = "2516c3bf-d125-4dcb-b2b9-2c086e715e81"
```

### Taxonomies

Tags are enabled:

```toml
taxonomies = [{ name = "tags", feed = true }]
```

Posts can include `tags = ["tag1", "tag2"]` in frontmatter.

## Special Features

### Analytics

Umami analytics integrated in `base.html`:

```html
<script defer
    src="https://analytics.andrealeopardi.com/script.js"
    data-website-id="{{ config.extra.analytics_umami_website_id }}">
</script>
```

### Syntax Highlighting

Configured in `config.toml`:

```toml
[markdown.highlighting]
style = "inline"
light_theme = "github-light"
dark_theme = "ayu-dark"
```

Themes auto-generated to `/static/syntax-theme-*.css` (gitignored).

### Schema.org Metadata

Structured data in `base.html` for person/author information. Blog posts have additional JSON-LD via `snippets/json_ld_blog_post.html`.

### Comments

Giscus (GitHub Discussions) enabled for blog posts via `snippets/giscus.html`.

### Seasonal Snowflakes

JavaScript in `base.html` creates decorative snowflakes animation (lines 64-110).

## Data Files

### travels.yaml

Structured data for the `/travels` page:

```yaml
countries:
  ITA:
    name: "Italy"
    visited: true
    home: true
  USA:
    name: "United States"
    visited: true
```

ISO 3166-1 alpha-3 country codes used as keys.

## Markdown Linting

Configuration in `.markdownlint.json`:

**Enforced rules:**

* MD001: Header levels increment by one
* MD003: Consistent header style
* MD004: Unordered lists use asterisks
* MD009: No trailing spaces
* MD010: No hard tabs
* MD018: No space after hash in headers
* MD033: Limited HTML tags allowed (img, details, summary, div, svg, etc.)
* MD046: Fenced code blocks (not indented)
* MD048: Backtick code fences

**Disabled rules:**

* MD007: Unordered list indentation (disabled)
* MD012: Multiple blank lines (disabled)
* MD013: Line length (disabled)
* MD022: Blank lines around headers (disabled)
* MD024: Multiple headers with same content (disabled)

## Link Checking

Configuration in `link_check_config.json`:

**Ignored patterns:**

* Twitter/Reddit links (often rate-limited)
* OpenAI
* Medium

These sites frequently block automated checkers.

## Git Workflow

### Ignored Files

`.gitignore` includes:

```
/public                        # Build output
/static/syntax-theme-dark.css  # Generated
/static/syntax-theme-light.css # Generated
```

### Current State

* Branch: `main`
* Recent work: Terminal hacker redesign (March 2026) — new visual direction, persistent sidebar, dual color scheme (dark CRT + light e-ink paper), /now page

## Working with This Codebase

### Making Changes to Content

1. Edit markdown files in `content/` or `content/posts/`
2. Run `zola serve` to preview changes locally
3. Check that links work with `zola check`
4. Build with `zola build` to generate `/public`

### Making Design Changes

1. Edit SCSS files in `sass/`
2. Zola automatically compiles to `/style.css`
3. Use CSS variables from `_variables.scss` for consistency
4. Follow existing patterns for dark mode support
5. Test responsiveness with `mediumScreen` and `wideScreen` mixins

### Adding New Templates

1. Create `.html` file in `templates/`
2. Use Tera syntax
3. Extend `base.html` for consistent layout
4. Include snippets from `templates/snippets/` for reusable components

### Adding New Shortcodes

1. Create `.html` file in `templates/shortcodes/`
2. Access parameters via `{{ param_name }}`
3. Use `{{ body }}` for content between `{% shortcode %}...{% end %}`
4. Use `| markdown | safe` filter to render markdown in shortcode body

## Important Conventions

### URLs and Links

* Base URL: `https://andrealeopardi.com/`
* No trailing slashes in feed URLs: `get_url(path="feed.xml", trailing_slash=false)`
* Internal links: Use Zola's `get_url(path="...")` or relative paths
* External links: Always use HTTPS

### Image Handling

* Post images: Store alongside post in `content/posts/YYYY-MM-DD-slug/`
* Static images: Place in `static/assets/`
* Favicons: `static/favicons/`
* Always provide alt text
* Use `unsplash_credit` shortcode for Unsplash photos

### Code Style

* **Templates:** 4-space indentation
* **SCSS:** 2-space indentation
* **Markdown:** Follow `.markdownlint.json` rules
* **Naming:** kebab-case for files and directories

## Gotchas and Important Notes

1. **Build output directory:** `/public` is gitignored. This is the deployment target.

2. **Syntax highlighting themes:** Auto-generated CSS files are gitignored. Don't edit them directly.

3. **Zola serve vs build:** `serve` uses different base URL (localhost). Use `build` to test production URLs.

4. **SCSS compilation:** Automatic via Zola. No separate build step needed.

5. **Template changes:** Require server restart with `zola serve` (unlike content changes which auto-reload).

6. **Post dates:** Must be in filename AND can be in frontmatter. Filename format: `YYYY-MM-DD-slug`.

7. **Excerpt marker:** Use `<!-- more -->` in post content, not frontmatter.

8. **Color scheme:** Dark (CRT) is the `:root` default. Light (e-ink paper) applied via `prefers-color-scheme: light`. No manual toggle — follows OS preference.

9. **Custom fonts:** "Andrea" font loaded via `@font-face` from `static/assets/fonts/`.

10. **Analytics:** Umami self-hosted at `analytics.andrealeopardi.com`. Website ID in config.

11. **Section configuration:** `_index.md` files configure how Zola processes a directory of pages.

12. **Shortcode syntax:** Two types:
    * Inline: `{{ shortcode(param="value") }}`
    * Block: `{% shortcode(param="value") %}content{% end %}`

## Frontend Design Skill

A `frontend-design` skill is available in `.agents/skills/`. This skill provides guidance for creating distinctive, production-grade frontend interfaces. Key principles:

* Avoid generic AI aesthetics (Inter, Roboto, purple gradients)
* Choose bold, intentional design directions
* Use distinctive typography (avoid system fonts)
* Implement cohesive color schemes with CSS variables
* Add motion and micro-interactions thoughtfully
* Match implementation complexity to aesthetic vision

See `.agents/skills/frontend-design/SKILL.md` for full details.

## Additional Resources

* **Zola documentation:** <https://www.getzola.org/documentation/>
* **Tera template syntax:** <https://keats.github.io/tera/docs/>
* **Site content context:** See `static/llms.txt` for LLM-friendly site overview
* **Live site:** <https://andrealeopardi.com>

## Quick Reference

| Task | Command |
|------|---------|
| Start dev server | `zola serve` |
| Build site | `zola build` |
| Check links | `zola check` |
| Check markdown links | `make check-all-links` |
| View output | Open `/public/index.html` |

---

**Last updated:** 2026-03-16

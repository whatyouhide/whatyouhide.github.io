## Project Overview

This is Andrea Leopardi's personal website (<https://andrealeopardi.com>), built with [Zola](https://www.getzola.org) v0.22.1, a static site generator written in Rust. The site features blog posts about Elixir, system architecture, teaching materials, and personal information.

**Key characteristics:**

* Static site generator: Zola
* Content: Markdown files with YAML frontmatter
* Styling: SCSS (compiled by Zola)
* Templates: Tera template engine (Zola's default)
* Deployment: Static HTML output to `/public` directory

## Essential Commands

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
│   ├── base.html           # Base template with header, meta tags
│   ├── index.html          # Homepage template
│   ├── post.html           # Blog post template
│   ├── posts.html          # Blog listing template
│   ├── shortcodes/         # Custom shortcodes
│   │   ├── callout.html
│   │   ├── unsplash_credit.html
│   │   ├── youtube.html
│   │   └── ...
│   └── snippets/           # Reusable template snippets
│       ├── header.html
│       ├── footer.html
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

## Styling and Design

### Font Stack

* **Serif:** "Spectral" (Google Fonts) - primary body text
* **Sans-serif:** "Lato" (Google Fonts) - headings and UI
* **Handwritten:** "Andrea" (custom font) - special elements
* **Sans fallback:** Helvetica Neue, Helvetica, Arial

### Color System

CSS variables defined in `sass/_variables.scss`:

**Light mode:**

* Background: `#faf7f2` (warm off-white)
* Text: `#2d2d2d` (dark gray)
* Links: `#8b4513` (brown)
* Link hover: `#a0522d`

**Dark mode:** Automatically applied via `@media (prefers-color-scheme: dark)`

* Background: `#2a2e31` (dark blue-gray)
* Text: `#fff`
* Links: `#ce7332` (orange)

### SCSS Mixins

Available in `sass/_mixins.scss`:

* `@include mediumScreen { ... }` - Min-width: 760px
* `@include wideScreen { ... }` - Min-width: 1280px
* `@include darkMode { ... }` - Dark color scheme
* `@include scaleUpOnHover { ... }` - Scale animation on hover

### Design Conventions

* Max content width: `800px` (defined in `_variables.scss`)
* Typography scale: h1 = 200%, h2 = 24px, h3 = 20px, h4 = 18px
* Base font size: 18px
* Line height: 1.5
* Responsive: Mobile-first with `mediumScreen` and `wideScreen` breakpoints

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

* **base.html** - Master template with `<head>`, analytics, schema.org metadata
* **post.html** - Extends base, adds article structure, Giscus comments
* **index.html** - Homepage layout
* **posts.html** - Blog post listing

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
* Clean working directory
* Recent work: Agent skills, Umami analytics, /travels page

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

8. **Dark mode:** Automatically applied based on system preference. No manual toggle.

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

**Last updated:** 2026-02-15

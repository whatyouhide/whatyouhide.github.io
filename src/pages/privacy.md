---
layout: ../layouts/ExtraPageLayout.astro
title: Privacy
description: What this site collects, what it doesn't, and where your data goes.
---

# Privacy

Short version: this site does not set cookies, does not track you across the web, and does not share data with advertisers or analytics resellers. If you disable JavaScript, nothing about you is recorded at all.

## Analytics

I run a self-hosted instance of [Umami]. Umami is a privacy-focused analytics tool. For each pageview it records:

  * the page URL and referrer,
  * the browser, OS, and device type (derived from the `User-Agent`),
  * the country (derived from the IP address, which is then discarded—only
    a salted hash is stored, and the salt rotates daily so the hash can't be
    used to follow a visitor across days),
  * the screen size and language.

It does **not** set cookies, does **not** use `localStorage`, and does **not** assign any identifier that would let me recognize you on a return visit.

The data lives on a server I rent and is never shared with anyone. I look at it occasionally, mostly to see which posts people are reading.

[Umami]: https://umami.is/

## Fonts and assets

All fonts are bundled with the site and served from the same domain you're
reading this page on. Nothing is fetched from Google Fonts, jsDelivr, or any
other third-party CDN as part of normal page loads.

Some posts still load assets from third-party CDNs:

  * Posts containing math (rendered with [KaTeX]) load a stylesheet and font
    files from `cdn.jsdelivr.net`.
  * The [`/travels`](/travels/) page loads `d3` and `topojson` from
    `d3js.org` and `unpkg.com` to render the map.

In each of those cases the third party sees your IP address as a side effect of serving the file. None of them set tracking cookies in this context.

[KaTeX]: https://katex.org/

## Embeds

Some posts embed YouTube videos. They use the `youtube-nocookie.com` domain, which means YouTube does not set tracking cookies until you actually press play. If you press play, normal YouTube terms apply.

## Contact

If you have questions about any of this, or want me to delete something, email me.

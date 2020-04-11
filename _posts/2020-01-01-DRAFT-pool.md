---
layout: post
title: Pooling processes with Elixir's Registry
description: TODO
cover_image: cover-image.jpg
tags:
  - elixir
  - registry
  - pooling
---

When you have a limited number of resources that you have to share for your all application, like database connections or worker processes, what you need is a *pool*. In this post, we're going to take a look at one possible pooling strategy that highly leverages Elixir's built-in [Registry][registry-docs] resulting in fast, reliable, and cleanly designed pools.

{% include post_img.html alt="Cover image of a pool" name="cover-image.jpg" %}

{% include unsplash_credit.html name="Etienne Girardet" link="https://unsplash.com/@etiennegirardet?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" %}

In Elixir there are two main pooling strategies: **checkout pools** and **routing pools**. I made up those names.

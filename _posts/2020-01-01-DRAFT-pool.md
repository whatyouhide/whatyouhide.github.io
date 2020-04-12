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

There are two most common pool kinds in Elixir: **checkout pools** and **routing pools**. I made up those names.

A checkout pool is a pool where resources are used *exclusively* by callers. What this means is that when a caller needs a resource from the pool, it will check the resource out of the pool and will be able to use it. While the resource is checked out, then the caller is the only process that is able to use the resource at that time. When the caller is finished with the resource, it can check it back in the pool for other processes to use. Checkout pools are great for resources that can't be shared, like a TCP socket in passive mode, where only one process can call `:gen_tcp.recv/3` to receive data in a blocking way. They're also great for cases where sharing a resource doesn't really bring an advantage: for example, worker pools where a worker (the resource) can only do one thing at a time. However, checkout pools limit performance and utilization of resources that *can* be shared.

A routing pool is a pool where resources can be shared by callers. In a routing pool, the pool only acts as a *router* to route the caller to the right resource, based on a variety of possible strategies (such as least used resource or round-robin). Resources are not checked out from the pool, so multiple callers can use the resource at the same time. This leads to some advantages if the resource is shareable. Example of shareable resources are ETS tables or TCP connections where you want to take advantage of multiplexing (to have multiple in-flight requests and responses).

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

A checkout pool is a pool where resources are used *exclusively* by callers. What this means is that when a caller needs a resource from the pool, it will check the resource out of the pool and will be able to use it. While the resource is checked out, then the caller is the only process that is able to use the resource at that time. When the caller is finished with the resource, it can check it back in the pool for other processes to use. Checkout pools are great for resources that can't be shared, like a TCP socket in passive mode, where only one process can call `:gen_tcp.recv/3` to receive data in a blocking way. They're also great for cases where sharing a resource doesn't really bring an advantage: for example, worker pools where a worker (the resource) can only do one thing at a time. However, checkout pools limit performance and utilization of resources that *can* be shared. An example that I really like for a good use case around checkout pools is HTTP/1 connections. Imagine you use a client like [Mint][mint], which essentially behaves like a `:gen_tcp` or `:ssl` socket. HTTP/1 supports pipelining of requests (where you send multiple requests and await for multiple responses) but in practice it's rarely used. What clients usually do is send a request and await for the response before sending the next request. This is a natural case of "doing one thing at a time", as requests can't be parallelized. In this case a checkout pool works great because it allows to *move* the HTTP/1 connection (and socket) over to the process that makes the request, minimizing the message passing and copying of request and response data between the caller and the HTTP client.

A routing pool is a pool where resources can be shared by callers. In a routing pool, the pool only acts as a *router* to route the caller to the right resource, based on a variety of possible strategies (such as least used resource or round-robin). Resources are not checked out from the pool, so multiple callers can use the resource at the same time. This leads to some advantages if the resource is shareable. Some examples of shareable resources are ETS tables or TCP connections where you want to take advantage of multiplexing (to have multiple in-flight requests and responses). In contrast with the HTTP/1 example that we talked about for checkout pools, a great use case for routing pools is HTTP/2 connections. HTTP/2 supports *streams*, which are essentially requests, with the main difference that you can have multiple streams in flight on the same connection. If you use a checkout pool for an HTTP/2 connection, then you won't be able to have multiple requests in flight from different callers and will not take advantage of this fundamental feature of the HTTP/2 design. With a routing pool, instead, you can have a pool of HTTP/2 connections and when you need to make a request the caller can *route* to one connection which will send the request. However, multiple callers can be routed to the same connection before requests receive a response, since multiple requests can be in flight on the same connection.

Checkout pools tend to be more common in the Erlang and Elixir ecosystem. We have established libraries like [poolboy][poolboy] or [DBConnection][dbconnection] that implement checkout pools. However, routing pools tend to be hand rolled. In this post, we're going to take a look at how we can leverage [Registry][registry-docs] to build routing pools that can route using different strategies. Brace yourself!

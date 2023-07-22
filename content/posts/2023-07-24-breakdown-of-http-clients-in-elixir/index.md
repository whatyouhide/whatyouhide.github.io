---
title: A Breakdown of HTTP Clients in Elixir
description: |
  This is an overview of the HTTP clients we have available in Elixir, as long as when to use each one.
extra:
  cover_image: cover-image.png
---

TODO

<!-- more -->

![Cover image of a futuristic-looking box ring with a metallic snake inside of it](cover-image.png)

<span class="image-caption">This is AI generated, just to be clear</span>

## All Your Clients Are Belong to Us

So, let's take a whirlwind tour of some HTTP clients available in Elixir. We'll talk about these:

  * [Mint][mint]
  * [httpc]
  * [Finch][finch]
  * [Tesla][tesla]
  * [Req][req]

This is not a comprehensive list of all the Elixir HTTP clients, but rather a
list of clients that I think make sense in different situation. At the end of
this post, you'll also find a mention of other well-known clients.

### Mint

Let's start with Mint. Mint is arguably the lowest-level HTTP client we've got
in Elixir. It's essentially a *wrapper* around a raw TCP or SSL socket. Its job
is to make the socket **aware of the network protocol**.

Think about a `:gen_tcp` or a `:ssl` socket. Their job is to allow you to
connect servers and clients on the TCP and TLS network protocols, respectively.
When you're using one of these directly, you usually have to do most of the
encoding of decoding of the data that you're sending or receiving, because the
sockets carry just binary data.

Mint introduces an abstraction layer *around* raw sockets, rather than *on top*
of them. Here's a visual representation:

![Drawing of Mint surrounding a "raw" socket](TODO)

When you use Mint, you have an API that is similar to the one provided by the
`:gen_tcp` and `:ssl` modules, and you're using a socket underneath. Mint
provides a *data structure* that it calls a **connection**, which wraps the
underlying socket. A Mint connection is aware of the HTTP protocol, so you don't
send and receive raw binary data here, but rather data that makes sense in the
semantics of HTTP.

For example, let's see how you'd make a request using Mint. First, you'd want to
open a connection. Mint itself is **stateless**, and it stores all the
connection information inside the connection data structure itself.

```elixir
{:ok, conn} = Mint.HTTP.connect(:http, "httpbin.org", 80)
```

Then, you'd use `Mint.HTTP.request/5` to send a request.

```elixir
{:ok, conn, request_ref} = Mint.HTTP.request(conn, "GET", "/", [], "")
```

Sending a request is analogous to sending raw binary data on a `:gen_tcp` or
`:ssl` socket: it's *not blocking*. The call to `request/5` returns right away,
giving you a **request reference** back. The underlying socket will eventually
receive a response as an Erlang message. At that point, you can use
`Mint.HTTP.stream/2` to turn that message into something that makes sense in
HTTP.

```elixir
receive do
  message ->
    {:ok, conn, responses} = Mint.HTTP.stream(conn, message)
    IO.inspect(responses)
end
#=> [
#=>   {:status, #Reference<...>, 200},
#=>   {:headers, #Reference<...>, [{"connection", "keep-alive"}, ...},
#=>   {:data, #Reference<...>, "<!DOCTYPE html>..."},
#=>   {:done, #Reference<...>}
#=> ]
```

Mint supports HTTP/1.1 and HTTP/2 out of the box, as well as WebSocket through [mint_web_socket].

#### When to Use Mint

Generally, ***don't use Mint***. Seriously. You know I mean this advice, because
I'm one of the [two][gh-whatyouhide] [people][gh-ericmj] who maintain and
originally created Mint itself! However, for most use cases, Mint is too low
level. When you use it, you'll have to care about things such as pooling
connections, process architecture, keeping the connection structs around, and so
on. It's a bit like what you'd do in other cases, after all. For example, you're
unlikely to use `:gen_tcp` to communicate directly with your PostgreSQL
database. Instead, you'd probably reach *at least* for something like
[Postgrex][postgrex] to abstract a lot of the complexity away.

Still, there are some use cases where Mint can make a lot of sense. First and
foremost, you can use it to build higher-level abstractions. That's exactly what
a library called Finch does, which we'll talk about in a bit. Mint can also be
useful in cases where you need fine-grained control over the performance and
process architecture of your application. For example, say you have a fine-tuned
[GenStage][gen_stage] pipeline where you need to make some HTTP calls at some
point. GenStage stages are already processes, so having an HTTP client based on
a process might introduce an unnecessary layer of processes in your application.
Mint being processless solves exactly that.

![Drawing of a GenStage pipeline with a traditional process-based HTTP client on
the left, and the same pipeline but with Mint as the HTTP client on the
right](TODO)

A few years ago, I worked at a company where we would've likely used Mint in
exactly this way. At the time, I wrote [a blog
post][forza-football-gen_stage-post] that goes into more detail in case you're
interested.

#### Bonus: Why Isn't Mint in the Elixir Standard Library?

That's a great question! When we introduced Mint back in 2019, we [posted about
it][mint-blog-post] on Elixir's website. Our original intention was to ship Mint
with Elixir's standard library. This is also one of the reasons why we wrote
Mint in Elixir, instead of Erlang. However, we then realized that it worked well
as a standalone library, and including it into the standard library would
increase the cost of maintaining the language as well as potentially slow down
the development of Mint itself.

That said, I think of Mint as the "standard-library HTTP client", that is, the
low-level client that you'd expect in the standard library of a language like
Elixir.

### httpc

### Finch

### Req

### Tesla

## For Library Authors

## For Application Developers

## What About the Others?

[finch]: https://github.com/sneako/finch
[gen_stage]: https://github.com/elixir-lang/gen_stage
[httpc]: https://www.erlang.org/doc/man/httpc.html
[mint]: https://github.com/elixir-mint/mint
[mint_web_socket]: https://github.com/elixir-mint/mint_web_socket
[postgrex]: https://github.com/elixir-ecto/postgrex
[req]: https://github.com/wojtekmach/req
[tesla]: https://github.com/elixir-tesla/tesla
[gh-whatyouhide]: https://github.com/whatyouhide
[gh-ericmj]: https://github.com/ericmj
[forza-football-gen_stage-post]: https://tech.forzafootball.com/blog/maximizing-http2-performance-with-genstage
[mint-blog-post]: https://elixir-lang.org/blog/2019/02/25/mint-a-new-http-library-for-elixir/

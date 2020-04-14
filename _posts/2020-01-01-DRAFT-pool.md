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

There are two most common pool kinds in Elixir: **checkout pools** and **routing pools**. I made up those names, but let's see what I mean.

## Checkout pools and routing pools

A **checkout pool** is a pool where resources are used *exclusively* by callers. What this means is that when a caller needs a resource from the pool, it will check the resource out of the pool and will be able to use it. While the resource is checked out, then the caller is the only process that is able to use the resource at that time. When the caller is finished with the resource, it can check it back in the pool for other processes to use.

{% include post_img.html alt="Sketch of a checkout pool" name="sketch-checkout-pool.png" %}

Checkout pools are great for resources that can't be shared, like a TCP socket in passive mode, where only one process can call `:gen_tcp.recv/3` to receive data in a blocking way. They're also great for cases where sharing a resource doesn't really bring an advantage: for example, worker pools where a worker (the resource) can only do one thing at a time. However, checkout pools limit performance and utilization of resources that *can* be shared. An example that I really like for a good use case around checkout pools is HTTP/1 connections. Imagine you use a client like [Mint][mint], which behaves like a wrapper around a `:gen_tcp` or `:ssl` socket. HTTP/1 supports pipelining of requests (where you send multiple requests and await for multiple responses) but in practice it's rarely used. What clients usually do is send a request and await for the response before sending the next request. This is a natural case of "doing one thing at a time", as requests can't be parallelized. In this case a checkout pool works great because it allows to *move* the HTTP/1 connection (and socket) over to the process that makes the request, minimizing the message passing and copying of request and response data between the caller and the HTTP client.

A **routing pool** is a pool where resources can be shared by callers. In a routing pool, the pool only acts as a *router* to route the caller to the right resource, based on a variety of possible strategies (such as least used resource or round-robin). Resources are not checked out from the pool, so multiple callers can use the resource at the same time.

{% include post_img.html alt="Sketch of a routing pool" name="sketch-routing-pool.png" %}

This pooling strategy leads to some advantages if the resource is shareable. Some examples of shareable resources are ETS tables or TCP connections where you want to use of multiplexing (to have multiple in-flight requests and responses). In contrast with the HTTP/1 example above, a great use case for routing pools is HTTP/2 connections. HTTP/2 supports *streams*, which are essentially requests. The difference with HTTP/1 requests is that you can have multiple streams in flight on the same connection. If you use a checkout pool for an HTTP/2 connection, then you won't be able to have multiple requests (streams) in flight from different callers and will not take advantage of this fundamental feature of the HTTP/2 design. With a routing pool, instead, you can have a pool of HTTP/2 connections and when you need to make a request the caller can be *routed* to one connection which will send the request. Multiple callers can be routed to the *same* connection before requests receive a response, since multiple requests can be in flight on the same connection.

Checkout pools tend to be more common in the Erlang and Elixir ecosystem. We have established libraries like [poolboy][poolboy] or [DBConnection][dbconnection] that implement checkout pools. However, routing pools tend to be hand rolled. In this post, we're going to take a look at how we can leverage [Registry][registry-docs] to build routing pools that can route using different strategies. Brace yourself!

## What we need before we go

Let's take a quick look at an example I came up with for a resource that we'll build a pool for, as well as at a small intro to what Registry is and how it works.

### Coming up with a resource to pool

The example we'll use to describe routing pools is a pool of GenServers that hold a TCP socket. These GenServers (let's call them `FantaTCP`) are able to send messages over TCP according to an imaginary serialization protocol (let's call it `Fantaprotocol`) and receive responses serialized through the same protocol. Requests have an ID so that responses for those requests can come in any order. This means that we can take advantage of a single TCP socket from multiple callers, but we can respond to callers as soon as we receive responses from the socket. Using one of these GenServers looks like this:

```elixir
FantaTCP.request(genserver_pid, "PING")
#=> {:ok, "PONG"}
```

The implementation for `FantaTCP` GenServers looks like this:

```elixir
defmodule FantaTCP do
  use GenServer

  def start_link(hostname, port) do
    GenServer.start_link(__MODULE__, {hostname, port})
  end

  def request(pid, request) do
    GenServer.call(pid, {:request, request})
  end

  @impl true
  def init({hostname, port}) do
    case :gen_tcp.connect(hostname, port, []) do
      {:ok, socket} ->
        # "requests" is a map of request IDs to "from"s
        # (callers from handle_call/3). See handle_call/3.
        {socket, _requests = %{}}

      {:error, reason} ->
        {:stop, reason}
    end
  end

  def handle_call({:request, request}, from, {socket, requests}) do
    # We build the request ID.
    id = make_id()

    :ok = :gen_tcp.send(socket, Fantaprotocol.encode({id, request}))

    # We store the "from" under the request ID so we'll know
    # who to reply to. We don't reply right away so that we can
    # send other requests while the response for this request comes back.
    {:noreply, {socket, Map.put(requests, id, from)}}
  end

  # Let's pretend that "data" is always a complete response and can't
  # have less or more data than that.
  def handle_info({:tcp, socket, data}, {socket, requests}) do
    {id, response} = Fantaprotocol.decode(data)
    {from, requests} = Map.pop!(requests, id)
    GenServer.reply(from, {:ok, response})
    {:noreply, {socket, requests}}
  end
end
```

It's a bit of code, but the idea is that:

  * when we get a request, we encode it and send it through TCP, and then return without sending a response to the caller
  * while waiting for a response, the caller is blocked on the `GenServer.call/2`
  * when we get a response, we match it to the right caller and reply to that caller through `GenServer.reply/2`

With this in mind, we're ready to build our first pool of `FantaTCP`s.

### Registry 101

If you're not familiar with Registry, I'll give you a quick rundown. Registry is a key-value store tailored to registering PIDs under given keys. It's the same principle as when you call `Process.register(pid, :some_name)` to register a process under a name. To use it like `Process.register/2`, you can start it as a *unique* registry:

```elixir
pid = self()

Registry.start_link(name: FantaRegistry, keys: :unique)
Registry.register(FantaRegistry, :some_name, _value = nil)
Registry.lookup(FantaRegistry, :some_name)
#=> [{pid, nil}]
```

As you might have already noticed, you can even store an arbitrary value alongside a PID under a certain key. We'll make pretty cool uses of this later!

Another cool feature of Registry is that you can create a *duplicate* registry, that is, a registry that can store multiple PID-value pairs *under the same key*.

```elixir
Registry.start_link(name: FantaRegistry, keys: :duplicate)

# From a process with PID pid1 we call this:
Registry.register(FantaRegistry, :cool_processes, "cool process 1")

# From a process with PID pid2 we call this:
Registry.register(FantaRegistry, :cool_processes, "cool process 2")

# From whatever process:
Registry.lookup(FantaRegistry, :cool_processes)
#=> [{pid1, "cool process 1"}, {pid2, "cool process 2"}]
```

That's some cool stuff right there.

Since registries are smart bees, they monitor processes that are registered in them, so that if a process dies, then it will be removed from that registry.

Alright, we're ready to get pooling.

## Building a naive Registry-based routing pool

For our first naive pool, we're going to use Registry like we would use the built-in process registry (the one used by `Process.register/2`). We'll start a registry and pass it to the GenServers in the pool. Each GenServer will register itself in the registry. Let's start by looking at the changes needed in the `FantaTCP` GenServers.

```elixir
defmodule FantaTCP do
  use GenServer

  def start_link(hostname, port, registry) do
    GenServer.start_link(__MODULE__, {hostname, port, registry})
  end

  @impl true
  def init({hostname, port, registry}) do
    case :gen_tcp.connect(hostname, port, []) do
      {:ok, socket} ->
        Registry.register(registry, :connections, _value = nil)
        {socket, _requests = %{}}

      {:error, reason} ->
        {:stop, reason}
    end
  end
end
```

When a `FantaTCP` GenServer starts up, it will register itself in the given registry under the `:connections` key. All the GenServers will register under that same key, so retrieving all the GenServers in the pool will be a matter of looking up that key in the registry.

```elixir
defmodule FantaPool do
  def start_link(hostname, port) do
    {:ok, _} = Registry.start_link(name: FantaRegistry, keys: :duplicate)

    for _ <- 1..10 do
      {:ok, _} = FantaTCP.start_link(hostname, port, FantaRegistry)
    end
  end

  def request(request) do
    # "connections" is a list of {pid, nil} tuples.
    connections = Registry.lookup(FantaRegistry, :connections)
    {pid, _value = nil} = Enum.random(connections)

    # Now we got "routed" to a connection to which we can send the request.
    FantaTCP.request(pid, request)
  end
end
```

Here we're using `Enum.random/1` to pick a connection from the ones registered in the registry, which means we'll do random routing. It tends to work well for many use cases since the load distribution is uniform over a decent number of requests, but we could potentially make things more complicated and use smarted strategies like round robin.

### Supervising the pool and its connections

The `FantaPool` is a proper OTP disaster: no supervisors in sight. In this case, a single supervisor with the registry plus all the connections under it won't work. The reason is this: which supervision strategy would we pick? We want all connections to go down if the registry goes down since they become unreachable, so `:one_for_one` is a no-go. We don't want other connections to go down if a single connection goes down (so no `:rest_for_one`), but we also don't want *everything* to go down if anything goes down (so no `:one_for_all`). So, we have to go with more supervision layers: we'll have a `:rest_for_one` supervisor supervising the registry and a *connections supervisor*. The connections supervisor will be a `:one_for_one` supervisor that will supervise all the connections. Now go back on this paragraph and count all the variations of the word "supervisor": we're truly living the OTP life, aren't we?

{% include post_img.html alt="Sketch of the pool supervision tree" name="pool-supervision-tree.png" %}

CONTINUE: write the code for the supervision tree above

## Improving our routing pool by accounting for disconnections

## Routing based on different strategies

### Round robin

### Least used resource


[registry-docs]: https://hexdocs.pm/elixir/Registry.html
[mint]: https://github.com/elixir-mint/mint
[poolboy]: https://github.com/devinus/poolboy
[dbconnection]: https://github.com/elixir-ecto/db_connection

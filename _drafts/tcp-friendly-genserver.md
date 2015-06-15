---
layout: post
title: TCP-friendly GenServer in Elixir
---

## Brief overview of TCP connections in Erlang/Elixir

In Erlang and Elixir, TCP connections are handled using the [`:gen_tcp`][docs-gen_tcp] Erlang module. In this article we'll only set up clients that connect to an external TCP server, but the `:gen_tcp` module is used to set up TCP servers as well.

A TCP connection with a server is an Erlang port. All messages to the server are sent using `:gen_tcp.send/2`. Messages sent from the server to the client are usually delivered to the client process as Erlang messages, so it's straightforward to work with them. As we will see later, we can control how messages are delivered to the client process with the value of the `:active` option on the TCP socket.

To establish a connection with a TCP server we use `:gen_tcp.connect/3` passing the host (as a charlist, damn Erlang!), the port and a list of options. By default, the process that calls `connect/3` is the "controlling process" of the TCP connection, which just means that TCP messages from the socket will be delivered to it.

That's all we need to know about TCP connections for now, let's move on.

## First implementation

As a first (naïve and slow) implementation, we'll use a `GenServer` as the only interface with the TCP connection. We'll use a GenServer so that we will be able to keep the TCP socket in the GenServer's state and don't worry about it after the connection is established.

### Establishing the connection

Since the GenServer will be the only interface to the TCP server and it will only hold a single TCP socket in its state, we want it to always be connected to the TCP server. The best strategy for this is establishing the connection when the GenServer is started, in the `init/1` callback. `init/1` is called on the GenServer process when `GenServer.start_link/2` is used to start the process, so there's no better place than that.

```elixir
defmodule Redis do
  use GenServer

  @initial_state %{socket: nil}

  def start_link do
    GenServer.start_link(@initial_state)
  end

  def init(state) do
    {:ok, socket} = :gen_tcp.connect('localhost', 6379, [:binary, active: false])
    {:ok, Map.put(state, :socket, socket)}
  end
end
```

The options we pass to `:gen_tcp.connect/3` are straightforward. `:binary` instructs the socket to deliver messages from the TCP server to the GenServer as binaries instead of Erlang strings (charlists): in Elixir this is probably what we want, and it's probably the most efficient choice as well. `active: false` tells the socket to never deliver TCP messages as Erlang messages to the GenServer process; we have to manually retrieve those messages using [`:gen_tcp.recv/2`][docs-gen_tcp-recv/2]. We do this so that the GenServer isn't flooded with messages coming from the TCP server: we only retrieve those messages when we're ready to process them.

### Sending messages

So, we have a GenServer which is connected to a Redis server. Let's send commands to the Redis server now.

#### RESP protocol

At this point, I should mention the Redis binary protocol, RESP: this is the protocol that Redis uses to encode and decode commands and responses. The [specification for this protocol][resp-specification] is very short and simple to understand, so I encourage you to go read it if you want to know more. For the purpose of this article, we'll assume we have a full RESP encoder/decoder (`Redis.RESP`) which provides two functions:

* `Redis.RESP.encode/1`: encodes a list into a Redis command, like this:

```elixir
Redis.RESP.encode(["SET", "mykey", 1]) # <<...>>
```

* `Redis.RESP.decode/1`: decodes a binary into an Elixir term, like this:

```elixir
resp_to_set_command = <<...>>
Redis.RESP.decode(resp_to_set_command) #=> 1
```

#### `:gen_tcp.send/2`

As we mentioned at the beginning of the article, we use `:gen_tcp.send/2` to send messages through a TCP socket. Our `Redis` module will provide a single function to send commands to the Redis server: `Redis.command(gen_server_pid, command)`.

The implementation is straightforward:

```elixir
defmodule Redis do
  # ...

  def command(pid, command) do
    GenServer.call(pid, {:command, command})
  end

  def handle_call({:command, command}, from, %{socket: socket} = state) do
    :gen_tcp.send(socket, Redis.RESP.encode(command))

    # `0` means receive all available bytes.
    {:ok, message} = :gen_tcp.recv(socket, 0)
    {:ok, Redis.RESP.decode(message), state}
  end
end
```

This works just fine:

```elixir
{:ok, pid} = Redis.start_link
Redis.command(pid, ["SET", "mykey", 1])
Redis.command(pid, ["GET", "mykey"]) #=> 1
```

## What went wrong

Long story short: `:gen_tcp.recv/2` is blocking!

The code we wrote would work just fine if the GenServer is used by just one Elixir process. This is what happens when an Elixir process wants to send a command to the Redis server:

1. the Elixir process calls `command/2` on the GenServer and *blocks*, waiting for the response
2. the GenServer sends the command to the Redis server and *blocks* on `:gen_tcp.recv/2`
3. the Redis server responds to the GenServer
4. the GenServer responds to the Elixir process

Can you spot the (gigantic) problem? The GenServer is blocked when it waits for the Redis server to respond. While this is fine when a single Elixir process talks to the GenServer, it instantly becomes terrible when more processes want to communicate with the Redis server through the GenServer. Luckily, we can implement a much better solution.

## Queuing for the win

As you probably know, the `handle_call/3` callback in a GenServer doesn't have to return a result to the client right away: it can return a `{:noreply, state}` tuple and then reply to the client using `GenServer.reply/2`.

This is exacly what we need here: a way for clients to call a function on the GenServer and *block* waiting for the response, but at the same time a way for the GenServer to keep doing work until it *has* a response for that specific client.

In order continue, however, we need to ditch `:gen_tcp.recv/2` in favour of receiving TCP messages as Erlang messages. We can do that using the `active: true` instead of `active: false` when connecting to the Redis server: when `:active` is `true`, all messages from a TCP socket are delivered as Erlang messages in the form of `{:tcp, socket, message}`.

What will happen is this:

1. the Elixir process calls `command/2` on the GenServer and *blocks*, waiting for the response
2. the GenServer sends the command to the Redis server and returns `{:noreply, state}` so that it doesn't block
3. the Redis server responds to the GenServer, which receives a `{:tcp, socket, message}` message
4. the GenServer handles the message in the `handle_info/2` callback, responding to the appropriate client

As you can see, the main difference is that from the moment the GenServer sends a command to the Redis server to the moment it receives a response, the GenServer is not blocked and it can send other commands to the server. This is great!

The last thing we need to deal with is how the GenServer is supposed to respond to the **right** request: when it receives a `{:tcp, ...}` message, how does it know who to send it back with `GenServer.reply/2`? Since we're sure Redis responds to requests *sequentially* (first in, first out), we can use a simple queue to keep a list of Elixir processes waiting for a response. We'll keep this queue in the GenServer's state, enqueueing clients when they make a request and dequeueing them when a response is delivered.

{% raw %}
```elixir
defmodule Redis do
  @initial_state %{socket: nil, queue: :queue.new}
  # ...

  def handle_call({:command, command}, from, state) do
    # We send the command...
    :gen_tcp.send(state.socket, Redis.RESP.encode(command))

    # ...enqueue the client...
    state = update_in state.queue, fn(queue) ->
      :queue.in(from, queue)
    end

    # ...and we don't reply right away.
    {:noreply, state}
  end

  def handle_info({:tcp, socket, msg}, %{socket: socket} = state) do
    # We dequeue the next client
    {{:value, client}, new_queue} = :queue.out(state.queue)

    # We can finally reply to the right client.
    GenServer.reply(client, Redis.RESP.decode(msg))

    {:noreply, %{state | queue: new_queue}}}
  end
end
```
{% endraw %}

## Messages on demand

In the sections above, we moved from an `active: false` socket to an `active: true` socket in order to receive TCP data as Erlang messages. This works fine, but can lead to problems if the TCP server sends the GenServer *a lot* of data: since Erlang has no limit on the message queue of a process, the GenServer can be easily flooded with messages. To avoid that, we can change `active: true` to the more conservative `active: :once`: this way, only one TCP messages is delivered as an Erlang message, and then the socket goes back to `active: false`. We can set `active: :once` again to receive the next message, and so on. Do you see where this is going? We can process TCP data as Erlang messages but one at the time, so that we're sure we're able to process them.

We just have to remember to reactivate the socket when we receive a `{:tcp, ...}` message in the `handle_info/2` callback. We can do that using [`:inet.setopts/2`][docs-inet-setopts/2].

```elixir
defmodule Redis do
  # ...

  def handle_call({:tcp, socket, msg}, %{socket: socket} = state) do
    # Allow the socket to send us the next message
    :inet.setopts(socket, active: :once)

    # exactly as before
  end
end
```

## Plot twist

You probably don't think that I'm really smart and I figured all these nice things out by myself: well, you're right not thinking that! The pattern I described here is very common and is shared by a number of Erlang and Elixir applications. While this pattern applies nicely to any connection with a TCP server, it's often used in drivers for databases: that's why I went with Redis in the example.

Lots of real-world libraries use the pattern I talked about: for example, [eredis][eredis] (one of the most used Redis drivers for Erlang) is built very similarly to our example: just look at [this comment][eredis-comment] in the eredis source, which is basically a summary of this article (or is this article an expanded version of that comment? Who knows!). Other libraries that roughly follow this pattern are the Elixir drivers for PostgreSQL ([postgrex][postgrex]) and MongoDB ([mongodb][mongodb]). Currently I'm working on an Elixir driver for [OrientDB][orientdb] (still not public) which uses this pattern as well. So, it must work right?

## Better handling of the TCP connection

We happily ignored some annoying things throughout this article: for example, errors are not handled *at all*. We'll keep happily ignoring some of the errors that can happen, e.g., an empty client queue (which fails the {% raw %}`{{:value, val}, new_queue}`{% endraw %} match) or an incomplete message from the TCP socket.

TODO

[docs-gen_tcp]: http://www.erlang.org/doc/man/gen_tcp.html
[docs-inet-setopts/2]: http://www.erlang.org/doc/man/inet.html#setopts-2
[docs-gen_tcp-recv/2]: http://www.erlang.org/doc/man/gen_tcp.html#recv-2
[resp-specification]: http://redis.io/topics/protocol
[eredis]: https://github.com/wooga/eredis
[eredis-comment]: https://github.com/wooga/eredis/blob/770f828918db710d0c0958c6df63e90a4d341ed7/src/eredis_client.erl#L1-L21
[postgrex]: https://github.com/ericmj/postgrex
[mongodb]: https://github.com/ericmj/mongodb
[orientdb]: http://orientdb.com/orientdb/

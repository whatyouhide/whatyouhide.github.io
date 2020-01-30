---
layout: post
title: Sanely sharing Protobuf schemas across services
description: How we're managing, evolving, and sharing Protobuf schemas across several services and programming languages.
cover_image: cover-image.jpg
tags:
  - protobuf
  - elixir
  - ci
  - tooling
---

The system that we built at ([Community.com][community-website]) is made of a few services (around fifteen at the time of writing) that interact with each other through a basic version of an event sourcing system. All events are exchanged on RabbitMQ and all services use [Protobuf][protobuf] as the serialization mechanism. With several services and many more coming in the future, managing the Protobuf schemas becomes a painful part of evolving and maintaining the system. Do we copy the schemas in all services? Do we keep them somewhere and use something akin to Git submodules to keep them in sync in all of our projects? What do we do?! In this post, I'll go through the tooling that we came up with in order to sanely manage our Protobuf schemas throughout our services and technology stack.

{% include post_img.html alt="Cover image of TODO" name="cover-image.jpg" %}

{% include unsplash_credit.html name="Fahrul Azmi" link="https://unsplash.com/s/photos/library?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" %}

This post will go through the steps that led us to the solution we're currently using, so feel free to skip ahead if you just want to know what we ended up with.

## Starting out: a single Elixir library

When we started defining schemas for our Protobuf events, we were only using such schemas from Elixir. We created a library called `events` and started hosting it on our private [Hex][hex-website] repository. `events` contained all the `.proto` schema files and depended on the [exprotobuf][] library to "compile" the Protobuf schemas to Elixir code. Exprotobuf uses a different approach than most Protobuf libraries for other languages that I encountered: it loads the `.proto` schema definitions at compile time instead of using `protoc` to compile the Protobuf files to `.ex` Elixir files. Essentially, we created a module like this:

```elixir
defmodule Events do
  use Protobuf, from: Path.wildcard(Path.expand("../schemas/*.proto", __DIR__))
end
```

The most common approach to turning a Protobuf schema into a data structure representable by the programming language you're using is to turn the schema into some kind of "struct" representation. That's exactly what exprotobuf does. This is a schema we had:

```protobuf
# In schemas/event_envelope.proto
syntax = "proto3";

message EventEnvelope {
  int64 timestamp = 1;
  string source = 2;
}
```

Exprotobuf loaded this up at compile time and turned it into roughly this Elixir definition:

```elixir
defmodule Events.EventEnvelope do
  defstruct [:timestamp, :source]

  # A bunch of encode/decode functions plus new/1 to create a new struct.
  # ...
end
```

This whole approach worked okay for a while, but soon we needed to use our Protobuf definitions from a service written in Python (out of necessity).

## Sharing Protobuf schemas through Git submodules

The first thing that came to mind when we thought about sharing Protobuf schema definitions across different programming languages was [Git submodules][git-submodules]. We created a `proto_schemas` repository containing all the `.proto` files and added it as a Git submodule to our `events` Elixir library and to a single Python service. Not much changed on the Elixir side, but on the Python side things were working a bit differently. The Protobuf Python library uses a common approach among Protobuf libraries, which is to use a plugin to the `protoc` compiler in order to generate Python code from the `.proto` files. Essentially, you call:

```bash
# TODO
protoc --python_out=...
```

So for example, our `event_envelope.proto` file became `event_envelope.pb2.py`.

The Git submodule approach worked okay for a while but it presented two main challenges: how to version schemas in an uniform way across languages? How to avoid having every project contain a copy of the Protobuf schemas and having to compile them individually to the host language?

Lucky for me, one day I was discussing these problems with my good friend [Eric][ericmj] from the Elixir team and we figured out a way to only keep the Protobuf schemas in a single place, compile them all in a single place, but use them from different languages all around.

## `protoc` and CI make for a great pair

[community-website]: https://www.community.com
[hex-website]: https://hex.pm
[protobuf]: https://developers.google.com/protocol-buffers
[exprotobuf]: https://github.com/bitwalker/exprotobuf

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


[community-website]: https://www.community.com
[hex-website]: https://hex.pm
[protobuf]: https://developers.google.com/protocol-buffers
[exprotobuf]: https://github.com/bitwalker/exprotobuf

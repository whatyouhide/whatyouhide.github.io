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

{% include unsplash_credit.html name="Israel Palacio" link="https://unsplash.com/photos/ImcUkZ72oUs?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" %}

[community-website]: TODO
[protobuf]: TODO

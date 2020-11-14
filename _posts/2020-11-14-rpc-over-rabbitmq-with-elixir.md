---
layout: post
title: RPC over RabbitMQ (with Elixir)
description: TODO
cover_image: cover-image.jpg
tags:
  - elixir
  - rabbitmq
  - rpc
---

At [Community][community] we rely heavily on RabbitMQ. It's the infrastructure backbone that allows our services (over thirty at this point) to communicate with each other. That communication mostly happens through **events**: our system is what you might call an event-sourced system. However, in some cases what we need is really a *request-response* interaction between two services. This is useful for all sorts of things, as you can imagine, like retrieving data on the fly or asking a service to do something and return a response. An industry standard for such interactions is HTTP, but we are not big fans of that over here. Instead, since RabbitMQ is so ubiquitous in our system, we settled on using it for request-response interactions as well. In this post, I'll go over the architecture of such interactions, the RabbitMQ topologies we use to make them work, the benefits around reliability and the compromises around performance, and finally how this all implemented to be as fault-tolerant as possible with Elixir.

{% include post_img.html alt="Cover image people queueing" name="cover-image.jpg" %}

{% include unsplash_credit.html name="amandazi photography" link="https://unsplash.com/@amandazi_photography?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" %}

## Why RPCs over RabbitMQ

We chose to do RPCs over RabbitMQ, instead of the more common service-to-service communication via HTTP, for a few reasons.

The main reason is the same reason why we extensively use message queues as often as possible. When you have a queue-based message broker between services that talk to each other, the availability requirements of the services can be less demanding. If you have two services that communicate over HTTP, then if the receiver service is down it means that the requester service will not get a response and will have to implement request retries in order to increase the chances of a successful request.

TODO: we already have RabbitMQ

TODO: compromise about speed since you have a message broker

## Requester architecture and topology

### Elixir process architecture

## Receiver architecture and topology

### As always, Broadway is the answer

## Acknowledgements

  * Tom
  * José for making me write this post

[community]: https://www.community.com

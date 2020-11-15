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

Our focus when designing this architecture was not really performance. Since our system is event-sourced, we have alternatives to RPCs for when services need to access data *fast*. In those cases, instead of fetching data from another service via RPC, a service can build a "local" data store (usually Redis, but whatever fits best) by consuming events and have fast access to that data store.

On the other hand, we heavily focused on reliability and resource usage. We wanted our RPCs succeed whenever they can. We also wanted to limit RabbitMQ resource utilization as much as possible, since the message broker architecture shares the broker between all the services that use it.

With these goals in mind, we came up with this architecture:

{% include post_img.html alt="Sketch of the architecture of the sender service" name="sketch-caller-architecture.png" %}

I think it's easier to show what happens when we make an RPC through a good old bullet list.

  * The caller assigns a new UUID to the request and encodes the request (we happen to use Protobuf, but anything would work).

  * The caller has a dedicated queue for responses (more on this later), and it puts the name of such queue in the `reply_to` metadata field of the request.

  * The caller publishes the request on the main RPC exchange (`rpc` in our case) using headers to specify the `destination` and `procedure` to call.

  * If publishing the request is successful, the caller stores the request in an in-memory key-value store (ETS for Elixir and Erlang folks), storing the mapping from request ID to caller process.

  * The caller has a pool of processes also consuming from the response queue. When the response comes back on such queue, a consumer process picks it up, finds the corresponding caller process from the in-memory key-value store, and hands the caller process the response.

It's worth focusing on the response queue. That queue is declared by all AMQP channels in the caller pool when they start up. This is a common pattern in RabbitMQ since declaring resources (queues, exchanges, and bindings) is idempotent, that is, you can do it as many times as you want and the resource is declared only once. The response queue is declared with a key property: `auto_delete`. When this property is present, a queue is deleted as soon as there are no channels consuming from it anymore. This is exactly the behavior we want: as long as a caller pool is "up and running", there's gonna be at least one channel consuming from the queue and handing responses over to caller processes. However, if the whole pool or the whole node for the caller goes down then the queue will be deleted. This works perfectly, because if the caller node goes down, then we likely lost the "context" of the requests, and even if the node will come back up then it won't know what to do with the responses anymore. In this way, we allow RabbitMQ to clean itself up and avoid leaving garbage in it, without writing any code to do so.

### Elixir process architecture

The Elixir process architecture and supervision tree structure we use for the caller is based on the properties of the response queue described previously. We have the following constraints:

  * If the in-memory key-value store that holds the mappings between request IDs and caller processes (ETS) crashes, we want the whole pool to crash. We wouldn't be able to map responses back to requests anyways at that point, and it's better to let RabbitMQ delete the whole response queue in such cases.

  * If a connection or a channel goes down, we don't want to delete the response queue. As long as there's at least one channel consuming from the response queue, we'll be able to hand responses back to the corresponding caller processes.

With these constraints, we designed this supervision tree:

{% include post_img.html alt="Sketch of the supervision tree" name="sketch-supervision-tree.png" %}

All the code in there is build on top of the [AMQP][amqp-library] Elixir library.

## Receiver architecture and topology

The receiver architecture, compared to the caller, is straightforward. Every service sets up a pool of RabbitMQ connections (and channels), declares a queue, and binds it to the main RPC exchange (`rpc`). That exchange is a *headers* exchange, and each service usually binds the queue with the `destination` header matching that service. For example, here's the pseudocode for service `portal`:

```text
declare_queue("portal.rpcs", durable: true)
bind("portal.rpcs", exchange: "rpc", headers: [{"destination", "portal"}])
consume_from_queue("portal.rpcs")
```

All AMQP channels over all nodes of a service declare the queue and bind it *on every startup*. Idempotence, friends!

From here, it's all downhill: when a request comes in on a channel, the node decodes it, processes it, produces a response, and publishes it back on RabbitMQ. Where does it publish it? Well, good question. That's why all requests have the `reply_to` RabbitMQ metadata field set to the reply queue of the caller. We take advantage of the default `amqp.direct` exchange, which is pre-declared by all RabbitMQ nodes, to publish the response directly to the reply queue. The pseudocode to handle a request is this:

```text
response = process_request(request)
publish(exchange: "amqp.direct", routing_key: request.metadata["reply_to"])
```

{% include post_img.html alt="Sketch of the pool supervision tree" name="sketch-receiver-architecture.png" %}

### As always, Broadway is the answer

As far as Elixir specifics goes, we use [Broadway][broadway] to consume RPCs, hooking it up with the [broadway_rabbitmq][] producer.

I personally made enough changes to broadway_rabbitmq by now that, look at that, it perfectly fits our use case! This is how a typical Broadway pipeline to consume RPCs looks like:

```elixir
defmodule MyService.RPCConsumer do
  use Broadway

  def start_link([]) do
    broadway_rabbitmq_options = [
      queue: "my_service.rpcs",
      declare: [durable: true],
      bindings: [{"rpc", arguments: [{"destination", :longstr, "my_service"}]}],
      metadata: [:reply_to]
    ]

    Broadway.start_link(__MODULE__,
      name: __MODULE__,
      producer: {BroadwayRabbitMQ.Producer, broadway_rabbitmq_options},
      processors: [default: [concurrency: 10]]
    )
  end

  def handle_message(:default, message, _context) do
    request = decode_message!(message.data)
    response = request |> process_request() |> encode()

    AMQP.Basic.publish(
      message.metadata.amqp_channel,
      "amqp.direct",
      message.metadata.reply_to
    )

    message
  end
end
```

As you can see, broadway_rabbitmq exposes the AMQP channel it uses to consume under the hood in the message metadata. We use that to send replies. Easy peasy.

To be fair, we have a wrapper library around Broadway that makes this boilerplaty code a bit simpler and more tailored to our use case. It also provides us with some nice additions such as round-robin connection attempts over a list of RabbitMQ URLs (since our RabbitMQ provider gives us a few URLs for reliability), automatic decoding of requests so that the decoding is done under the hood, metrics, error reporting, and so on. However, the gist of it is exactly the code above.

## Acknowledgements

Two people have been instrumental in this architecture and implementation (I'd say not *equally* instrumental...). First and foremost my coworker and friend [Tom Patterer][tom], who designed and implemented the system with me. Then, I also need to thank [José][jose] because he pushed me to write this blog post when I chatted with him about all of this.

[community]: https://www.community.com
[tom]: TODO
[jose]: https://twitter.com/josevalim?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eserp%7Ctwgr%5Eauthor
[broadway]: TODO
[broadway_rabbitmq]: TODO
[amqp-library]: TODO

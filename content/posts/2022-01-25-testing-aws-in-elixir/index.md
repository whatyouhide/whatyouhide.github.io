---
title: Testing AWS in Elixir
description: An overview of how we test Elixir applications that interact with AWS.
extra:
  cover_image: cover-image.jpg
taxonomies:
  tags:
    - elixir
    - community
---

At Community, we run most of our infrastructure and services on AWS. We use several AWS services. Many of our own services interact with AWS directly, such as by uploading and downloading files from S3, querying Athena, and more. Lately, I've been trying to improve how we *test* the interaction between our services and AWS, testing error conditions and edge cases as well as running reproducible integration tests. In this post, I'll talk about Localstack, mocks, ExAws, and more.

<!-- more -->

![Cover image of a data center](cover-image.jpg)

{{ unsplash_credit(name="Ian Battaglia", link="https://unsplash.com/@ianjbattaglia?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText") }}

AWS is an external system that our system has limited control over. First, it operates over the network, which makes it vulnerable to all sorts of network issues and failures. Furthermore, I can't control how an AWS service operates or its business logic. However, as external services go, it's a stable one when it comes to its APIs.

When I work with external systems like AWS, I want to test two aspects:

  1. What happens on the uncommon code branches — network failures, services unavailable, all sorts of things that we know can (and will) happen.

  1. What happens when interacting with the actual service — I want the application's code to have some tests that execute the whole code that interacts with the external service end-to-end, without mocks in the middle.

Let's take a look at these below. I set up [a repository][accompanying-repo] with most of the code discussed here, so you can see it pieced together and working.

## Testing Uncommon Conditions

Testing relatively-uncommon conditions (such as network failures) requires precise control of the external system. We do not have *any* control of the external system in the case of something like AWS. **Test doubles** are helpful in these cases.

I call "test double" any piece of code that mimics a dependency of a system but is only used in tests. Folks use terms like test double, mock, or stub interchangeably, but I'm a stickler for this stuff, so I'll use *test double* in this post.

In our case, AWS is a natural point where to define a contract between our system and an external dependency. I always think back to [José Valim][jose-twitter]'s legendary post ["Mocks and Explicit Contracts"][jose-mocks-post] when talking about these things. Go give it a read if you haven't read it already.

### ExAws and Its Behaviour (With a "U")

To interact with AWS in our Elixir services we use [ExAws][ex_aws] and its plethora of service libraries. I generally like ExAws but lately found a not-very-advertised feature that I *love*. I suspect it's not even intended for the purpose we're going to use it for here, but it fits like a glove.

ExAws's architecture is essentially made of a main ExAws library which contains code to make generic HTTP requests to various AWS services. On top of that, there are many service-specific libraries (such as [ex_aws_s3][]). These libraries usually define **operations** that implement the [`ExAws.Operation`][docs-ex_aws-operation] behaviour. Operations are just data structures. The way you use ExAws is that you create operations (that is, data structures) using the service-specific libraries and execute them against AWS using the main ExAws library.

This is where the cool things begin. ExAws also ships with the [`ExAws.Behaviour`][docs-ex_aws-behaviour] behaviour, which defines the core functionality provided by the library. Well, wouldn't you know, that core functionality is exactly the set of functions that take operations and execute them against AWS. This is the perfect architecture for test doubles.

### Test Doubles for ExAws

We use [Mox][mox] for test doubles (well, "mocks" as the library calls them). In our application, we usually define a test double for `ExAws` itself. It's as simple as the code below, which we have in a file called `test/support/mocks.ex`. We add `test/support` to `:elixirc_paths` in `mix.exs` for the `:test` Mix environment.

```elixir
Mox.defmock(ExAwsMock, for: ExAws.Behaviour)
```

In any code that executes AWS requests, we don't use `ExAws.request/1` or `ExAws.stream/1`. Instead, we read the module to use at compile time from our application configuration (still defaulting to `ExAws`).

```elixir
defmodule MyApp do
  @ex_aws_mod Application.compile_env(:my_app, [:test_doubles, :ex_aws], ExAws)

  def get_s3_file(bucket, path) do
    operation = ExAws.S3.get_object(bucket, path)
    @ex_aws_mod.request(operation)
  end
end
```

Now, testing this is straightforward using the functionality provided by Mox.

```elixir
import Mox

setup :verify_on_exit!

test "some piece of code that uses get_s3_file/2" do
  expect(ExAwsMock, :request, fn operation ->
    assert %ExAws.Operation.S3{} = operation
    assert operation.http_method == :get
    assert operation.bucket == "my bucket"
    assert operation.path == "expected/path"

    {:ok, %{body: "file contents"}}
  end)

  run_code()
end
```

Testing the uncommon cases is just as straightforward, since we control the value returned by the mock's function.

```elixir
expect(ExAwsMock, :request, fn _operation ->
  {:error, {:http_error, 403, %{}}}
end)
```

We need little code to achieve all this. The operation data structure combined with the behaviour make it easy to build flexible test doubles that we can use to assert we are making the right calls to AWS and to control return values with precision.

## Integration Tests

Using test doubles works well in many cases, but it has one drawback that I can't get over. By using test doubles, we are *not exercising* parts of our application code when running tests. Achieving 100% code coverage and exercising every single production code line when testing is not easy. Often, it's not worth it either. However, testing the interactions with AWS only in the running production code seems a bit too far on the other end.

Luckily, for this particular use case there's a pretty fantastic tool called [Localstack][localstack]. Localstack provides a faithful replica of AWS itself, but running locally. It fits this use case perfectly (it was kind of built for local integration testing, you could say).

Just a note here: before Localstack, we sometimes used to use [ExVCR] to perform this sort of more integration tests. ExVCR lets you *record HTTP requests* and make sure that your requests conform to the recorded real requests. It can work well in some cases, but for AWS it didn't give us the flexibility of quickly changing the way we interface with AWS itself. On top of that, ExVCR is ultimately still defining test doubles under the hood, so we are still not exercising the real ExAws HTTP code.

### Running Localstack

We use [Docker][docker] for running our production application, so we are heavily invested in the Docker ecosystem on our local machines too. We already use Docker and [Docker Compose][docker-compose] locally to spin up infrastructure needed by the services we work on. A typical `docker-compose.yml` file in one of our services looks like this:

```yaml
version: "3"

services:
  event-bus:
    image: our-rabbitmq-image
    ports:
      - "5672:5672"
      - "15672:15672"

  redis:
    image: "redis:5.0-alpine"
    ports:
      - "6379:6379"
```

You can run Localstack in a few different ways, but for us the natural fit is to add it as an infrastructure dependency in the `docker-compose.yml` file.

```yaml
  localstack:
    image: localstack/localstack
    environment:
      AWS_DEFAULT_REGION: "us-west-2"
      SERVICES: "s3,sqs"
      EDGE_PORT: "4566"
    ports:
      - "4566:4566"
```

As you can see, Localstack uses the `SERVICES` environment variable configure which services to make available. In this case, we specified AWS S3 and AWS SQS.

We can now spin up local infrastructure the same way we did before, with `docker compose up`. AWS S3 and AWS SQS are running locally, which is pretty cool.

### Pointing ExAws to Localstack

Next step is configuring ExAws to talk to the local Localstack running instance.

To do that, we add some configuration to `config/test.exs` that only takes affect in the `:test` Mix environment. You could easily adapt this to work similarly in the `:dev` environment if you wanted to.

```elixir
# In config/test.exs
aws_uri =
  System.get_env("AWS_ENDPOINT_URL", "http://localhost:4566")
  |> URI.parse()

for service <- [:s3, :sqs] do
  config :ex_aws, service,
    scheme: aws_uri.scheme,
    host: aws_uri.host,
    port: aws_uri.port
end
```

We're now almost ready to run some integration tests by talking to the local Localstack.

### Bypassing the ExAws Test Double

Remember that in our code we read the ExAws module to use **at compile time**.

```elixir
@ex_aws_mod Application.compile_env(:my_app, [:test_doubles, :ex_aws], ExAws)
```

This means that we cannot use `ExAws` as the module, because `@ex_aws_mod` has been *compiled* to `ExAwsMock` in the test environment. This is great for performance since we don't need any runtime lookup to retrieve the ExAws module in production, so we're not really willing to change this approach.

Luckily, Mox ships with the perfect feature for this: the [`stub_with/2` function][docs-mox-stub_with]. This function tells mock to call out to another module when defining the stubs for all the functions in the given module. The only requirement is that both the mock module passed as the first argument as well as the module passed as the second argument implement the same behaviour. Well, `ExAws` implements the `ExAws.Behaviour` already. The world is smiling upon us all here.

In integration tests that want to talk to the local Localstack instead of defining stubs and mocks for `ExAws` functions, we do this:

```elixir
setup do
  Mox.stub_with(ExAwsMock, ExAws)
end
```

This effectively "resets" the ExAws mock to use ExAws itself. To make this a little more streamlined, we can define this as a test helper function and use it similarly to how we use `setup :verify_on_exit!` from Mox.

```elixir
# In test_helpers.exs (or wherever you define your test helpers)
defmodule TestHelpers do
  def use_real_ex_aws(_ex_unit_context) do
    Mox.stub_with(ExAwsMock, ExAws)
    :ok
  end
end

# In tests
defmodule MyTest do
  use ExUnit.Case

  import TestHelpers

  setup :use_real_ex_aws

  # ...
end
```

### Data Setup and Teardown

One missing piece of the puzzle here is that, when using Localstack, we need to manually perform some test setup and teardown. When using test doubles, we can decide "on the fly" what to return from the stub or mock functions, without having to *prepare* the test doubles in any way. With Localstack, we need to perform all the necessary AWS setup and data setup (and teardown) in order for our tests to test something.

For example, imagine you want to test how your code retrieves a file from AWS S3 and writes its contents to a local file. To do that, you'll have to:

  1. Create a bucket in Localstack's S3
  1. Write a file to that bucket
  1. Exercise your code and run assertions
  1. Likely, delete the bucket to clean up for other tests to run

These steps vary for different configurations and test architectures, but you get the idea. To do the setup and teardown, we just use ExAws directly and manually create the topology we want in the AWS services. For the S3 example above, we would do something like this:

```elixir
test "reading a file and writing it out" do
  # Create some random bytes to store in the file.
  contents = :crypto.strong_rand_bytes(100)

  # We set up an on_exit callback to empty and then delete the bucket
  # when the test exit, so that the next test has a clean slate.
  on_exit(fn ->
      "test-bucket"
      |> ExAws.S3.list_objects()
      |> ExAws.stream!()
      |> Enum.each(&ExAws.request!(ExAws.S3.delete_object("test-bucket", &1.key)))

      ExAws.request!(ExAws.S3.delete_bucket("test-bucket"))
  end)

  # Create bucket.
  ExAws.request!(ExAws.S3.put_bucket("test-bucket", "us-west-2"))

  # Upload a file.
  ExAws.request!(ExAws.S3.put_object("test-bucket", "my/random/file", contents))

  # Now, we run our code and assert on its behavior.
  MyApp.download_s3_file!("test-bucket", "my/random/file", to: "localfile")
  assert File.read!("localfile") == contents
end
```

## Conclusion

In this post we saw how ExAws provides the perfect functionality for easily writing integration tests using Localstack as well as defining test doubles for precise controls of behavior in testing. If you want to dig deeper into integration testing with Elixir, test doubles, end-to-end tests, and more, check out [Testing Elixir][testing-elixir], the book I co-wrote with [Jeffrey Matthias][jeffrey].

Remember to check out the [repository][accompanying-repo] that contains all the code and techniques discussed in this post if you want to see it all in action.

[jose-mocks-post]: http://blog.plataformatec.com.br/2015/10/mocks-and-explicit-contracts/
[jose-twitter]: https://twitter.com/josevalim
[ex_aws]: https://github.com/ex-aws/ex_aws
[ex_aws_s3]: https://github.com/ex-aws/ex_aws_s3
[mox]: https://github.com/dashbitco/mox
[ExVCR]: https://github.com/parroty/exvcr
[localstack]: https://localstack.cloud/
[docker]: https://www.docker.com/
[docker-compose]: https://docs.docker.com/compose/
[docs-ex_aws-operation]: https://hexdocs.pm/ex_aws/ExAws.Operation.html
[docs-ex_aws-behaviour]: https://hexdocs.pm/ex_aws/ExAws.Behaviour.html
[docs-mox-stub_with]: https://hexdocs.pm/mox/Mox.html#stub_with/2
[testing-elixir]: https://pragprog.com/titles/lmelixir/testing-elixir/
[jeffrey]: https://twitter.com/idlehands
[accompanying-repo]: https://github.com/whatyouhide/testing_aws_in_elixir

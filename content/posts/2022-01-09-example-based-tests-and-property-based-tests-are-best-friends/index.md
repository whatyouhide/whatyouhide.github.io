---
title: Example-based Tests And Property-based Tests Are Good Friends
description: A short look at mixing property-based tests and example-based tests to get the best of both worlds.
extra:
  cover_image: cover-image.jpg
taxonomies:
  tags:
    - elixir
    - community
---

I mostly use property-based testing to test stateless functional code. A technique I love to use is to pair property-based tests together with *example-based tests* (that is, "normal" tests) in order to have some tests that check real input. Let's dive deeper into this technique, some contrived blog-post-adequate examples, and links to real-world examples.

<!-- more -->

![Cover image of just a bunch of pencils](cover-image.jpg)

{{ unsplash_credit(name="David Pennington", link="https://unsplash.com/@dtpennington?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText") }}

I've been a vocal advocate of property-based testing for a while. I wrote [`stream_data`][stream_data], a property-based testing framework for Elixir, [gave talks about the topic][my-talk], and used property-based testing at work and in my open-source software (such as [Corsica][corsica-properties] or [Redix][redix-properties]).

The most common way I use property-based testing is to test *stateless* pieces of code. These tend to be the easiest to come up with properties for.

In this short post, I want to talk about one of my favorite techniques to use when writing property-based tests: mixing properties with explicit "example-based" tests. Example-based tests are the tests you're used to, where you have some predefined inputs and expected respective outputs and assert that your code matches the inputs to the outputs.

The idea behind this technique is to combine the ability of property-based testing to test a wide range of input data together with some practical example-based tests that ensure that our code behaves as expected on real inputs.

## Diving Into an Example

I use this technique quite often. Recently, I used this when writing tests for some JSON-related code in the [Protobuf library for Elixir][elixir-protobuf] that I help maintain. Let's take this as the main example.

We're writing a function called `parse_nanoseconds/1` with this spec:

```elixir
@spec parse_nanoseconds(String.t()) :: {0..999_999_999, String.t()}
```

Its job is to:

  1. take a string
  1. extract the leading one to nine digits from it
  1. parse those digits into an integer that represents conventional nanoseconds in a timestamp
  1. return the parsed integer alongside whatever's left of the original string (similar to [`Integer.parse/2`][integer-parse])

  For example, `123` means 123 *milliseconds*, so `123_000_000` nanoseconds. `000_001` means one microsecond, `000_000_001` means one nanosecond. You get the idea. By the way, see what I did just now? I just showed you some **examples** of how the function should behave. These make perfect material for our example-based tests.

### Designing the Properties

Thinking about properties that hold for the output of this function given a valid input, here's what I got.

  1. For valid strings of nine or fewer digits, the output of `parse_nanoseconds/1` must be an integer in the range `0..999_999_999`.

  1. For any string of nine or fewer digits followed by any string `trail`, `trail` should be returned untouched.

I encoded these into a single `property` test (this uses `stream_data`):

```elixir
defmodule MyTest do
  use ExUnit.Case
  use ExUnitProperties

  property "returns valid nanoseconds integer and trailing string" do
    # Generator that generates strings of 1 to 9 digits.
    nanos_prefix_gen = string(?0..?9, min_length: 1, max_length: 9)

    check all nanos <- nanos_prefix_gen,
              rest <- string(:printable),
              string = nanos <> rest do
      assert {parsed_nanos, parsed_rest} = parse_nanoseconds(string)
      assert parsed_nanos in 0..999_999_999
      assert parse_rest == rest
    end
  end
end
```

Now for the catch: we can write a bunch of implementations of `parse_nanoseconds/1` that satisfy this property with no issue, but that are **semantically wrong**. A contrived, slightly-weird, but effective example is below.

```elixir
# Sneaky implementation that is wrong but satisfies our properties:
def parse_nanoseconds(string) do
  case Regex.split(~r/\d{1,9}/, string, parts: 2) do
    ["", rest] -> {0, rest}
    _other -> :error
  end
end
```

The implementation above uses a regex to split the string in two parts on the first occurrence of one to nine digits. The `["", rest]` match means that the string was split at the start, so a sequence of digits was found at the start. To keep getting weirder, we're just returning `0` as the nanoseconds. Seems crazy, but guess what? It passes our property. Yeah.

### Reintroducing Example-Based Tests

Are property-based tests bad? Should we go back to example-based tests and curse the day we thought to use something cool? Well, what I like to do is reintroduce example-based tests to save the day but keep the property-based tests to get all the benefits from those.

I turned the property above into this:

```elixir
property "returns a valid nanoseconds integer and the trailing string" do
  # Example-based part:
  assert parse_nanoseconds("123foo") == {123_000_000, "foo"}
  assert parse_nanoseconds("000000001") == {1, ""}

  # Property part (unchanged):
  nanos_prefix_gen = string(?0..?9, min_length: 1, max_length: 9)

  check all nanos <- nanos_prefix_gen,
            rest <- string(:printable),
            string = nanos <> rest do
    assert {parsed_nanos, parsed_rest} = parse_nanoseconds(string)
    assert parsed_nanos in 0..999_999_999
    assert parse_rest == rest
  end
end
```

With just a couple of example-based assertions thrown in there, the bogus implementation crumbles and fails miserably.

I sometimes keep the example-based assertions in the `property` itself and other times prefer to split them up, but the principle stays the same.

### Regressions

Another fantastic use case for using example-based tests together with property-based tests is testing **regressions**. `stream_data` (and I'm sure other property-based testing frameworks) often gets feature requests to specify some explicit values in generators. This way, users can be sure that the property they're encoding will go through some known values that are likely to create issues because of the domain or that caused regressions in the past. My answer is always that this is exactly where the technique described in this blog post comes in handy. You can write your property and pair it up with example-based tests that test your explicit values.

## Conclusion

This technique is simple, but I find it effective and practical. You get the benefits of property-based testing, like covering a wide range of inputs and discovering unhandled corner cases, but pair those with some practical examples. Those can provide you with some "sanity checks" to have at least some confidence that your code is doing what it's supposed to on real-world examples. Those example-based tests can also cover well-known "problematic" values of your input space as well as regressions.

If you are curious about actual examples, go look at the [actual tests in the Protobuf library][actual-tests].

I wrote a bit more about this technique and in general about property-based testing in [Testing Elixir][testing-elixir], the Pragmatic Programmers book I co-authored with Jeffrey Matthias.

[stream_data]: https://github.com/whatyouhide/stream_data
[my-talk]: https://www.youtube.com/watch?v=p84DMv8TQuo
[corsica-properties]: https://github.com/whatyouhide/corsica/blob/a4328f6bae1ccdaeb6d9fed14263c5c5a43540a6/test/properties_test.exs
[redix-properties]: https://github.com/whatyouhide/redix/blob/53216ab4ba96ceceb3e963faca02e2bf25abdb9a/test/redix/protocol_test.exs
[elixir-protobuf]: https://github.com/elixir-protobuf/protobuf
[integer-parse]: https://hexdocs.pm/elixir/Integer.html#parse/1
[actual-tests]: https://github.com/elixir-protobuf/protobuf/blob/00144b3a08aac7a38e3e9774a438dcc7da3d8bc7/test/protobuf/json/utils_test.exs
[testing-elixir]: https://pragprog.com/titles/lmelixir/testing-elixir/

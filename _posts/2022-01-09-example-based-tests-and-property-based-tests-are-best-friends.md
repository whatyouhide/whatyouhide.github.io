---
layout: post
title: Example-based Tests And Property-based Tests Are Good Friends
description: A short look at mixing property-based tests and example-based tests to get the best of both worlds.
cover_image: cover-image.jpg
tags:
  - elixir
  - property-based-testing
---

I mostly use property-based testing to test stateless functional code. A technique I love to use is to pair property-based tests together with *example-based tests* (that is, "normal" tests!) in order to have some sanity checks on whether the code behaves as expected on real input. Let's dive deeper into this technique, some contrived blog-post-adequate examples, and links to real-world examples.

{% include post_img.html alt="Cover image of just a bunch of pencils" name="cover-image.jpg" %}

{% include unsplash_credit.html name="David Pennington" link="https://unsplash.com/@dtpennington?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" %}

I've been a vocal advocate of property-based testing for a while. I wrote stream_data, a property-based testing framework for Elixir, [gave talks about the topic][], and used property-based testing at work and in my open-source software.

The most common way I use property-based testing is to test stateless pieces of code. These tend to be the easiest to come up with properties for.

In this short post, I want to talk about one of my favorite techniques to use when writing property-based tests: mixing properties with explicit unit tests.

The idea behind this is to combine the power of property-based testing to test a wide input of data together with some practical example-based tests that ensure that our code behaves as expected on real inputs.

## Diving Into an Example

I use this technique quite often. Recently, I used this when writing tests for some JSON-related code in the [Protobuf library for Elixir][elixir-protobuf] that I help maintain. Let's take this as the main example.

We're writing a function called `parse_nanoseconds/1`. Its job is to take a string, extract the leading digits from it, and parse those into an integer that represents conventional nanoseconds in a timestamp. For example, `123` means 123 *milliseconds*, so `123_000_000` nanoseconds. `000_001` means one microsecond, `000_000_001` means one nanosecond. You get the idea. This function should also return the rest of the string after the digits, like `Integer.parse/2` does.

Thinking about properties for this code, two comes to mind:

  1. for valid strings of nine or less digits, the output of `parse_nanoseconds/1` must be an integer in the range `0..999_999_999`;

  1. for any string of nine or less digits followed by any string `trail`, `trail` should be returned untouched.

I encoded these into a single `property` test in stream_data:

```elixir
property "returns a valid nanoseconds integer and the trailing string" do
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

Here's the catch: we can write a bunch of implementations of `parse_nanoseconds/1` that satisfy this property with no issue but that are semantically wrong. A contrived, slightly-weird, but effective example is below.

```elixir
def parse_nanoseconds(string) do
  case Regex.split(~r{\d{1,9}}, string, parts: 2) do
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

  # Property part:
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

Another fantastic use case for using example-based tests together with property-based tests is testing **regressions**. stream_data (and I'm sure other property-based testing frameworks) often gets feature requests to specify some explicit values in generators. This way, users can be sure that the property they're encoding will go through some known values that are likely to create issues because of the domain or that caused regressions in the past. My answer is always that this is exactly where the technique described in this blog post comes in handy. You can write your property and pair it up with example-based tests that test your explicit values.

## Conclusion

This technique is simple, but I find it effective and practical. You get the benefits of property-based testing, like covering a wide range of inputs and discovering unhandled corner cases, but pair those with some practical examples. Those can provide you with some "sanity checks" to have at least some confidence that your code is doing what it's supposed to on real-world examples. Those example-based tests can also cover well-known "problematic" values of your input space as well as regressions.

If you are curious about actual examples, go look at the [actual tests in the Protobuf library][actual-tests].

I wrote a bit more about this technique and in general about property-based testing [Testing Elixir][testing-elixir], the Pragmatic Programmers book I co-authored with Jeffrey Matthias.

[elixir-protobuf]: https://github.com/elixir-protobuf/protobuf
[actual-tests]: https://github.com/elixir-protobuf/protobuf/blob/00144b3a08aac7a38e3e9774a438dcc7da3d8bc7/test/protobuf/json/utils_test.exs

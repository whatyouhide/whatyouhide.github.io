---
layout: post
title: A story of regret and retiring a library from Hex
description: I'm retiring a library of mine from Hex. I want to explain why.
cover_image: cover-image.jpg
tags:
  - elixir
---

Now the story of an Elixir library and the one author who had no choice but to take it away.

{% include post_img.html alt="Cover image of a map" name="cover-image.jpg" %}

<a style="background-color:black;color:white;text-decoration:none;padding:4px 6px;font-family:-apple-system, BlinkMacSystemFont, &quot;San Francisco&quot;, &quot;Helvetica Neue&quot;, Helvetica, Ubuntu, Roboto, Noto, &quot;Segoe UI&quot;, Arial, sans-serif;font-size:12px;font-weight:bold;line-height:1.2;display:inline-block;border-radius:3px" href="https://unsplash.com/@nicnut?utm_medium=referral&amp;utm_campaign=photographer-credit&amp;utm_content=creditBadge" target="_blank" rel="noopener noreferrer" title="Download free do whatever you want high-resolution photos from Nicola Nuttall"><span style="display:inline-block;padding:2px 3px"><svg xmlns="http://www.w3.org/2000/svg" style="height:12px;width:auto;position:relative;vertical-align:middle;top:-1px;fill:white" viewBox="0 0 32 32"><title>unsplash-logo</title><path d="M20.8 18.1c0 2.7-2.2 4.8-4.8 4.8s-4.8-2.1-4.8-4.8c0-2.7 2.2-4.8 4.8-4.8 2.7.1 4.8 2.2 4.8 4.8zm11.2-7.4v14.9c0 2.3-1.9 4.3-4.3 4.3h-23.4c-2.4 0-4.3-1.9-4.3-4.3v-15c0-2.3 1.9-4.3 4.3-4.3h3.7l.8-2.3c.4-1.1 1.7-2 2.9-2h8.6c1.2 0 2.5.9 2.9 2l.8 2.4h3.7c2.4 0 4.3 1.9 4.3 4.3zm-8.6 7.5c0-4.1-3.3-7.5-7.5-7.5-4.1 0-7.5 3.4-7.5 7.5s3.3 7.5 7.5 7.5c4.2-.1 7.5-3.4 7.5-7.5z"></path></svg></span><span style="display:inline-block;padding:2px 3px">Nicola Nuttall</span></a>

It was October of 2015. I was a young Elixir developer, eager to contribute and help the community. One day, someone on the [mailing list][ml-discussion] proposed a new feature for Elixir: ES6-like map destructuring. It would look like this:

```elixir
iex> %{username, age} = %{username: "andrea", age: 27}
iex> username
"andrea"
iex> age
27
```

In short, you don't bind variables through the usual `%{username: username} = map` pattern matching. You instead use a short-hand syntax that lets you reduce the repetition.

The initial response was good. People looked excited. Then Josh Adams wrote this:

> I worry that this feature makes code much harder to read and encourages a bit of magic that I don't much love.

I was with Josh on this one. This was me a few messages later:

> [...] it's often tedious to do `foo: foo` but I prefer clarity over conciseness in this case.

A bit after this, José pointed out that this syntax would not work everywhere because we would need support for matching on atom keys but also string keys. He also pointed out that maybe a better way to implement this in Elixir would have been sigils. For example, we could have a `~m` sigil:

```elixir
iex> ~m(username age) = %{username: "andrea", age: 27}
iex> username
"andrea"
```

Since sigils support modifiers, we would have `~m(...)` to match on string keys and `~m(...)a` to match on atom keys. I liked this and wrote:

> I stood against the `%{foo, bar, baz}` syntax and deemed that too implicit, but I'm in favour of a possible `~m` sigil. [...] I took a stab at it and wrote a simple implementation for such sigil. We can try it out and see if we like it.

I had just released [short_maps][short_maps]. Life was good.

## The decline

Fast forward a few years. short_maps is used here and there in the Elixir community. But requests for features keep coming in. Someone wants support for nested maps. Others want the `a` modifier to go, defaulting to atoms. At some point, a long discussion takes place in short_maps' [issue tracker][shorter_maps-issue]. The discussion -- a very nice and wholesome discussion, thanks Elixir community! -- eventually leads to a fork of short_maps being published. [shorter_maps][shorter_maps] supports everything and then some: update syntax, nested maps, string keys through a different sigil, you name it. I was not happy about the fork because it created a "split" in the community who now had two packages to choose from that did similar things. This is democracy and open source though, so all was good.

However, this discussion started to make me think about short_maps and the reason it existed. I had created it so the Elixir community could try out a feature that eventually *might* have made it into the core language. It was not meant to be a widely used library: if the community liked it so much, we could have merged it into core. That didn't seem like the case, but moreover, I was the one not liking it.

## Why I don't like short_maps

short_maps adds magic to Elixir. When someone uses short_maps in their codebase, it forces folks that read that codebase -- even experienced Elixir developers -- to know about it. Being a syntax feature, it's really in your face and it makes code hard to read if you are not familiar with it. The distinction between atom keys and string keys is also not obvious, with the result being code that looks more obfuscated. Incidentally, these reasons are what made me dislike the built-in `~w` sigil as well. I understand verbosity annoys many, but I wouldn't sacrifice verbosity over clarity.

## Taking action

All of this led me to be really against short_maps. So I'm taking a dramatic decision: I am retiring short_maps from Hex. Practically, this means that short_maps will still work as usual, but you will get a warning when using it. I feel strongly about moving the community away from this library, but at the same time, I am at peace with this decision because of the existence of shorter_maps. If you really like short_maps, you'll have shorter_maps available. After all, Elixir is an extensible language and I love it for that, so you should always be free to bend it in whatever way you like.

## Conclusion

From the infamous [short_maps issue][shorter_maps-issue]:

> It's really unfortunate that the split happened. Elixir has far fewer libs than the nodejs ecosystem.

So there you go. Consider short_maps gone, and the split reverted.

I don't regret creating short_maps. It was an experiment and it showed me once again how flexible Elixir is. But it's time for it to go, and in this case, for stability and simplicity to replace experimentation.

Bye short_maps. It was a fun ride. Thanks for listening.


[ml-discussion]: https://groups.google.com/forum/#!topic/elixir-lang-core/NoUo2gqQR3I
[short_maps]: https://github.com/whatyouhide/short_maps
[shorter_maps]: https://github.com/meyercm/shorter_maps
[shorter_maps-issue]: https://github.com/whatyouhide/short_maps/issues/11

---
title: Reducing Compile-Time Dependencies in Gettext for Elixir
description: |
  This is how we significantly improved compilation time for Elixir projects that use Gettext, using a few metaprogramming tricks and ten years of Elixir experience since we wrote the first version of this library.
extra:
  cover_image: cover-image.jpg
---

The Elixir compiler does what most modern compilers have to do: it only recompiles the files it *needs* to. You change a file, and the compiler figures out all the files that somehow depend on that file. Those are the only files that get recompiled. This way, you get to avoid recompiling big projects when changing only a few files.

All good and nice, but it all relies on files not having too many dependent files. That's what was happening with [Gettext][gettext], Elixir's localization and internationalization library. This post goes through the issue in detail, and how we ended up fixing it.

<!-- more -->

![Cover image of a network of ropes connected to each other.](cover-image.jpg)

{{ unsplash_credit(name="Clint Adair", link="<https://unsplash.com/photos/green-and-black-rope-BW0vK-FA3eg>") }}

## The Issue

[José] and I started Gettext for Elixir in March 2015, so close to ten years ago at the time of writing. Back then, writing Elixir was different. We didn't think too much about generating a lot of code at compile time, inside macros and `use` calls.

The way Gettext has worked for most of its lifetime has been this. Users created a **Gettext backend** by calling `use Gettext` within a module in their application:

```elixir
defmodule MyApp.Gettext do
  use Gettext, otp_app: :my_app
end
```

That little line of code generated a whopping **twenty-one macros and functions** in the calling module. Users could call those macros to perform translation:

```elixir
import MyApp.Gettext

gettext("Hello world")
```

Gettext backends read `.po` and `.pot` files containing translations and compile those translations into pattern matches. Every time you add or change a translation, the Gettext backend needs to be recompiled. I wrote a [whole blog post](/posts/compile-time-work-with-elixir-macros/) about how Gettext extraction and compilation work, if you're curious.

This works pretty straightforward overall. However, calling those Gettext macros creates a compile-time dependency on the imported backend. Just `import`ing the backend doesn't, as that's what the Elixir compiler calls an **export dependency**—the difference is explained in [`mix xref`'s documentation][hexdocs-dependency-types].

This makes sense: if a module changes, we want to recompile modules that use *macros* from it too, as those macros are expanded at compile time. The main issue arose with [Phoenix] applications. By default, Phoenix has a `MyAppWeb` module for boilerplate code that you want to inject in controllers, views, and whatnot. For controllers, live views, live components, and views, the generated code included this:

```elixir
import MyAppWeb.Gettext
```

You could use `*gettext` macros everywhere this way. Maybe you can already see the issue: everything using Gettext macros would have a compile-time dependency on the backend. Uh oh. Take a look at this: I generated a new Phoenix app (`mix phx.new my_app`), added `gettext/1` calls to all controllers and views, and then used [`mix xref`][mix-xref] to trace all the files that have a compile-time dependency on `MyAppWeb.Gettext`.

```bash
$ mix xref graph --sink lib/my_app_web/gettext.ex --label compile
lib/my_app_web/components/core_components.ex
└── lib/my_app_web/gettext.ex (compile)
lib/my_app_web/controllers/error_html.ex
└── lib/my_app_web/gettext.ex (compile)
lib/my_app_web/controllers/page_controller.ex
└── lib/my_app_web/gettext.ex (compile)
lib/my_app_web/controllers/page_html.ex
└── lib/my_app_web/gettext.ex (compile)
```

Yuck! In an app with tens of controllers and views, the list above gets a lot longer. But worry not, we fixed this.

## The Fix

We do need to generate something in Gettext backends: the actual translations pattern matches. Gettext generates two important functions to handle that in each backend, `lgettext` and `lngettext`. `lgettext`'s signature looks like this:

```elixir
def lgettext(locale, domain, msgctxt \\ nil, msgid, bindings)
```

The generated clauses are a bunch of these:

```elixir
def lgettext("it", "default", nil, "Red", _bindings), do: "Ross"
def lgettext("it", "default", nil, "Green", _bindings), do: "Verde"
def lgettext("it", "default", nil, "Yellow", _bindings), do: "Giallo"
# ...and so on
```

Well, after thinking about it for a bit, we realized that this is all we need from a Gettext backend. We don't need all the macros we generated in them, or the translation-extraction feature (we can do that outside of the backend). We just need the backend to hold the compiled patterns for the translations.

So, [Jonatan] (one of the maintainers of Gettext for Elixir) [came up][jonatan-api-comment] with an initial API where we would not have to `import` Gettext backends:

```elixir
defmodule MyApp.Gettext do
  use Gettext, otp_app: :my_app
end

defmodule MyApp.Greeter do
  use Gettext, backend: MyApp.Gettext

  def say_hello, do: gettext("Hello")
end
```

This was the right direction, but we needed to actually implement it. After refining and iterating on the API for a while, we came up with a re-hauled solution to using Gettext. It goes like this.

First, you `use Gettext.Backend` (instead of just `Gettext`) to create a Gettext backend:

```elixir
defmodule MyApp.Gettext do
  use Gettext.Backend, otp_app: :my_app
end
```

Very clear that you're defining just a backend—or a repository of translations, or a storage for translations, or however you want to think about this. The Gettext backend just exposes `lgettext` and `lngettext` (which are [documented callbacks now][hexdocs-gettext-backend]).

Then, you have [`Gettext.Macros`][hexdocs-gettext-macros]. This is where all those `*gettext` macros live now. There's a variant of each of those macros suffixed in `_with_backend` which now explicitly takes a backend as its first argument. So, no magic here anymore:

```elixir
Gettext.Macros.gettext_with_backend(MyApp.Gettext, "Purple")
#=> "Viola"
```

Not super ergonomic though. So, we also have "normal" `gettext` macros. These infer the backend from an internal module attribute, that you set by using the original API proposed by Jonatan:

```elixir
defmodule MyApp.Greeting do
  use Gettext, backend: MyApp.Gettext

  def say_hello, do: gettext("Hello")
end
```

That's it! `gettext/1` here does not come from the backend, it comes from `Gettext.Macros`, which is never recompiled (it comes from a dependency after all). Walking backwards, the code above roughly translates to:

```elixir
defmodule MyApp.Greeting do
  @gettext_backend MyApp.Gettext

  def say_hello do
    Gettext.Macros.gettext_with_backend(@gettext_backend, "Hello")
  end
end
```

In turn, `say_hello/0`'s contents more or less expand to:

```elixir
def say_hello do
  if extracting_gettext?() do
    extract_translation(@gettext_backend, "Hello")
  end

  # This finally calls @gettext_backend.lgettext/5 internally:
  Gettext.gettext(@gettext_backend, "Hello")
end
```

`Gettext.gettext/2` calls the backend's `lgettext/5` function "dynamically" (akin to using [`apply/3`][hexdocs-kernel-apply]), which **does not create a compile-time dependency**!

That's the trick. At compile-time we can still extract translations, as we have to recompile the whole project anyway to perform extraction. However, now adding translated strings to PO files only causes the Gettext backend to recompile—and not all the files that use macros from it. You can verify this in a new Phoenix app generated with `phx_new` from `main` (I also added `gettext/1` calls to the same controllers and views as the previous example):

```bash
$ mix xref graph --sink lib/my_app_web/gettext.ex --label compile
# Prints nothing here
```

Fantastique.

## Conclusion

When working on libraries that do compile-time work and use macros, or do other weird stuff, think about this stuff. We didn't, and it took us a while to figure it out. If you want to do some spelunking through the changes, here's a list of stuff to look at:

  * The [original Gettext issue](https://github.com/elixir-gettext/gettext/issues/330).
  * [This Gettext PR](https://github.com/elixir-gettext/gettext/pull/390) and [this other Gettext PR](https://github.com/elixir-gettext/gettext/pull/391).
  * The [PR](https://github.com/phoenixframework/phoenix/pull/5902) that updates Phoenix generators to use the new Gettext API.

Lesson learned!

[gettext]: https://github.com/elixir-gettext/gettext
[José]: https://github.com/josevalim
[Phoenix]: https://www.phoenixframework.org/
[mix-xref]: https://hexdocs.pm/mix/Mix.Tasks.Xref.html
[Jonatan]: https://github.com/maennchen
[jonatan-api-comment]: https://github.com/elixir-gettext/gettext/issues/330#issuecomment-2293187581
[hexdocs-gettext-backend]: https://hexdocs.pm/gettext/0.26.1/Gettext.Backend.html
[hexdocs-gettext-macros]: https://hexdocs.pm/gettext/0.26.1/Gettext.Macros.html#dgettext_noop/2
[hexdocs-kernel-apply]: https://hexdocs.pm/elixir/Kernel.html#apply/3
[hexdocs-dependency-types]: https://hexdocs.pm/mix/Mix.Tasks.Xref.html#module-dependency-types

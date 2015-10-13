---
layout: post
title: Compile-time work with Elixir macros
tags:
  - elixir
---

Macros are a very common way to do metaprogramming in Elixir. There are many
resources that explain what macros are and how to use them (much better than I
could): there's the [Macro chapter][macro-chapter-elixir-website] from the
"Getting Started" guide on Elixir's website, an awesome
[series of articles][understanding-macros-sasa-juric] by Saša Jurić, and even a
book ([Metaprogramming Elixir][metaprogramming-elixir]) by Chris McCord. In this
article, I'll assume you are familiar with macros and how they work and I'll
talk about another use case of macros that is rarely examined: doing
compile-time things in macros.

## Macro expansion

Macros are often used as tools to manipulate the AST (Abstract Syntax Tree,
the representation of Elixir code) and transform it into new AST. For example, the
definition of the `if` macro looks something like this:

```elixir
defmacro if(condition, do: do_block, else: else_block) do
  quote do
    case unquote(condition) do
      x in [false, nil] -> unquote(else_block)
      _                 -> unquote(do_block)
    end
  end
end
```

`if` just *expands* to a `case` statement that checks whether the condition is
falsey (`nil` or `false`) or truthy (anything else), executing the correct block
of code.

The key concept here is **expansion**: a macro call just gets transformed to
other code. It's easy to see this process using
[`Macro.expand/2`][docs-macro-expand-2] (or
[`Macro.expand_once/2`][docs-macro-expand_once-2]). Let's work with a simple
macro so that our examples are straightforward:

```elixir
defmodule SimpleMacro do
  defmacro plus(x, y) do
    quote do: unquote(x) + unquote(y)
  end
end
```

Seeing the expansion of this macro is trivial:

```
iex> import SimpleMacro
iex> ast = quote do: plus(x, 23)
iex> ast |> Macro.expand(__ENV__) |> Macro.to_string
"x + 23"
```

Expanding a macro means executing the code inside the macro and replacing the
macro call with the AST (the quoted code) it returns. This expansion step
happens at compile time: a macro is executed at compile time and replaced with
the code it returns, which is expanded recursively (searching for nested macros)
but not executed until runtime. Turns out, we can take advantage of this! We can
write macros that do not transform the AST they receive, but that perform some
operation at compile time using this AST.

## Working at compile time

Usually, macros are described as functions that take code instead of data and
return code instead of data; in this description, we describe macros in terms of
functions. However, we can also define functions in terms of macros: each
function is just a macro that does nothing at compile time.

Say we have this code:

```elixir
defmodule MacroPhilosophy do
  def hello(name) do
    "Hello #{name}!"
  end
end
```

```
iex> hello "Elixir"
"Hello Elixir!"
```

We can turn `hello/1` into a macro without changing any of the existing code
that relies on it, except for having to `require` the `MacroPhilosophy`
module. The only thing we have to change about the definition of `hello/1` is
that we have to return the quoted code instead of executing the code: luckily
this change is trivial if we take advantage of the `:bind_quoted` option for
`quote`.

```elixir
defmodule MacroPhilosophy do
  defmacro hello(name) do
    quote bind_quoted: binding() do
      "Hello #{name}!"
    end
  end
end
```

```
iex> require MacroPhilosophy
iex> hello "Elixir"
"Hello Elixir"
```

As you can see, the actual body of the function (the string interpolation) is
the same both in the function and in the macro.

This lets us see functions from a different perspective, but also highlights
something about macros: they can be used to do work at compile time. We can
execute any code inside the macro at compile time, as long as we return valid
quoted code. Furthermore, the code we execute before returning the quoted code
will just disappear at runtime. Poof!

### A useless expression-counting macro

To stay true to the ancient tradition of making useless example with absolutely
no connection to the real world, let's build a macro that logs the number of
Elixir expressions (and sub-expressions) in some given code:

```elixir
defmodule UselessExamplesAreFun do
  defmacro log_number_of_expressions(code) do
    {_, counter} = Macro.prewalk code, 0, fn(expr, counter) ->
      {expr, counter + 1}
    end

    IO.puts "You passed me #{counter} expressions/sub-expressions"

    code
  end
end
```

Let's walk through the macro. First, we count the expressions and
sub-expressions by using [`Macro.prewalk/3`][docs-macro-prewalk-3]. Then, we
print this number: this is our compile time work. Finally, we just return the
argument code (which is already an AST). This macro effectively does nothing at
runtime: in fact, it won't leave a trace in the compiled code. This is great for
performance because, well, the compile-time logging code just disappears.

### A real-world example (there is one this time!)

I realized macros can be used to do compile-time work after José Valim proposed
to use this technique while we were building
[gettext for Elixir][gettext-for-elixir]. Gettext provides a `mix
gettext.extract` task which is used to extract translations from source files
and write them to `.po` files. Translations are just calls to gettext macros
with strings as arguments:

```elixir
# in lib/greetings.ex
import MyApp.Gettext
gettext "Hello people of Gotham!", "fr"
```

Running `mix gettext.extract` results in a `.po` file with this content:

```po
#: lib/greetings.ex:2
msgid "Hello people of Gotham!"
msgstr ""
```

What most gettext bindings for other languages (such as Python) do to extract
translations is parsing the code and looking for calls to `gettext()`
functions. In Elixir, instead, we just have to register the string to extract
inside the macro, at compile-time, and then force-recompile the project to
expand the macros and extract the translations. Awesome!

This is what the definition of `gettext` roughly looks like
(and the [actual implementation][gettext-macro-implementation]):

```elixir
defmacro gettext(msgid, locale) do
  extract(msgid)

  quote do
    translate(unquote(msgid), unquote(locale))
  end
end
```

When we call `extract/2`, we register the `msgid` by pushing it to an agent that
we started before recompiling. When the compilation is done, we just dump the
state of this agent. This has no impact whatsoever on the expanded code that is
executed at runtime: calls to `gettext/2` are just calls to `translate/2` at
runtime.

## Conclusion

Deeply understanding macros and how they work is fundamental in order to be able
to metaprogram, optimize, and understand Elixir code. In this article, we
experimented with using macros to do compile-time work. We saw a non-real-world
example and then a real-world example taken from the gettext Elixir library.


[understanding-macros-sasa-juric]: http://www.theerlangelist.com/2014/06/understanding-elixir-macros-part-1.html "Understanding Elixir Macros by Saša Jurić"
[metaprogramming-elixir]: https://pragprog.com/book/cmelixir/metaprogramming-elixir "Metaprogramming Elixir"
[macro-chapter-elixir-website]: http://elixir-lang.org/getting-started/meta/macros.html "Chapter on macros from Elixir's \"Getting Started\" guide"
[docs-macro-expand-2]: http://elixir-lang.org/docs/stable/elixir/Macro.html#expand/2 "Docs for Macro.expand/2"
[docs-macro-expand_once-2]: http://elixir-lang.org/docs/stable/elixir/Macro.html#expand_once/2 "Docs for Macro.expand_once/2"
[docs-macro-prewalk-3]: http://elixir-lang.org/docs/stable/elixir/Macro.html#prewalk/3 "Docs for Macro.prewalk/3"

[gettext-for-elixir]: https://github.com/elixir-lang/gettext "gettext for Elixir"

[gettext-macro-implementation]: https://github.com/elixir-lang/gettext/blob/v0.6.1/lib/gettext/compiler.ex#L40-L60 "Implementation of a gettext macro"

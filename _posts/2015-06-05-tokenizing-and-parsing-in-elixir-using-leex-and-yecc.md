---
layout: post
title: Tokenizing and parsing in Elixir with yecc and leex
---

Lexical analysis (tokenizing) and parsing are very important concepts in computer science and programming. There is a lot of theory behind these concepts, but I won't be talking about any of that here because, well, it's *a lot*. Also, I feel like approaching these topics in a "scientific" way makes them look a bit scary; however, using them in practice turns out to be pretty straightforward. If you want to know more about the theory, head over to Wikipedia ([lexical analysis][wiki-lexical-analysis] and [parsing][wiki-parsing]) or read the amazing [dragon book][dragon-book] (which I recommend to all programmers, it's fantastic).

Usually people tend to avoid using lexers and parsers in favor of manual string manipulation and **regular expressions**. I think this may happen because of the inherent complexity that is generally associated with these tools. In this post, we'll try to make this complexity go away!

## Why

First of all, lexers and parser are usually used together, but they don't *need* to be. You can use a lexer to tokenize some string into a flat list of tokens and you can use a parser to understand a grammar of anything.

A little side note before we begin. I said people often choose regular expressions to "parse" and understand text. While this is fine for very simple parsing tasks, most of the times it results in cryptic and fragile code. Also, regular expressions are limited in what type of grammars they can parse (try [parsing HTML with regexes][stackoverflow-html-regex]), so at times you will *need* something more powerful.

## Enter `leex` and `yecc`

Erlang provides two modules that greatly simplify the task of writing lexers and parsers: [`leex`][docs-leex] and [`yecc`][docs-yecc]. The `leex` module is a lexer *generator*: it reads a file written in a special syntax and it spits out an Erlang module (in a `.erl` file) that you can compile and use to do the actual tokenizing. `yecc` behaves in the same way, except it generates parsers instead of lexers.

Since these modules are available in the Erlang standard distribution (in the "Parse tools" application group), I think there are little to no downsides in using them whenever there's a problem they could help solving.

## The small, contrived and unrealistic example

Every post explaining something needs one of these examples, so let's make up ours: we're going to tokenize and parse Elixir lists of atoms and integers dumped as strings. The final goal will be to be able to read an Elixir list expressed as a string and convert it back to an Elixir string, like this:

```iex
iex> ListParser.parse("[1, 2, [:foo, [:bar]]]")
[1, 2, [:foo, [:bar]]]
```

That's small, contrived and unrealistic, so we should be good to go.

## The lexer

The first thing we have to do is **tokenize** the string: tokenizing just means turning a string into a list of tokens, which are just things a bit more structured than a flat list of characters.

For example, a single token could be an integer like `4917`: the *integer* `4917` has "more structure" than the list of characters `[?4, ?9, ?1, ?7]` because we can treat it as a whole.

Tokenizing our lists is straightforward: we only tokenize parentheses (left `[` and right `]`), commas, integers and atoms. We're going to tokenize only simple atoms, like `:foo` or `:foo_bar`, ignoring atoms that have to use double or single quotes, like `:'foo bar'` or `:"hello world!"`.

Rolling our own tokenizer for this basic syntax would be easy, but `leex` greatly simplifies the job by letting us write a lexer with a very straightforward syntax. Basically, you identify tokens with regular expressions and you associate an Erlang expression to each regular expression in order to create a token. I mentioned that regular expressions aren't cut for this job before: well, they're not a great tool for parsing because of the recursive nature of the task, but they're great for splitting things in a flat structure.

The syntax of a `leex` **rule** is this:

```
Regular expression : Erlang code.
```

In the "Erlang code", we have to return a `{:token, value}` tuple if we want the lexer to return that token to us (actually, a `{token, Value}` tuple since we have to use Erlang syntax, not Elixir).

Our lexer is simple:

```
Rules.

[0-9]+   : {token, {int,  TokenLine, TokenChars}}.
:[a-z_]+ : {token, {atom, TokenLine, TokenChars}}.
\[       : {token, {'[',  TokenLine}}.
\]       : {token, {']',  TokenLine}}.
,        : {token, {',',  TokenLine}}.
```

We return a `{:token, value}` to tell `leex` we're interested in the matched token (that's why the first element of the tuple is `:token`) and we want to include it in the output of the lexical analysis.

`TokenLine` and `TokenChars` are variables that `leex` makes available in the Erlang expression following each regex. These variables contain the line of the matching token and the matched token's contents (as a char list).

We always use two- or three-element tuples as the value of tokens because this is the format `yecc` wants. As you can see, sometimes we're interested in the token value so we return a three-element tuple but sometimes the token itself is its value (e.g., the comma) so a two-element tuple is enough. The token line is mandatory so that `yecc` can spit out accurate error messages.

We don't have to keep all the tokens we find: we can discard them by returning the atom `:skip_token` instead of a `{:token, value}` tuple. A common use case is skipping whitespace:

```
[\s\t\n\r]+ : skip_token.
```

Regular expressions can quickly become nasty, but we can extract them into *definitions* in the form `ALIAS = REGEX`. We put definitions at the top of the file, before the list of rules. To use these definitions in the regexes, we have to surround them with curly braces.

```
Definitions.

INT        = [0-9]+
ATOM       = :[a-z_]+
WHITESPACE = [\s\t\n\r]

Rules.

{INT}         : {token, {int,  TokenLine, TokenChars}}.
{ATOM}        : {token, {atom, TokenLine, TokenChars}}.
\[            : {token, {'[',  TokenLine}}.
\]            : {token, {']',  TokenLine}}.
,             : {token, {',',  TokenLine}}.
{WHITESPACE}+ : skip_token.
```

We're ready to try out our lexer. First, we have to write it to a file with the `.xrl` extension. Then, we can turn the `.xrl` file into a `.erl` file with `:leex.file/1`. Finally, we can compile the newly generated Erlang module. Remember that most Erlang modules accept char lists instead of binaries, so we have to surround them in single quotes instead of double quotes. (Side note: Erlang uses single quotes to express complex atoms like `'foo bar'` that can't be expressed using the `regular` syntax, but you remembered that, right?)

```iex
iex> :leex.file('list_lexer.xrl')
iex> c("list_lexer.erl")
iex> {:ok, tokens, _} = :list_lexer.string('[1, [:foo]]')
iex> tokens
{:"[", 1}, {:int, 1, '1'}, {:",", 1}, {:"[", 1}, {:atom, 1, ':foo'}, {:"]", 1}, {:"]", 1}]
```

Nice! `leex` also provides the possibility to define some Erlang code associated with the lexer: this is done in the `Erlang code.` section at the bottom of the `.xrl` file. We could take advantage of this to convert atom tokens to atoms:

```
...

{INT}  : {token, {int,  list_to_integer(TokenChars)}}.
{ATOM} : {token, {atom, to_atom(TokenChars)}}.

...

Erlang code.

to_atom([$:|Chars])
  -> list_to_atom(Chars).
```

`to_atom/1` just strips the first character of an atom token (which is a colon, `$:` in Erlang land) and converts the rest to an atom. We also used `list_to_integer/1` to convert integer tokens to integers.

```iex
iex> {:ok, tokens, _} = :list_lexer.string('[1, :foo]')
iex> tokens
[{:"[", 1}, {:int, 1, 1}, {:",", 1}, {:atom, 1, :foo}, {:"]", 1}]
```


## The parser

We now have a flat list of tokens. We want to give structure to those tokens and turn them into Elixir lists: we need to **parse** the list of tokens. A parser works based on a **grammar**, which is a set of rules that describe how tokens should be structured.

While we could hand-roll our own parser as well (which is a bit harder than rolling out our own lexer), it's easy to use `yecc`: it lets you write very *declarative* grammars and it's as easy to use as `leex`.

Small side note: at this point, you might think these names make no sense. They do (more or less). They're both inspired by two very famous pieces of software: the [`lex`][wiki-lex] lexer generator and the [`yacc`][wiki-yacc] parser generator. Turns out these Erlang people aren't just crazy, uh?

Back to us. The central unit of `yecc`'s syntax is a **rule**, which has the form:

```
Left-hand side -> Right-hand side : Erlang expressions.
```

The left-hand side is a **category** of tokens, while the right-hand side is a category or list of categories of tokens. Categories of tokens can be of two types: *terminal* and *non-terminal*. Terminals are just tokens that do not expand to other categories; non-terminals are categories that recursively expand to other categories.

For example, the `:"["` or `{atom, Atom}` tokens are terminals. A list could be represented by the `list` non-terminal:

```
list -> '[' ']'.
% or...
list -> '[' elems ']'.

% By the way, '%' is used for comments just like in Erlang.
```

As you can see, we can define multiple "clauses" for each category: the category can assume any value from these clauses (think of them like an "or").

`elems` is a non-terminal itself. We can define it as a single element or an element, a comma and a list of elements:

```
elems -> elem.
elems -> elem ',' elems.
```

The `elems` category could be `elem`, `elem, elem`, and so on.

`elem` is a non-terminal itself: it represents an integer, an atom, or a list. Note how elegantly we can represent the fact that an element of a list can be itself a list:

```
elem -> int.
elem -> atom.
elem -> list.
```

Beautiful!

All non-terminals must at some point expand to terminals: you can't have a non-terminal that doesn't expand to anything. `yecc` also requires you to specify which categories are terminals and which ones are non-terminals at the top of the file:

```
Terminals '[' ']' ',' int atom.
Nonterminals list elems elem.
```

You also have to specify a **root symbol**, that is, the starting non-terminal that generates the entire grammar. In our case, that's `list`:

```
Rootsymbol list.
```

We're almost finished! We only need to convert the parsed lists to Elixir lists. We can do this in the Erlang code associated with each parsing rule. In these Erlang expressions, we have some special atoms available: `'$1'`, `'$2'`, `'$3'` and so on. `yecc` replaces them with the value returned by the Erlang code associated with the category at the same index on the right-hand side of the rule. I just heard you thought "*what?!*"; you're right, this is way easier to understand in practice:

```
list ->
  '[' ']' : []. % an empty list translate to, well, an empty list
list ->
  '[' elems ']' : '$2'. % the list is formed by its elements

elems ->
  elem : ['$1']. % single-element list (and base case for the recursion)
elems ->
  elem ',' elems : ['$1'|'$2']. % '$2' will be replaced recursively

elem -> int : extract_token('$1').
elem -> atom    : extract_token('$2').
elem -> list    : '$1'.

% Yep, we can use Erlang code here as well.
Erlang code.

extract_token({_Token, _Line, Value}) -> Value.
```

We're done! We can now create an Erlang file from the `yecc` file (which has a `.yrl` extension) just like we did with `leex`:

```iex
iex> :yecc.file('list_parser.yrl')
iex> c("list_parser.erl")
iex> :list_parser.parse([{:"[", 1}, {:atom, 1, :foo}, {:"]", 1}])
{:ok, [:foo]}
```

It works!

## Putting it together

We can feed the output of the lexer directly into the parser now:

```iex
iex> source = "[:foo, [1], [:bar, [2, 3]]]"
iex> {:ok, tokens, _} = source |> String.to_char_list |> :list_lexer.string
iex> :list_parser.parse(tokens)
{:ok, [:foo, [1], [:bar, [2, 3]]]}
```

Awesome!

## Elixir integration

Manually generating Erlang files from `.xrl` and `.yrl` files and then compiling those Erlang files can become tedious very quickly. Luckily, Mix can do that for you!

Mix has the concept of "compilers": they're just what you think they are, compilers. Mix provides a compiler for Erlang (which just compiles `.erl` files through the Erlang installation), one for Elixir, but also a `:leex` compiler and `:yecc` compiler. They are actually enabled by default, as you can see by inspecting the return value of [`Mix.compilers/0`][docs-mix-compilers/0] inside a Mix project:

```iex
iex> Mix.compilers()
[:yecc, :leex, :erlang, :elixir, :app]
```

The only thing you have to do to make all of this work effortlessly inside a Mix project is put your `.xrl` and `.yrl` files in the `src/` directory of the project and you'll have the compiled Erlang modules available when the project is compiled.

```bash
mix new list_parser
mkdir list_parser/src
mv ./list_parser.yrl ./list_lexer.xrl ./list_parser/src/
```

Now, inside `list_parser/lib/list_parser.ex`:

```elixir
defmodule ListParser do
  @spec parse(binary) :: list
  def parse(str) do
    {:ok, tokens, _} = str |> to_char_list |> :list_lexer.string
    {:ok, list}      = :list_parser.parse(tokens)
    list
  end
end
```

## I'm not convinced yet

All of this may sound very abstract, but I assure you that `leex` and `yecc` have tons of practical uses. For example, I recently had to write a parser for [PO files][po-files] in the context of writing an Elixir binding to [GNU gettext][gnu-gettext]. Well, I used `yecc` to write a parser: this resulted in a very declarative, clean and easy-to-understand grammar (you can see it [here][gettext-for-elixir-parser-code]) and I'm super-happy with it. We didn't use `leex` in Gettext but decided to roll our own lexer, but only because the tokenization was very simple and `leex` may have been slight overkill.

Want another real-world™ example? Wait, I think I have one: ever heard of the Elixir programming language? It's a nice language built atop the Erlang virtual matching, focused on concurrency, fault to... Well, it's [parsed by `yecc`][elixir-parser-code] :).

## Recap

We built a lexer and a parser for transforming strings representing Elixir lists to actual Elixir lists. We used the `leex` Erlang module to generate the lexer and the `yecc` module to generate the parser.

We only covered the basics of these two tools: they can do more complicated things (`yecc` generates LALR parsers if you know what that means) but for that, as usual, there's their [documentation][docs-parsetools].

---

I'm realizing just now that this post, even if it's my first post about Elixir, contains barely any Elixir. Let's just see this as an opportunity to sing the praises of how easy it is to use Erlang from Elixir, shall we?


[wiki-lexical-analysis]: http://en.wikipedia.org/wiki/Lexical_analysis
[wiki-parsing]: http://en.wikipedia.org/wiki/Parsing
[wiki-lex]: http://en.wikipedia.org/wiki/Lex_(software)
[wiki-yacc]: http://en.wikipedia.org/wiki/Yacc
[docs-leex]: http://erlang.org/doc/man/leex.html
[docs-yecc]: http://erlang.org/doc/man/yecc.html
[docs-parsetools]: http://www.erlang.org/doc/apps/parsetools/
[docs-mix-compilers/0]: http://elixir-lang.org/docs/master/mix/Mix.html#compilers/0
[dragon-book]: http://en.wikipedia.org/wiki/Compilers:_Principles,_Techniques,_and_Tools
[stackoverflow-html-regex]: http://stackoverflow.com/questions/1732348/regex-match-open-tags-except-xhtml-self-contained-tags
[po-files]: https://www.gnu.org/software/gettext/manual/html_node/PO-Files.html
[gnu-gettext]: https://www.gnu.org/software/gettext/
[gettext-for-elixir-parser-code]: https://github.com/elixir-lang/gettext/blob/e2e3d42edd2a8fa5aa2deada2e5779f122594e71/src/gettext_po_parser.yrl
[elixir-parser-code]: https://github.com/elixir-lang/elixir/blob/master/lib/elixir/src/elixir_parser.yrl

---
title: Advent of Code 2022
description: |
  An experiment in solving AoC 2022 with Rust and some AI (GitHub Copilot and
  OpenAI's ChatGPT).
updated: 2022-12-05
extra:
  cover_image: cover-image.png
---

I'm doing [Advent of Code] 2022 in [Rust] as a chance to get more familiar with the language. In this ongoing post, I'm documenting each day's progress, my thought process, and so on. I'm better at writing than recording screencasts or what have you. This is essentially a small journal. Ah, and I'm trying **AI tools** for doing this as well, so this is bound to be fun.

<!-- more -->

![Cover image of a futuristic-looking Christmas tree](cover-image.png)

I don't really know Rust, but it's a fascinating language for me. I mostly write [Elixir]. Even when it comes to other languages, I'm used to and fond of functional programming, immutable data everywhere, and things like those. Rust is quite different. I'm not used to working with **static types**, **mutability**, or **low-level memory access**. This is a good excuse to learn a bit more about the language, given its recent rise to fame.

The thing is this: it's hard to search specific stuff on the web when learning a new programming language, especially *at the beginning*. I'm clueless, so I go about it by searching for stuff like "how to read a file and split it into lines in Rust?". It takes a lot of Stack Overflow questions, small snippets of code lying around in blog posts, and documentation. However, 2022 is the **year of AI**, isn't it? I have not been too deep into the AI scene. I've used [DALL·E 2][dall-e-2] a bit, but not much else. Never tried writing software with the help of [GitHub Copilot][copilot], for example. And at the time of writing this, a lot of what I read on the Internet is about the recent release of [ChatGPT][chatgpt]. There's no time like the present, right? I figured these tools might be a nice help when learning a new language.

Anyway, enough prefacing. I'll post each day, and I'll probably break that promise. Most recent day on top.

Also, a disclaimer: this is not a polished post. I went with the approach that publishing something is better than publishing nothing, so I'm going for it. I'd absolutely love to know if this was interesting for you, so reach out on Twitter/Mastodon (links in footer) if you have feedback.

## Day 3

The "translated-to-computerese" puzzle is this:

  1. Split each input line in half to get the items in the two compartments.
  1. For each line, find the char that appears in both halves.
  1. Associate a score with that char.
  1. Sum the score for all lines.

When I hear "appears in both halves", the first thing I think is sets. Rust seems to have a pretty straightforward set implementation in the standard library, [`std::collections::hash_set::HashSet`][rust-docs-hashset].

I'm taking the same approach as day 2 with the `total` accumulator and the `for` loop. For each line, I split it in half, turn each half into a set, find the intersection of the two sets, and calculate the score associated with that character.

```rust
pub fn run() {
    let lines = fs::read_to_string("inputs/day3.txt")
        .expect("Failed to read file")
        .lines();

    let mut total: i32 = 0;

    for line in lines {
        let (left, right) = line.split_at(line.len() / 2);

        let left_items: HashSet<char> = HashSet::from_iter(left.chars());
        let right_items: HashSet<char> = HashSet::from_iter(right.chars());

        // Here, I'm not bothering with checking whether the intersection has
        // zero or >1 characters. It'll panice with index out of bounds or
        // something like that, and that's okay.
        let common: &char = left_items
            .intersection(&right_items)
            .collect::<Vec<&char>>()[0];

        total = total + priority(*common);
    }

    println!("{:?}", total);
}
```

`priority` is a small helper function that uses ASCII trickery to assign scores to `a..z` and `A..Z`. There's probably a better Rust way to do that, but I'm going for what I know.

```rust
fn priority(c: char) -> i32 {
    let ascii_value = c as i32;

    if c.is_lowercase() {
        ascii_value - ('a' as i32) + 1
    } else {
        ascii_value - ('A' as i32) + 27
    }
}
```

### Second Part

Okay, the second part boils down to:

  1. Get chunks of three lines each from the input
  1. Split each line into characters like before
  1. Find the character in common among the three lines
  1. Calculate its score and sum all the scores

The main struggle I found here was, wait for it, doing the intersection of three sets. I'm not good with references and pointers and whatnot. What I ended up doing is looking like the worst Rust code I've ever seen!

The first step I did was to get the lines in the file and chunk them up into 3-line chunks.

```rust
let contents = fs::read_to_string("inputs/day3.txt").expect("Could not read file");
let lines = contents.lines().collect::<Vec<&str>>();
let chunks = lines.chunks(3).collect::<Vec<&[&str]>>();
```

I kind of let rust-analyzer figure out the types here. It's not the clearest thing to me. Then, for the main `for` loop:

```rust
let mut total: i32 = 0;

for chunk in chunks {
    // Destructuring is always a good feature.
    let (line1, line2, line3) = (chunk[0], chunk[1], chunk[2]);

    let set1: HashSet<char> = HashSet::from_iter(line1.chars());
    let set2: HashSet<char> = HashSet::from_iter(line2.chars());
    let set3: HashSet<char> = HashSet::from_iter(line3.chars());

    // This was weird to figure out. The .map() calls to dereference &char
    // pointers is very weird, but it works.
    let common: char = set1
        .intersection(&set2)
        .map(|c| *c)
        .collect::<HashSet<char>>()
        .intersection(&set3)
        .map(|c| *c)
        .collect::<Vec<char>>()[0];

    total = total + priority(common);
}
```

Rust people: how do I make this right?

## Day 2

Okay, I'm already over doing stuff in `src/main.rs`. I create `src/day2.rs`.

The gist of the puzzle:

  1. Parse each input line into a `(opponent_choice, my_choice)` tuple.
  1. Calculate the score of `my_choice` based on the rules.
  1. Calculate the score of the game (win, loss, draw).

I start with making an enum for the possible choices. Overkill? Maybe, but I'm not used to static types, so I like doing stuff like this.

```rust
enum Choice {
    Rock,
    Paper,
    Scissors,
}
```

Awesome. Now, I kind of translate the algorithm above. In the spirit of trying new things, I go for a `for` loop instead of the functional `map + sum` approach that I'd naturally go for.

```rust
pub fn run() {
    let lines = fs::read_to_string("inputs/day2.txt")
        .expect("Failed to read file")
        .lines();


    // Declare a mutable variable to keep the total. Feels vintage.
    let mut total = 0;

    for line in lines {
        let split: Vec<&str> = line.split_whitespace().collect();

        let opponent_choice = match split[0] {
            "A" => Choice::Rock,
            "B" => Choice::Paper,
            "C" => Choice::Scissors,
            _ => panic!("Invalid choice"),
        };

        let my_choice = match split[1] {
            "X" => Choice::Rock,
            "Y" => Choice::Paper,
            "Z" => Choice::Scissors,
            _ => panic!("Invalid choice"),
        };

        total =
            total + calculate_choice_value(my_choice) + calculate_score(opponent_choice, my_choice);
    }

    println!("{:?}", total);
}
```

Now, I just need to implement the two helper functions. I love pattern matching.

```rust
fn calculate_choice_value(choice: Choice) -> i32 {
    match choice {
        Choice::Rock => 1,
        Choice::Paper => 2,
        Choice::Scissors => 3,
    }
}

fn calculate_score(opponent_choice: Choice, my_choice: Choice) -> i32 {
    match (opponent_choice, my_choice) {
        (Choice::Rock, Choice::Rock)
        | (Choice::Paper, Choice::Paper)
        | (Choice::Scissors, Choice::Scissors) => 3,

        (Choice::Paper, Choice::Rock) => 0,
        (Choice::Scissors, Choice::Rock) => 6,

        (Choice::Rock, Choice::Paper) => 6,
        (Choice::Scissors, Choice::Paper) => 0,

        (Choice::Rock, Choice::Scissors) => 0,
        (Choice::Paper, Choice::Scissors) => 6,
    }
}
```

### Second Part

The second part here is about turning the second letter in each line into a "round end", that is, a win, loss, or draw. That sounds like an enum to me.

```rust
enum RoundEnd {
    Win,
    Lose,
    Draw,
}
```

Now we can parse the round end into a `RoundEnd` enum with a `match` expression as before, and then calculate which choice we should make in order to finish the round as instructed. That function looks like this:

```rust
fn choose_based_on_end(opponent_choice: Choice, round_end: RoundEnd) -> Choice {
    match (opponent_choice, round_end) {
        (choice, RoundEnd::Draw) => choice,

        (Choice::Paper, RoundEnd::Win) => Choice::Scissors,
        (Choice::Paper, RoundEnd::Lose) => Choice::Rock,

        (Choice::Rock, RoundEnd::Win) => Choice::Paper,
        (Choice::Rock, RoundEnd::Lose) => Choice::Scissors,

        (Choice::Scissors, RoundEnd::Win) => Choice::Rock,
        (Choice::Scissors, RoundEnd::Lose) => Choice::Paper,
    }
}
```

Calculating the total is a matter of parsing the round end, feeding it into this function, and adding up to `total`.

## Day 1

This is set-up day. I'm not completely clueless about Rust, so I have [Cargo] installed and I'm capable of creating a project. I created a new `aoc22` crate. I shove puzzle inputs in there with something like:

```shell
mkdir inputs
pbpaste > inputs/day1.txt
```

I did the whole first day in `src/main.rs`. Too early for refactoring!

The gist of the puzzle is to:

  1. Split a file into "chunks of lines" separated by an empty line.
  1. Parse each line into an integer and calculate the sum of the lines in each cluster.
  1. Find the cluster with the highest sum.

The solution, with comments:

```rust
fn run() {
    let chunk_sums = fs::read_to_string("inputs/day1.txt")
        .expect("Failed to read file")
        .split("\n\n") // Split into chunks of lines
        .map(|chunk| {
            chunk
                .split("\n") // Split the chunk into lines
                .map(|calorie| calorie.parse::<i32>().unwrap()) // Parse integers
                .sum() // Calculate the sum for each chunk
        });

    println!("{:?}", chunk_sums.max().unwrap());
}
```

I have not used Copilot or ChatGPT yet at this point. This was fairly straightforward. Some notes:

  * I like the `.expect()` and `.unwrap()` calls. For example, I expect that reading a file would return a result type, and I like having a simple method to panic on the non-OK result. Practical for use cases like this.

  * My solution is pretty functional. I would have written something *very* similar in Elixir.

### Second Part

The second part of the puzzle boils down to finding the sum of the three highest chunks. It takes little changes to get there: I only need to sort `chunk_sums`, get the first three elements, and sum those.

```rust
let mut chunk_sums =
    // Same as before
    .collect::<Vec<i32>>();

chunk_sums.sort();
chunk_sums.reverse();
chunk_sums.truncate(3);

println!("{:?}", chunk_sums.iter().sum());
```

It feels weird to modify the data in place. Sure, it's efficient! I know this could be done *more* efficiently. I could go through `chunk_sums` and keep just three `i32`s for the top three integers, but it's a small data set plus a fast language plus toy code.

The `let mut` makes sense here. I love that I have to declare that a variable is mutable.

Surely I'm missing something, but I'm also weirded out by having to turn `chunk_sums` into an iterator in order to call `.sum()` on it. Why wouldn't `Vec` implement something like `sum()` directly?

[Advent of Code]: https://adventofcode.com
[Rust]: https://www.rust-lang.org
[Elixir]: https://elixir-lang.org
[dall-e-2]: https://openai.com/dall-e-2/
[copilot]: https://github.com/features/copilot
[chatgpt]: https://openai.com/blog/chatgpt/
[Cargo]: https://doc.rust-lang.org/book/ch01-03-hello-cargo.html
[rust-docs-hashset]: https://doc.rust-lang.org/1.65.0/std/collections/hash_set/struct.HashSet.html

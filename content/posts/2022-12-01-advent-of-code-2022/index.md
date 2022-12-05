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

## Day 5

Ah, this starts to be more convoluted. The most annoying thing with this puzzle was to parse out the "stacks", since each stack is on a variable number of input lines.

For this puzzle, I took a bottom-up approach. I started out with creating a new type for a "move", and a function to parse a `move N from X to Y` line into said struct.

```rust
// Deriving PartialEq because I want to be able to check if move1 == move2.
#[derive(Debug, PartialEq)]
struct Move {
    start_stack: u16,
    end_stack: u16,
    crates_to_move: u16,
}

fn parse_move(string: &str) -> Move {
    let words: Vec<&str> = string.split_ascii_whitespace().collect();

    // Hard-code a bunch of indexes since the words are always the same.
    // I miss Elixir pattern matching!
    let crates_to_move = words[1].parse::<u16>().unwrap();
    let start_stack = words[3].parse::<u16>().unwrap();
    let end_stack = words[5].parse::<u16>().unwrap();

    Move { start_stack, end_stack, crates_to_move, }
}
```

I'm starting to get the hang of references. I understand that the input to this function needs to be a `&str` because I want just a little window to that string, and I'm not modifying it in any way. We're good.

Next is a little function to find the line that goes ` 1  2  3 ...` to get to the *count* of stacks in the input. In hindsight, this is probably unnecessary as I could've hardcoded that to `9`, but here you go if you're curious.

<details>
  {{ summary_tag(text="`fn count_stacks(input: &str) -> u16`") }}

```rust
fn count_stacks(input: &str) -> u16 {
    let indexes_line = input
        .lines()
        .find(|line| line.trim().starts_with("1"))
        .unwrap();

    indexes_line
        .split_ascii_whitespace()
        .count()
        .try_into()
        .unwrap()
}
```
</details>

Last but not least, a way to parse stacks. I created a new `Stack` struct first:

```rust
#[derive(Debug)]
struct Stack {
    // Crates are ordered from bottm to top (that is, the top crate is the last crate in the vector)
    crates: Vec<char>,
}
```

Then, I went with the most imperative approach I could think of. In a functional language, I'd have probably tried to matrices-and-transpositions my way out of this, but here I went with just slicing strings. I created a `parse_stack()` function that takes the whole `input: &str` as well as a "column index". Here you go:

```rust
fn parse_stack(input: &str, column_index: usize) -> Stack {
    let mut crates: Vec<char> = Vec::new();

    // Iterate through all lines until there's an empty one.
    for line in input.lines().take_while(|line| !line.trim().is_empty()) {
        // I don't like this, but it allows me to get the right [x] crate
        // from the input line.
        let range = (column_index * 4)..(column_index * 4 + 2);
        let cleaned_line = line[range].trim();

        if cleaned_line.starts_with("[") {
            let char = cleaned_line
                .trim_start_matches("[")
                .trim_end_matches("]")
                .chars()
                .next()
                .unwrap();

            crates.push(char);
        }
    }

    crates.reverse();
    Stack { crates }
}
```

Now, the final push: getting it all together. First, I built the "world", which is just a vector of `Stack`s:

```rust
let input = include_str!("../inputs/day5.txt");
let mut world: Vec<Stack> = Vec::new();

for column_index in 0..count_stacks(input) {
    let stack = parse_stack(input, column_index as usize);
    world.push(stack);
}

// A couple of tests can't hurt.
assert_eq!(world.len(), 9);
assert_eq!(world[0].crates, vec!['W', 'D', 'G', 'B', 'H', 'R', 'V']);
```

Now, I parsed all the `Move` structs:

```rust
let moves: Vec<Move> = input
    .lines()
    .filter(|line| line.starts_with("move"))
    .map(parse_move)
    .collect();

// Spot check the first move.
assert_eq!(
    moves[0],
    Move { start_stack: 2, end_stack: 7, crates_to_move: 2 }
);
```

Finally, I iterated through `moves` and applied each move:

```rust
for move_ in moves {
    move_crates(&mut world, move_);
}

// This is to get the puzzle output in the desired format.
let top_chars_iter = world.iter().map(|stack| stack.crates.last().unwrap());
println!("{}", String::from_iter(top_chars_iter));
```

The `move_crates` function was fun to write because it was the first time
I used `&mut`. I had to pass `&mut world` to the function in order to be able
to modify the stacks in place in the function.

```rust
fn move_crates(world: &mut Vec<Stack>, move_: Move) {
    for _ in 0..move_.crates_to_move {
        let start_stack = &mut world[(move_.start_stack - 1) as usize];
        let crate_to_move = start_stack.crates.pop().unwrap();
        let end_stack = &mut world[(move_.end_stack - 1) as usize];
        end_stack.crates.push(crate_to_move);
    }
}
```

The most interesting thing about the code above? I tried to `let` both `start_stack` and `end_stack` after each other, but the compiler yelled at me after I successively tried to modify `start_stack`. This was pretty cool, and it makes sense: I can have *one* mutable reference to a piece of `world` at a time. If I get one by doing `&mut world[...]`, then I need to use it first, and only then I can get more references. Neat, and I'm quite happy that I have some idea of what's going on.

### Second Part

The second part didn't take too long. It's essentially about swapping the `pop()` + `push()` calls with a `pop_many`-sort-of-thing that keeps the order of the popped crates. I let Copilot guide me in writing this:

```rust
fn pop_many<T>(vec: &mut Vec<T>, count: u16) -> Vec<T> {
    let mut popped = Vec::new();
    for _ in 0..count {
        popped.insert(0, vec.pop().unwrap());
    }
    popped
}
```

Wrote my first function with a parametrized type! How cool. Now, I rewrote `move_crates()` from earlier into `move_craates_9001()` (after the model number of the new crane):

```rust
fn move_crates_9001(world: &mut Vec<Stack>, move_: Move) {
    let start_stack = &mut world[(move_.start_stack - 1) as usize];
    let to_move = pop_many(&mut start_stack.crates, move_.crates_to_move);
    let end_stack = &mut world[(move_.end_stack - 1) as usize];

    // Didn't know about extend(), but Copilot got my back.
    end_stack.crates.extend(to_move);
}
```

Another successful puzzle solution!

## Day 4

  1. Split each line into two ranges, `left` and `right`, by splitting at the comma `,`.
  1. Convert each text range (`<start>-<end>`) into a range data structure (Rust should have one).
  1. Count the occurrences of range pairs where `left` is included in `right` or `right` in `left`.

The first nice thing I found out today is the `include_str!` macro. It's exactly what I want: it reads a file at compile time and includes its contents into the compiled binary as a static string.

```rust
let input = include_str!("../inputs/day4.txt");
```

Ready to go. First, I split up each line into two (text) ranges. I found the `.split_once()` method for strings, which does exactly what I want. I like that it returns a `Option` type.

```rust
for line in input.lines() {
    let (left, right) = line.split_once(",").unwrap();
}
```

Next, I wanted to write a small helper function that parses a textual range into a [`std::ops::Range`](https://doc.rust-lang.org/1.65.0/std/ops/struct.Range.html) struct. Hello, **Copilot**! Wow. I wrote the signature (`fn parse_into_range(input: &str) -> Range<u32> {}`), and Copilot did its magic:

```rust
fn parse_into_range(input: &str) -> Range<u32> {
    let (left, right) = input.split_once("-").unwrap();
    let left_range = left.parse::<u32>().unwrap();
    let right_range = right.parse::<u32>().unwrap();
    left_range..right_range
}
```

I think I can do better at naming variable, but other than that, Copilot beats me easily. I understand Rust ranges are `[...)`, so we should do `right_range + 1` there to behave like the puzzle description wants us to. But I'm really only using Rust ranges here to play around, because we'd probably be better off with a `(u32, u32)` tuple anyway.

Now I want a function that checks whether a `Range<u32>` is contained in another range. Once again, Copilot sketches it out great:

```rust
fn is_contained(left: Range<u32>, right: Range<u32>) -> bool {
    left.start <= right.start && right.end <= left.end
}
```

Ah, AI, you. I can't read that because of the order in which the boolean expression is written, but it does check if `right` is contained in `left`. Amazing.

All that's left now is to count occurrences. Once again, let's go imperative mutable style.

```rust
let mut count: u32 = 0;

for line in input.lines() {
    // Same as before.

    if is_contained(&left_range, &right_range) ||
        is_contained(&right_range, &left_ranage) {
        count += 1;
    }
}
```

Here, I changed `is_contained()` to take `&Range<u32>` values instead of `Range<u32>`. I'm not sure if it was the right thing to do, but the checker was complaining about moving values. It makes sense that here I only want to pass references to the same piece of data around, and I'm not modifying anything, so let's go for this.

### Second Part

Okay, easy peasy. The change is that the puzzle is now about finding **overlapping** ranges, not just **included** ranges.

I started with a `is_overlapping()` function, and it turns out the boolean check I wrote was buggy. I submitted the puzzle solution and, for the first time this year, I got yelled at! Guess it's time for some testing, isn't it. I don't know much about Rust testing, but I saw `assert_eq!()` used everywhere, so I figured it'd be easy to test `is_overlapping()` before doing anything in the main function.

What I got is something like this:

```rust
// Returns true if left and right overlap.
fn is_overlapping(left: &Range<u32>, right: &Range<u32>) -> bool {
    let (min, max) = if left.start < right.start {
        (left, right)
    } else {
        (right, left)
    };

    min.end >= max.start
}
```

The assertions look something like this:

```rust
pub fn run2() {
    assert_eq!(is_overlapping(&(1..3), &(2..4)), true);
    assert_eq!(is_overlapping(&(1..3), &(3..4)), true);
    assert_eq!(is_overlapping(&(3..4), &(1..3)), true);
    assert_eq!(is_overlapping(&(1..3), &(4..6)), false);
    assert_eq!(is_overlapping(&(4..6), &(1..3)), false);
```

Works now.

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

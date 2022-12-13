---
title: Advent of Code 2022
description: |
  An experiment in solving AoC 2022 with Rust and some AI (GitHub Copilot and
  OpenAI's ChatGPT).
updated: 2022-12-13
extra:
  cover_image: cover-image.png
---

I'm doing [Advent of Code] 2022 in [Rust] as a chance to get more familiar with the language. In this ongoing post, I'm documenting each day's progress, my thought process, and so on. I'm better at writing than recording screencasts or what have you. This is essentially a small journal. Ah, and I'm trying **AI tools** for doing this as well, so this is bound to be fun.

<!-- more -->

![Cover image of a futuristic-looking Christmas tree](cover-image.png)

I don't really know Rust, but it's a fascinating language for me. I mostly write [Elixir]. Even when it comes to other languages, I'm used to and fond of functional programming, immutable data everywhere, and things like those. Rust is quite different. I'm not used to working with **static types**, **mutability**, or **low-level memory access**. This is a good excuse to learn a bit more about the language, given its recent rise to fame.

The thing is this: it's hard to search specific stuff on the web when learning a new programming language, especially *at the beginning*. I'm clueless, so I go about it by searching for stuff like "how to read a file and split it into lines in Rust?". It takes a lot of Stack Overflow questions, small snippets of code lying around in blog posts, and documentation. However, 2022 is the **year of AI**, isn't it? I have not been too deep into the AI scene. I've used [DALL·E 2][dall-e-2] a bit, but not much else. Never tried writing software with the help of [GitHub Copilot][copilot], for example. And at the time of writing this, a lot of what I read on the Internet is about the recent release of [ChatGPT][chatgpt]. There's no time like the present, right? I figured these tools might be a nice help when learning a new language.

Anyway, enough prefacing. I'll post each day, and I'll probably break that promise. Most recent day on top. All complete solutions are [on GitHub][repo].

Also, a disclaimer: this is not a polished post. I went with the approach that publishing something is better than publishing nothing, so I'm going for it. I'd absolutely love to know if this was interesting for you, so reach out on Twitter/Mastodon (links in footer) if you have feedback.

## Day 13

Today's problem could be solved with different data structures. The important property was the ability to arbitrarily nest lists of integers. I used a well-known data structure for us functional programmers: linked lists. Thanks to day 7, I now know a bit more about Rust's smart pointers, so I was able to use `Box`es here. I started with the main data structure. A linked list is made of a **cons cell** that holds a value, plus a link to the next cons cell. In this case, since we can have nested lists, a cons cell can be:

  * an integer (I went with `u16`)
  * a linked list (think of the first nested list in `[[1], 2, 3]`)
  * the *empty* cell, which signals the end of the linked list

There are several ways to model this. You can use `Option` to model the empty cell as `None`, for example. I went with an approach I liked.

```rust
// The value contained in a cons cell.
#[derive(Debug, PartialEq, Eq, Clone)]
enum Value {
    Int(u16),
    List(Box<LinkedList>),
}

// This is essentially a cons cell itself.
#[derive(Debug, PartialEq, Eq, Clone)]
enum LinkedList {
    Empty,
    Cons(Value, Box<LinkedList>),
}
```

After this, the problem was really about two things:

  1. Parsing a line of input into a linked list.
  1. Making linked lists **orderable** in order to compare them.

To parse lines into `LinkedList` structs, I went with a simple function in the `LinkedList` implementation:

```rust
impl LinkedList {
    pub fn from_string(string: &str) -> LinkedList {
        let mut chars = string.chars().skip(1);
        Self::from_chars(&mut chars)
    }

    fn from_chars(chars: &mut impl Iterator<Item = char>) -> LinkedList {
        loop {
            match chars.next().unwrap() {
                '[' => {
                    return LinkedList::Cons(
                        Value::List(Box::new(Self::from_chars(chars))),
                        Box::new(Self::from_chars(chars)),
                    );
                }
                ']' => {
                    if char_digits.is_empty() {
                        return LinkedList::Empty;
                    } else {
                        let int = char_digits.parse::<u16>().unwrap();
                        return LinkedList::Cons(Value::Int(int), Box::new(LinkedList::Empty));
                    }
                }
                ',' => {
                    if !char_digits.is_empty() {
                        let int = char_digits.parse::<u16>().unwrap();
                        return LinkedList::Cons(
                            Value::Int(int),
                            Box::new(Self::from_chars(chars)),
                        );
                    } else {
                        continue;
                    }
                }
                char => {
                    char_digits.push(char);
                }
            }
        }
    }
}
```

Then, I took the chance to learn a bit more about Rust's trait, and in particular [`std::cmp::Ord`](https://doc.rust-lang.org/1.65.0/std/cmp/trait.Ord.html). Pretty straightforward stuff: you implement a `cmp` function that returns a `Ordering` enum (equal, less than, greater than).

```rust
impl Ord for LinkedList {
    fn cmp(&self, other: &Self) -> Ordering { /* ... */ }
}

// This required me to implement PartialOrd as well, which I did
// by just proxying to Ord. That's exactly what the docs for Ord
// show, after all.
impl PartialOrd for LinkedList {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}
```

The implementation of `cmp` is tedious to look at, so I'm including it in the collapsed code block below. It essentially implements the rules described by the puzzle description.

<details>

{{ summary_tag(text="`fn cmp(&self, other: &Self) -> Ordering`") }}

```rust
fn cmp(&self, other: &Self) -> Ordering {
    match (self, other) {
        (LinkedList::Empty, LinkedList::Empty) => Ordering::Equal,

        // If the left list runs out of items first, the inputs are in the right order.
        (LinkedList::Empty, _) => Ordering::Less,

        // If the right list runs out of items first, the inputs are in the wrong order.
        (_, LinkedList::Empty) => Ordering::Greater,

        (LinkedList::Cons(value, tail), LinkedList::Cons(other_value, other_tail)) => {
            // If both values are integers, the lower integer should come first.
            match (value, other_value) {
                (Value::Int(int), Value::Int(other_int)) => match int.cmp(other_int) {
                    Ordering::Equal => tail.cmp(other_tail),
                    ordering => ordering,
                },

                // If exactly one value is an integer, convert the integer to a list which
                // contains that integer as its only value, then retry the comparison.
                (Value::Int(int), Value::List(list)) => {
                    let wrapped_int =
                        LinkedList::Cons(Value::Int(*int), Box::new(LinkedList::Empty));

                    match wrapped_int.cmp(list) {
                        Ordering::Equal => tail.cmp(other_tail),
                        ordering => ordering,
                    }
                }

                // If exactly one value is an integer, convert the integer to a list which
                // contains that integer as its only value, then retry the comparison.
                (Value::List(list), Value::Int(int)) => {
                    let wrapped_int =
                        LinkedList::Cons(Value::Int(*int), Box::new(LinkedList::Empty));

                    match list.cmp(&Box::new(wrapped_int)) {
                        Ordering::Equal => tail.cmp(other_tail),
                        ordering => ordering,
                    }
                }

                (Value::List(list), Value::List(other_list)) => match list.cmp(other_list) {
                    Ordering::Equal => tail.cmp(other_tail),
                    ordering => ordering,
                },
            }
        }
    }
}
```

</details>

Now it was just a matter of counting the pairs where `left < right`, which we can do thanks to `PartialOrd`.

### Second Part

Today's second part was quite easy to build on top of part one. This is especially true in Rust, where `PartialOrd` allowed me to build a `Vec<LinkedList>` and then just call `sort` on it. All the new code I needed to solve part two is what's below.

```rust
let mut packets = input
    .lines()
    .filter(|line| !line.trim().is_empty())
    .map(LinkedList::from_string)
    .collect::<Vec<LinkedList>>();

// Push the divider packets.
let divider_packet1 = LinkedList::from_string("[[2]]");
let divider_packet2 = LinkedList::from_string("[[6]]");
packets.push(divider_packet1.clone());
packets.push(divider_packet2.clone());

// Comes for free with PartialOrd.
packets.sort();

let position1 = packets.iter().position(|packet| packet == &divider_packet1).unwrap() + 1;
let position2 = packets.iter().position(|packet| packet == &divider_packet2).unwrap() + 1;

println!(
    "Position of packet 1 is {position1}, packet 2 is {position2}, key is {}",
    position1 * position2
);
```

## Day 12

No time for screencasting today, so I'm gonna type it out real quick.

Today's puzzle was about applying [**Dijkstra's shortest-path algorithm](https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm). The algorithm is somewhat straightforward, and the thing that took me some time was figuring out little things here and there to do with distance between vertices and so on.

It took me a while to get to this implementation, and I won't really go through the steps today. I'll just explain what I got to. First off, a couple of data structures, one for nodes in the graph and one fo the graph itself:

```rust
#[derive(PartialEq, Eq, Debug, Hash, Clone, Copy, PartialOrd, Ord)]
struct Node(i32, i32);

#[derive(Debug, Clone)]
struct Graph {
    nodes: HashMap<Node, char>,
}
```

Then, a few methods on `Graph`. They're all standard graph methods, and I could've probably used any graph library for Rust, but I wanted to try this out myself. The body of the methods below is not included here, but you can find it out [on GitHub](https://github.com/whatyouhide/advent_of_code_2022/blob/main/src/day12.rs).

```rust
impl Graph {
    // Parses a graph from the input string.
    pub fn from(input: &str) -> Graph

    // Gets the distance between node1 and node2. It's 1 if the nodes
    // point to a different character, otherwise it's 0.
    fn distance_between_nodes(&self, node1: Node, node2: Node) -> u16

    // Find a node in the graph. I only used this for finding the
    // start node 'S' and target node 'E'.
    fn find_node(&self, target: char) -> Option<Node>

    // Returns all the neighbors of the given node.
    fn neighbors(&self, node: Node) -> Vec<Node>
}
```

Then, just a couple more helper functions:

```rust
fn chars_are_connectable(char1: &char, char2: &char) -> bool {
    (*char2 as i32) <= (*char1 as i32) + 1
}

fn find_node_with_min_distance(distances: &DistanceMap, set: &HashSet<Node>) -> Node {
    set.iter()
        .min_by_key(|node| distances[*node])
        .unwrap()
        .clone()
}
```

After that, I really just went through the [Wikipedia pseudocode](https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm#Pseudocode) and turned it into Rust.

<details>
 {{ summary_tag(text="`fn dijkstra(graph: &mut Graph, start_node: Node, end_node: Node) -> Option<u32>`") }}

```rust
fn dijkstra(graph: &mut Graph, start_node: Node, end_node: Node) -> Option<u32> {
    let mut unvisited_set: HashSet<Node> = HashSet::new();
    let mut distances: DistanceMap = HashMap::new();
    let mut prev: HashMap<Node, Option<Node>> = HashMap::new();

    for node in graph.nodes.keys() {
        unvisited_set.insert(node.clone());
        distances.insert(node.clone(), Infinity);
        prev.insert(node.clone(), None);
    }

    distances.insert(start_node, Finite(0));

    while unvisited_set.len() > 0 {
        // Pick the position with minimum distance that is in the unvisited set.
        let u = find_node_with_min_distance(&distances, &unvisited_set);

        if u == end_node {
            break;
        }

        unvisited_set.remove(&u);

        for v in graph
            .neighbors(u)
            .iter()
            .filter(|node| unvisited_set.contains(*node))
        {
            let alt = match distances[&u] {
                Infinity => continue,
                NegativeInfinity => continue,
                Finite(alt) => alt,
            } + graph.distance_between_nodes(u, v.clone()) as i32;

            if Finite(alt) < distances[v] {
                distances.insert(v.clone(), Finite(alt));
                prev.insert(v.clone(), Some(u));
            }
        }
    }

    let mut s = vec![];
    let mut u = Some(end_node);

    if let Some(_) = prev[&u.unwrap()] {
        while let Some(u1) = u {
            s.insert(0, u1);
            u = prev[&u1];
        }
    } else {
        return None;
    }

    Some((s.len() - 1) as u32)
}
```
</details>

The function is more parametrized than needed for part one, but it turned out to be useful for part two (hindsight!). With this code in place, it's a matter of running the `dijkstra` function.

### Second Part

For the second part, it's about "brute forcing", really. We want to calculate the `dijkstra` function above for all starting point `a`s. It was a bit slow to run, but it could've been parallelized easily. Oh well. Not enough time today!

## Day 11

Part one went smoothly. Part two took quite a lot, and I ended up needing some help from [r/adventofcode](https://www.reddit.com/r/adventofcode/). Bums me out a bit, but hey, never stop learning and being humbled!

{{ youtube(id="dTfYoeLri1M", class="embedded-youtube-player") }}

## Day 10

You know the drill: it's a screencast.

{{ youtube(id="lDBKLYZMe9o", class="embedded-youtube-player") }}

## Day 9

I didn't have time for a screencast today, so we'll walk through the solution here.

I started out with a few data structures. The first thing was trying out `type` aliases in Rust:

```rust
// Grid looks like this:
// (2, 0) (2, 1) (2, 2) (2, 3)
// (1, 0) (1, 1) (1, 2) (1, 3)
// (0, 0) (0, 1) (0, 2) (0, 3)

type Position = (i32, i32);
```

A position can be negative, too, that's why the indexes are `i32`s. Next, we have "moves":

```rust
#[derive(PartialEq, Debug)]
enum Direction {
    Up,
    Down,
    Left,
    Right,
}

struct Move {
    direction: Direction,
    distance: usize,
}

impl Move {
    pub fn from_line(line: &str) -> Move {
        let (direction, distance) = line.split_at(1);
        let distance = distance.trim().parse::<usize>().unwrap();

        let direction = match direction {
            "U" => Direction::Up,
            "D" => Direction::Down,
            "L" => Direction::Left,
            "R" => Direction::Right,
            _ => panic!("Unknown direction: {}", direction),
        };

        Move {
            direction,
            distance,
        }
    }
}
```

Pretty straightforward to model this with types.

Alright, the central data structure of this puzzle is a **rope**. For the first part of the puzzle, I started with a simple struct with `head` and `tail` fields.

```rust
#[derive(Debug)]
struct Rope {
    head: Position,
    tail: Position,
}
```

To count the visited positions, instead, I opted for a `HashSet`. The initialization looks like this:

```rust
let input = include_str!("../inputs/day9.txt");
let mut visited_positions: HashSet<Position> = HashSet::new();
let mut rope = Rope { head: (0, 0), tail: (0, 0) };
```

Then, the gist of the problem is going through all moves in the input, update the rope, and then print out the number of elements in `visited_positions` at the end.

```rust
for move_ in input.lines().map(Move::from_line) {
    for _ in 0..move_.distance {
        rope.move_head(&move_);
        rope.update_tail(&mut visited_positions);
    }
}

println!("Visited {} positions", visited_positions.len());
```

I won't bother you with the details of `.move_head()` and `.update_tail()` here, but it's a bunch of index math (that you can find [in GitHub](https://github.com/whatyouhide/advent_of_code_2022/commit/73b51c0a439ca092291a37a60b2337c163cd1b6e)).

### Second Part

The second part was really about generalizing the rope to have a bigger number of knots. Instead of having just `head` and `tail`, I went for a fixed-length slice:

```rust
#[derive(Debug)]
struct Rope {
    knots: [Position; 10],
}
```

Then, it was a matter of renaming `update_tail` to `update_other_knots`. The math is the same, but generalized to go through all knots and make each one "follow" the next, with the exact same logic as before.

One note I had fun with: I got stuck initially with some small bugs here and there, and the best thing I did was writing some code to *print* the grid. Visually debugging the puzzle against the example one on the website helped a lot. To do that, I implemented the `std::fmt::Display` trait for my `Rope` struct.

```rust
impl fmt::Display for Rope {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        for row in (-20..20).rev() {
            for column in -20..20 {
                let mut found = false;
                for index in 0..self.knots.len() {
                    if self.knots[index] == (row, column) {
                        write!(f, "{}", index)?;
                        found = true;
                    }
                }

                if !found {
                    write!(f, ".")?
                };
            }

            write!(f, "\n")?;
        }

        Ok(())
    }
}
```

## Day 8

Today's puzzle was pretty fun, and not that hard. I opted for a screencast again.

{{ youtube(id="0yI_vlx5evM", class="embedded-youtube-player") }}

## Day 7

Holy. Shit. I do not know Rust. I started recording a screencast for today's puzzle, but I stopped in anger one hour and twenty minutes in. It took me around four hours to get this right. As it turns out, recursive data structures are easy in functional programming languages like Elixir, but a whole other level of nightmares in something like Rust. That's due to the ownership and all that jazz. I struggled a lot with the **tree** data structure that is kind of needed to solve the puzzle: how to reference parent and children nodes was just not working for me.

In the end, I had to do just a bit of searching the web, and I stumbled across [this post](https://applied-math-coding.medium.com/a-tree-structure-implemented-in-rust-8344783abd75) on how to implement these recursive data structures in Rust. I thought of using `Box` initially, without having any idea what that really is, but I would have never arrived to the conclusion that the solution was `Rc` and `RefCell`.

In any case, let's go through my solution, without the four hours of ~~head smashing~~ thought process. Let's start out with some data structures: the file system is a *tree*. Each node can be a *directory* or a *file*. Directories can have children, which are other tree nodes. Directories and files also have a parent node, but I only bothered with adding it to directories (and not to files) for simplicity.

```rust
#[derive(Debug)]
pub struct File {
    name: String,
    size: u64,
}

#[derive(Debug)]
pub struct Dir {
    name: String,
}

#[derive(Debug)]
enum NodeValue {
    File(File),
    Dir(Dir),
}

struct Node {
    value: NodeValue,
    children: HashMap<String, Rc<RefCell<Node>>>,
    parent: Option<Rc<RefCell<Node>>>,
}
```

One interesting thing was that I had to implement the `Debug` trait for `Node`, because otherwise it would recursively try to print a node's parent, which prints another node that has children, that have parents, and so on.

```rust
impl fmt::Debug for Node {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Node")
            .field("value", &self.value)
            .field("children", &self.children)
            .finish()
    }
}
```

Then, just a couple of methods on the `Node` struct to construct it, append nodes, and calculate the size:

```rust
impl Node {
    pub fn new(dir: Dir) -> Node {
        Node {
            value: NodeValue::Dir(dir),
            children: HashMap::new(),
            parent: None,
        }
    }

    fn append_node<'a>(&mut self, name: String, node: Rc<RefCell<Node>>) {
        self.children.insert(name.clone(), node);
    }

    fn size(&self) -> u64 {
        match &self.value {
            NodeValue::File(file) => file.size,
            NodeValue::Dir(_) => {
                let mut size = 0;
                for child in self.children.values() {
                    size += child.borrow().size();
                }
                size
            }
        }
    }
}
```

After this, I went with a couple of enums to give structure to the lines in the input:

```rust
// A command is either "cd <>" or "ls".
enum Command {
    Cd(String),
    Ls,
}

enum Line {
    Command(Command),
    FileWithSize(String, u64),
    Dir(String),
}
```

I also wrote a small function to parse each line into one a `Line`:

<details>
 {{ summary_tag(text="`fn parse_line(line: &str) -> Line`") }}

```rust
fn parse_line(line: &str) -> Line {
    if line.starts_with("$") {
        let command = line[2..].trim();

        if command.starts_with("cd") {
            let dir = command[2..].trim();
            Line::Command(Command::Cd(dir.to_string()))
        } else if command == "ls" {
            Line::Command(Command::Ls)
        } else {
            panic!("Unknown command: {}", command);
        }
    } else {
        if line.starts_with("dir") {
            let dir_name = line[4..].trim();
            Line::Dir(dir_name.to_string())
        } else {
            let mut parts = line.split_whitespace();
            let size: u64 = parts.next().unwrap().to_string().parse::<u64>().unwrap();
            let name = parts.next().unwrap().to_string();
            Line::FileWithSize(name, size)
        }
    }
}
```
</details>

Alright. Now for the heart of this puzzle: a function that walks through all the lines in the input, and builds out the tree data structure.

```rust
let input = include_str!("../inputs/day7.txt");

let root = Rc::new(RefCell::new(Node::new(Dir {
    name: "/".to_string(),
})));

let mut current_dir = Rc::clone(&root);

let lines = input.lines().skip(1).map(parse_line);

for line in lines {
    match line {
        // For a file, we create a new file struct and add it to the current directory's
        // children.
        Line::FileWithSize(filename, size) => {
            let child_node = Rc::new(RefCell::new(Node {
                value: NodeValue::File(File {
                    name: filename.to_string(),
                    size,
                }),
                children: HashMap::new(),
                parent: None,
            }));

            current_dir
                .borrow_mut()
                .append_node(filename, Rc::clone(&child_node));

            child_node.borrow_mut().parent = Some(Rc::clone(&current_dir));
        }

        // For a directory, we create a new directory struct, set its parent
        // the current directory, and add it to the current directory's
        // children.
        Line::Dir(dir_name) => {
            let child_node = Rc::new(RefCell::new(Node::new(Dir {
                name: dir_name.to_string(),
            })));

            current_dir
                .borrow_mut()
                .append_node(dir_name, Rc::clone(&child_node));

            let mut mut_child = child_node.borrow_mut();
            mut_child.parent = Some(Rc::clone(&current_dir));
        }

        // "ls" is kind of not very useful, so we just ignore it.
        Line::Command(Command::Ls) => continue,

        // For "cd", we find the directory in the current directory's children
        // and make it the current directory. If the directory is "/", we go
        // back to the root. If the directory is "..", we go to the parent
        // of the current directory.
        Line::Command(Command::Cd(dir_name)) => match dir_name.as_str() {
            "/" => {
                current_dir = Rc::clone(&root);
            }
            ".." => {
                let current_dir_clone = Rc::clone(&current_dir);
                current_dir = Rc::clone(current_dir_clone.borrow().parent.as_ref().unwrap());
            }
            _ => {
                let child_clone = Rc::clone(&current_dir.borrow().children[&dir_name]);
                current_dir = child_clone;
            }
        },
    }
}
```

A lot of `.borrow()`, `.borrow_mut()`, `Rc::clone()`, and what have you. I'm sure this is not peak Rust, but I'm pretty proud that this worked!

To solve part one of the puzzle, I then ended up writing a small function to calculate the size of all directories whose total size is at most `100_000`.

<details>
 {{ summary_tag(text="`fn calc_size(node: &Node) -> u64`") }}

```rust
fn calc_size(node: &Node) -> u64 {
    let mut total = 0;
    let size = node.size();

    if size <= 100000 {
        total += size;
    }

    for child in node.children.values() {
        match child.borrow().value {
            NodeValue::File(_) => continue,
            NodeValue::Dir(_) => {
                total += calc_size(&child.borrow());
            }
        }
    }

    return total;
}
```
</details>

### Second Part

The second part had virtually no complexity once I had the first part down. I just:

  1. Walked the tree again.
  1. Calculated the size of each node.
  1. If the size of a node was enough to "free up enough space", I stored it as the minimum size.

I got this one right on the first try, and it took about 2% of the time it took to do the first part! Crossing my fingers that tomorrow's puzzle will have more mercy on me.

## Day 6

A screencast you said? Let's try that! I'm tired of typing!

{{ youtube(id="FaEorUDhZq4", class="embedded-youtube-player") }}

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

```bash
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
[repo]: https://github.com/whatyouhide/advent_of_code_2022

---
title: Advent of Code 2022
description: |
  An experiment in solving AoC 2022 with Rust and some AI (GitHub Copilot and
  OpenAI's ChatGPT).
updated: 2022-12-26
extra:
  cover_image: cover-image.png
---

I'm doing [Advent of Code] 2022 in [Rust] as a chance to get more familiar with the language. In this ongoing post, I'm documenting each day's progress, my thought process, and so on. I'm better at writing than recording screencasts or what have you. This is essentially a small journal. Ah, and I'm trying **AI tools** for doing this as well, so this is bound to be fun.

<!-- more -->

![Cover image of a futuristic-looking Christmas tree](cover-image.png)

I don't really know Rust, but it's a fascinating language for me. I mostly write [Elixir]. Even when it comes to other languages, I'm used to and fond of functional programming, immutable data everywhere, and things like those. Rust is quite different. I'm not used to working with **static types**, **mutability**, or **low-level memory access**. This is a good excuse to learn a bit more about the language, given its recent rise to fame.

The thing is this: it's hard to search specific stuff on the web when learning a new programming language, especially *at the beginning*. I'm clueless, so I go about it by searching for stuff like "how to read a file and split it into lines in Rust?". It takes a lot of Stack Overflow questions, small snippets of code lying around in blog posts, and documentation. However, 2022 is the **year of AI**, isn't it? I have not been too deep into the AI scene. I've used [DALL·E 2][dall-e-2] a bit, but not much else. Never tried writing software with the help of [GitHub Copilot][copilot], for example. And at the time of writing this, a lot of what I read on the Internet is about the recent release of [ChatGPT][chatgpt]. There's no time like the present, right? I figured these tools might be a nice help when learning a new language.

Anyway, enough prefacing. I'll post each day, and I'll probably break that promise. Most recent day on top. All complete solutions are [on GitHub][repo].

Also, a disclaimer: this is not a polished post. I went with the approach that publishing something is better than publishing nothing, so I'm going for it. I'd absolutely love to know if this was interesting for you, so reach out on Twitter or via email (links in footer) if you have feedback.

## Day 25

I could only do part one here since I don't have all other puzzles completed yet. The most fun thing about today's puzzle was implementing a bunch of Rust traits for these "SNAFU" numbers to play more with Rust.

I went with:

  * `std::fmt::Display`, which prints a SNAFU as a string (as seen in the puzzle input).
  * `std::str::FromStr`, which lets me parse a string representation of a SNAFU number.
  * `TryFrom<i128>`, which lets me convert `i128` numbers to `SNAFU` numbers.

Other than that, this is a base conversion thing. Early in my career, I got obsessed for a little bit with base conversions and even created [a library for Elixir](https://github.com/whatyouhide/convertat) and [a library for Ruby](https://github.com/whatyouhide/bases) to do base conversion. Go figure.

## Day 24

Haven't attempted yet. Time.

## Day 23

Some kind of [Conway's Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) thing for today's puzzle.

Absolutely nothing interesting to write about. I didn't really learn anything new, didn't play with any Rust features, or anything like that. Just plain old working-through-the-problem. Same for part two.

## Day 22

Uh, sort-of-2D work. Not a fan here.

Part one was a matter of getting the wrapping and directions and grid right. I don't even know what to write about here, as the code is pretty boring to look at. The only thing I enjoyed doing was using types a lot to ["make illegal states unrepresentable"](https://fsharpforfunandprofit.com/posts/designing-with-types-making-illegal-states-unrepresentable/). For example, instead of having a board of `char`s (`' '`, `'.'`, or `'#'`), I went with an enum:

```rust
enum Cell {
    Empty,
    Space,
    Wall
}
```

Other than this… Not my jam. I didn't even attempt part two yet because it goes from sort-of-2D to sort-of-3D. I don't want anything to do with that!

## Day 21

Nice puzzle today. For part one, I was able to get away with a quick-enough solution: iterate through the monkeys and "solve" the ones that point to monkeys that already have a number. Without all the parsing code, the core looks something like this:

```rust
let monkeys = input
    .lines()
    .map(|line| line.parse::<Monkey>().unwrap())
    .collect::<HashMap<String, Monkey>>();

let mut computed_monkeys = HashMap::new();

loop {
    if monkeys.len() == 0 {
        break;
    }

    for monkey in monkeys.clone() {
        match monkey.clone() {
            Monkey::YellingMonkey(name, number) => {
                monkeys.remove(monkey.name());
                computed_monkeys.insert(name, number);
            }
            Monkey::MathMonkey(name, op, monkey1, monkey2) => {
                match (
                    computed_monkeys.get(&monkey1),
                    computed_monkeys.get(&monkey2),
                ) {
                    (Some(number1), Some(number2)) => {
                        monkeys.remove(monkey.name());
                        let result = op.apply(*number1, *number2);
                        computed_monkeys.insert(name, result);
                    }
                    _ => continue,
                }
            }
        }
    }
}

println!("The 'root' monkey yells: {}", computed_monkeys["root"])
```

Not very pretty, but fast enough to spit out the correct result.

### Day 21: Part Two

Part two was more fun! The same brute-force approach as above crumbled down. I naively tried this: if I know how to calculate the `root` monkey's values, and I can compare them for equality… Let's try all numbers (`0..`) for the `humn` value and see if we find one that works. Failed miserably.

So, time to roll up my sleeves and build an AST of operations. I went with a straightforward structure:

```rust
enum ASTNode {
    Human,
    Number(isize),
    Operation(Operation, Box<ASTNode>, Box<ASTNode>)
}
```

Parsing the AST was easy enough. The fun part was to "solve" the full AST for the `humn` variable. To do that, I went with the simplest one-variable equation solving approach I could think of. The idea was to do something to both sides of the `=` that would simplify the side where the `humn` variable is. This is really early grades math, I know. So, I went with a `simplify_equation(left_ast, right_ast)` function:

```rust
fn simplify_equation(left: &Self, right: &Self) -> (Self, Self) {
    match (left, right) {
        // We solved it!
        (Self::Human, Self::Number(_)) => (left.clone(), right.clone()),

        // If there's an operation on the left, we simplify it.
        (Self::Operation(op, x, y), Self::Number(right_number)) => {
            // The equation is number • y = right_number, so we can simplify it as
            // y = right_number ¬ number, where ¬ is the opposite of •.
            match (x.as_ref(), y.as_ref()) {
                (Self::Number(number), _) => {
                    // The Sub operation is tricky, because it's technically
                    // (Add -> Mul(-1)).
                    let (simplified_left, op) = if *op == Operation::Sub {
                        (
                            Box::new(Self::Operation(
                                Operation::Mul,
                                Box::new(Self::Number(-1)),
                                y.clone(),
                            )),
                            Operation::Add,
                        )
                    } else {
                        (y.clone(), *op)
                    };

                    let simplified_right = Self::Number(op.inverse().apply(*right_number, *number));

                    Self::simplify_equation(&simplified_left, &simplified_right)
                }

                // The equation is x • number = right_number, so we can simplify it as
                // x = right_number ¬ number, where ¬ is the opposite of •.
                (_, Self::Number(number)) => {
                    let simplified_left = x.clone();
                    let simplified_right = Self::Number(op.inverse().apply(*right_number, *number));
                    Self::simplify_equation(&simplified_left, &simplified_right)
                }

                _ => {
                    panic!("found an operation on the left where neither operand is a number")
                }
            }
        }

        _ => panic!("Should never get here"),
    }
}
```

To make this work, I also added a `simplify(ast)` function that simplifies an AST made entirely of numbers (which can be reduced to a single number). My initial solution did not work, so I turned out to Reddit and someone mentioned the [QuickMath website](https://quickmath.com/webMathematica3/quickmath/equations/solve/basic.jsp). I pretty-printed my original equation, pasted it in there, and it spit out the right number. After a bit of debugging, I figured that the issue in my code was that I was not handling the `-` operation correctly (which I did in the code above). All is well now.

## Day 20

Today's puzzle was surprisingly easy considering that it's day 20 at this point. It's also the sort of puzzle that a language like Rust, with constant-access vectors and mutable data structures.

For part one, I mostly used the puzzle as an excuse to learn more about some traits.

```rust
struct CircularList(Vec<(i64, usize)>);
```

I stored each number (`i64`) along its "ID" (the `usize`), which is just its original index in the provided input. There are duplicates in the input numbers, so trying to find each number by its value wouldn't have worked. Now for the traits:

```rust
// Allows me to do some_iter.collect::<CircularList>().
impl FromIterator<(i64, usize)> for CircularList {
    fn from_iter<I: IntoIterator<Item = (i64, usize)>>(iter: I) -> Self {
        Self(iter.into_iter().collect())
    }
}

// Nice for reproducing the input example with println!("{}", circular_list).
impl Display for CircularList {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0.iter().map(|(n, _)| n).join(", "))
    }
}
```

After this, it was a matter of looping through each original number and moving each one to the new position. The only thing that took a second to realize was that the way to calculate the right destination index was to do modulo `length - 1`. This makes sense as we remove the element before finding its new position.

```rust
impl CircularList {
    fn move_element(&mut self, element: (i64, usize)) {
        let len = self.0.len() as i64;
        let (number, target_id) = element;

        let current_index = self.0.iter().position(|(_, id)| *id == target_id).unwrap();

        let mut new_index = (current_index as i64 + number) % (len - 1);
        if new_index < 0 {
            new_index = (len - 1) + new_index;
        }

        let element = self.0.remove(current_index);
        self.0.insert(new_index as usize, element);
    }
}
```

After this, I just looped through the original elements, moved each one, and then calculated the 1000th, 2000th, and 3000th element in the list with:

```rust
fn get_element_from_zero(&self, offset_from_zero: u32) -> i64 {
    let zero_index = self.0.iter().position(|(n, _)| *n == 0).unwrap();
    let offset = (offset_from_zero + zero_index as u32) % self.0.len() as u32;
    self.0[offset as usize].0
}
```

### Day 20: Part Two

Part two was such a small iteration over part one today. I only had to multiply each number in the input with the "decryption key" and run through the full iteration 10 times instead of only once.

## Day 19

**Loved** today's puzzle. I got re-acquainted with a bunch of new stuff that I had studied in university many ages ago. Namely:

  * What [linear programming](https://en.wikipedia.org/wiki/Linear_programming) is. I did not actually do anything with this info, but it was great to brush up.

  * [Depth-first search](https://en.wikipedia.org/wiki/Depth-first_search) and [breadth-first search](https://en.wikipedia.org/wiki/Breadth-first_search) for trees.

For part one, I did not have to look anything up. The basic idea was to build a tree of possible successive states, branching at each state by the possible next states. Then, I walked down the tree and calculate the number of geodes at each final state, choosing the maximum for that given tree. I called trees "simulations".

```rust
#[derive(Clone, Copy, Debug, Hash, PartialEq, Eq)]
struct State {
    ore_robots: u16,
    clay_robots: u16,
    obsidian_robots: u16,
    geode_robots: u16,
    ore: Ore,
    clay: Clay,
    obsidian: Obsidian,
    cracked_geodes: u16,
}
```

I liked the approach I went with: I took advantage of the `Option<State>` type to figure out the possible next states. The heart of the puzzle is the following method in the `State` implementation:

```rust
fn possible_next_states(&self, blueprint: &Blueprint, time_left: u16) -> Vec<State> {
    // Each of the buil_* functions returns Option<State>, returning None
    // if that state is impossible at this point, and Some(state) if it's
    // possible.
    let possible_next_states_with_new_robots = vec![
        self.build_ore_robot(blueprint, time_left),
        self.build_clay_robot(blueprint, time_left),
        self.build_obsidian_robot(blueprint, time_left),
        self.build_geode_robot(blueprint),
        Some(self.clone()) // This state is an "idle" state of just mining
    ];

    let mut next_states = possible_next_states_with_new_robots
        .iter()
        .filter_map(|state| state.clone())
        .collect::<Vec<Self>>();

    // Update "mined resources".
    for mut state in &mut next_states {
        state.ore = Ore(state.ore.0 + self.ore_robots);
        state.clay = Clay(state.clay.0 + self.clay_robots);
        state.obsidian = Obsidian(state.obsidian.0 + self.obsidian_robots);
        state.cracked_geodes = state.cracked_geodes + self.geode_robots;
    }

    next_states
}
```

Then, you have your sort of usual tree walk function that recursively goes down the tree. Initially, this was so painfully slow for the input 24 minutes that I had to figure out some optimizations. After lightly browsing [/r/adventofcode][subreddit], I understood that the main idea here is to try to *prune* as many tree branches as possible. This can be done in several ways. For example, an easy way was:

  1. When building the state, calculate the maximum resource needed for each robot for each type of resource.

  1. Now, when building the next possible states, you can ignore the "idle" state (`Some(self.clone())` above) if you already have the max of each needed resource, since you can only build a single robot at each minute anyway.

Since the tree growth is exponential on the number of possible next states, reducing that number has quite a big effect in general. With these optimizations, part one of the puzzle took a handful of seconds to run.

### Day 19: Part Two

Part two's deal was bumping the minutes from 24 to 32, which is a significant exponential growth in the search space. So, I had to scout for a few more optimizations:

  1. Say the number you mine for resource R reaches the maximum number of R needed for any robot. Also, say you won't be able to mine enough for new robots with the time left. Then, you can stop building robots that produce R. This is harder to write than to implement, but the main idea is to prune useless states where you build robots that you're not going to need.

  1. The biggest optimization, by far, was to keep track of the maximum number of geodes produced in any final state of a simulation. When exploring that simulation, you can then prune whole subtrees where the **optimal** number of geodes produced is lower than that tree. The optimal number is calculated by pretending that you start producing a geode robot each minute from the current state, and you crack as many geodes as possible. This optimization ended up reducing the search space significantly.

With these, it took about ~3 minutes to solve part two. I saw on Reddit that many folks managed to optimize this enough to run in a few hundred milliseconds. That's pretty interesting, and as far as I could tell it was all done through other optimizations, playing with DFS/BFS, and stuff like that. Great (re-)learning experience today.

## Day 18

Today I managed to squeeze in the puzzle. Parsing the input and defining types was straightforward:

```rust
#[derive(Debug, PartialEq, Eq, Hash, Clone)]
struct Cube(i32, i32, i32);

impl Cube {
    pub fn from_string(string: &str) -> Self { /* ... */ }
}
```

Then, I went for an inefficient-but-effective approach. I added a method to `Cube` that counts the exposed sides of the given cube when compared to a given **set** of other cubes. The trick of the function is to build a set of all cubes "adjacent" to the target one, and then check how many of those are in the given set of other cubes. The total of exposed sides is six minus that number.

```rust
fn exposed_sides(&self, other_cubes: &HashSet<Self>) -> u16 {
    let adjacent_cubes = HashSet::from([
        Self(self.0 + 1, self.1, self.2),
        Self(self.0 - 1, self.1, self.2),
        Self(self.0, self.1 + 1, self.2),
        Self(self.0, self.1 - 1, self.2),
        Self(self.0, self.1, self.2 + 1),
        Self(self.0, self.1, self.2 - 1),
    ]);

    6 - (adjacent_cubes.intersection(other_cubes).count() as u16)
}
```

Calculating all the exposed sides was then a matter of this:

```rust
let total_exposed_sides = cubes
    .iter()
    .map(|cube| {
        let set_with_cube = HashSet::from([cube.clone()]);
        let difference: HashSet<Cube> =
            HashSet::from_iter(cubes.difference(&set_with_cube).cloned());
        cube.exposed_sides(&difference) as u32
    })
    .sum::<u32>();
```

This approach works because two cubes that are adjacent on one side are **both** adjacent to each other on that side, which means that we'll only count the uniquely-exposed sides.

## Day 17

Same as yesterday… Had to skip for now!

## Day 16

~~Had to skip for now due to time constraints, I'll try to come back to this later.~~

I went back to this. I used the help of [/r/adventofcode][subreddit] again. The idea I found to work was:

  1. Build an undirected graph of valves. I used the [`petgraph` crate](https://docs.rs/petgraph/latest/petgraph/index.html) (in particular, the [`petgraph::graphmap::UnGraphMap`](https://docs.rs/petgraph/latest/petgraph/graphmap/type.UnGraphMap.html) type).

  1. Use the [Floyd-Warshall algorithm](https://en.wikipedia.org/wiki/Floyd–Warshall_algorithm) to build a matrix of distance between each node in the graph, assigning the value of `1` to each edge. I typed the distance matrix as:

     ```rust
     struct DistanceMatrix<'a>(HashMap<(&'a str, &'a str), u32>);
     ```

     and has one method, `DistanceMatrix::get(u, v)`, that returns the distance between `u` and `v` (or `v` and `u`, since the graph is undirected).

  1. Instead of exploring all solutions by moving one step at a time, I explored solutions by moving directly to the next valve to open, using the distance matrix to calculate how long it would take.

Building the graph was fairly easy. It looks something like this:

```rust
// Valve is just a struct with a few fields that you can easily guess
// from this function.
fn graph_from_valves(valves: &Vec<Valve>) -> ValveGraph {
    let mut graph: ValveGraph = graphmap::UnGraphMap::new();

    for valve in valves.iter() {
        graph.add_node(valve.id.as_str());
    }

    for valve in valves.iter() {
        for connected_valve in valve.connected_valves.iter() {
            graph.add_edge(valve.id.as_str(), connected_valve.as_str(), ());
        }
    }

    graph
}
```

Then, the idea is to run simulations on successive states:

```rust
fn run_simulation(
    state: State,
    distance_matrix: &DistanceMatrix,
    graph: &ValveGraph,
    flow_rates: &HashMap<String, u32>,
    explored_states: &mut u32,
) -> State {
    // Just for fun, seeing how many states we need to explore.
    *explored_states += 1;

    state
        .next_states(graph, distance_matrix, flow_rates)
        .into_iter()
        .map(|s| run_simulation(s, distance_matrix, graph, flow_rates, explored_states))
        .max_by_key(|s| s.released_pressure)
        .unwrap_or(state)
}
```

With this strategy, I found a solution after exploring less than 100k states, in about 300ms.

### Day 16: Part Two

I didn't really know where to start on part two, and honestly out of laziness I went to Reddit straight away. [This post](https://www.reddit.com/r/adventofcode/comments/znr2eh/2022_day_16_the_elephant_in_the_room/) suggested that I do something like this:

  1. Run the simulation like in part one.

  1. Now, take away all the valves opened by the human, and run the simulation again as the elephant, seeing which valves get opened.

With the data structures I used, the easiest way to do this was to set the flow rate of the vales opened in part one to `0` before running the "elephant simulation". Still under 100k states explored, and still under 300ms to get a solution.

## Day 15

Today's puzzle was interesting: in the second part, I had to actually shrink my little brain and figure out an *efficient* way to solve it, instead of brute forcing. But let's start from part one. Data structures first.

```rust
// Love using tuple-like structs.
#[derive(Debug, PartialEq, Eq, Hash, Clone)]
struct Point(i64, i64);

#[derive(Debug)]
struct Grid {
    sensors_and_closest_beacons: HashMap<Point, Point>,
    top_left_corner: Point,
    bottom_right_corner: Point,
}
```

I won't show how I parsed the input into a `Grid`, as parsing the input is becoming quite repetitive. The only interesting function in `Grid` is `Grid::manhattan_distance`. The best thing? GitHub Copilot basically wrote this.

```rust
fn manhattan_distance(a: &Point, b: &Point) -> i64 {
    (a.0 - b.0).abs() + (a.1 - b.1).abs()
}
```

For part one of the puzzle, I was able to find a solution through sheer brute force.

```rust
let target_row = 10;
let mut forbidden_positions = 0;

// Grid::points_in_row returns an iterator of points on the given y.
for point in grid.points_in_row(target_row) {
    if grid.is_in_sensor_range(&point) {
        forbidden_positions += 1;
    }
}

println!("On line {target_row} there are {forbidden_positions} forbidden positions");
```

One thing to note: the more days go by, the more I find it useful to have a way to *represent* data structures on the terminal. In this case, I also implemented a `Grid::draw` method, which helped me match my representation and calculations against the provided examples.

### Day 15: Part Two

Part two was a fun challenge. The problem instructs you to search through the space `(0, 0) -> (4000000, 4000000)`. That's 16 trillion points. Rust is fast, but apparently not *that* fast. So, I had to get clever. The thing is: I'm not clever! I rarely have to think through optimizations like these, because I tend to work in higher-level domains (like the Web™).

The intuition I followed was to build a list of ranges on each row from the list of beacons. Ranges are fairly cheap to build. I'm sure I could've done something more clever, but I went with something like this:

```rust
let mut ranges_by_row = HashMap::new();

// Prefill each row with an empty vector. There's probably a better way to do
// this in Rust, but laziness got the best of me.
for y in self.top_left_corner.1..=self.bottom_right_corner.1 {
    ranges_by_row.insert(y, Vec::new());
}

for (sensor, beacon) in &self.sensors_and_closest_beacons {
    let distance = Self::manhattan_distance(sensor, beacon);

    for current_distance in -distance..=distance {
        let row = sensor.1 + current_distance;
        let offset = (current_distance.abs() - distance).abs();
        let range = (sensor.0 - offset)..=(sensor.0 + offset);
        ranges_by_row.get_mut(&row).unwrap().push(range);
    }
}
```

This was reasonably fast, in the ballpark of a few seconds tops. Then, for each row, I went through all the ranges and **merged** them. This was fun to write:

```rust
let mut merged_ranges = HashMap::new();

for (row, mut ranges) in ranges_by_row {
    ranges.sort_by_key(|range| range.start().clone());

    // Start with the first element
    let mut mut_ranges = vec![ranges[0].clone()];

    for i in 1..ranges.len() {
        let next_range = ranges[i].clone();

        // Pop the current range, modify it if necessary, and put it back.
        let current_range = mut_ranges.pop().unwrap();

        if current_range.end() >= next_range.start() {
            let start = current_range.start().min(next_range.start());
            let end = current_range.end().max(next_range.end());
            mut_ranges.push(*start..=*end);
        } else {
            // If the ranges don't overlap, but both back.
            mut_ranges.push(current_range);
            mut_ranges.push(next_range);
        }
    }

    merged_ranges.insert(row, mut_ranges);
}
```

Now the trick: the point we're searching for is on the only row (in the search space) that has **two** instead of one "detected ranges".

```rust
for y in 0..=4000000 {
    let ranges = detected_ranges.get(&y).unwrap();
    let ranges_len = ranges.len();

    if ranges_len > 1 {
        println!("Found the line with a space! It's line {y}");
        println!("It has ranges: {:?}", ranges);
        break;
    }
}
```

This was done in a few seconds, too. There's a good chance that there would be a smarter and more efficient solution, but hey, not my day job. Another day another puzzle!

## Day 14

It seems to me like picking the right data structures, just like in the real world, is a game changer when it comes to Advent of Code puzzles. Today, I was lucky enough to start out with a data structure that made solving the problem straightforward.

Usually, when the puzzle input is a sort of *grid*, I think many of us tend to reach for arrays of arrays (vectors of vectors in Rust) to represent the grid as a bi-dimensional matrix. Point `(x, y)` can be accessed as `grid[x][y]`. However, I find that sometimes a **map** (or dict, depending on the language) of `(x, y)` to value is a good alternative. That's what I used for today's puzzle. The `HashMap` came in handy especially for the second part, as we'll see later.

For part one, I started out with a `Point` type alias and a function for initializing the "world" (that is, the grid map):

```rust
use std::collections::HashMap;

type Point = (usize, usize);
type World = HashMap<Point, char>;
```

Then, it was time to parse the input. This was the deal: go through each input line, go through each `x1,y1 -> x2,y2` pair, and "draw" lines between each pair. Drawing a line with the `World` data structure meant adding a `(x, y) -> '#'` entry for each point on the line.

The heart of the puzzle is *pouring sand*. So, I wrote a `pour_sand` function that does exactly that:

```rust
// Returns the point where the sand comes to rest.
fn pour_sand(world: &mut World, sand_starting_point: Point) -> Point {
    let mut sand_point = sand_starting_point;

    loop {
        let down = (sand_point.0, sand_point.1 + 1);
        let down_left = (sand_point.0 - 1, sand_point.1 + 1);
        let down_right = (sand_point.0 + 1, sand_point.1 + 1);

        match (
            world.get(&down),
            world.get(&down_left),
            world.get(&down_right),
        ) {
            // There is space right below, so we move the sand down and keep going.
            (Some('.'), _, _) => {
                world.insert(sand_point, '.');
                world.insert(down, '+');
                sand_point = down;
            }

            // Space below is taken by sand or rock, but down left is free.
            (Some('#' | 'o'), Some('.'), _) => {
                world.insert(sand_point, '.');
                world.insert(down_left, '+');
                sand_point = down_left;
            }

            // Spaces below *and* down left are taken by sand or rock, but down right is free.
            (Some('#' | 'o'), Some('#' | 'o'), Some('.')) => {
                world.insert(sand_point, '.');
                world.insert(down_right, '+');
                sand_point = down_right;
            }

            // All spaces are taken, so the sand comes to rest at the current point.
            (Some('#' | 'o'), Some('#' | 'o'), Some('#' | 'o')) => {
                world.insert(sand_point, 'o');
                return sand_point;
            }

            _ => {
                panic!("Unexpected state at {:?}", sand_point);
            }
        }
    }
}
```

Finding the solution was a matter of `loop`ing until we could not put sand to rest anymore.

### Day 14: Part Two

The second part was fairly straightforward with a couple of small changes. The first one was changing the `World` type a bit: now, I wanted a struct with the same map as before, but also the `y` coordinate of the "floor".

```rust
struct World {
    points: HashMap<Point, char>,
    floor_y: usize,
}
```

Then, the trick was to replace the `HashMap::get` method in `pour_sand` with a custom `at_point` method in `impl World`. The custom method accounts for the presence of the floor, and looks like this:

```rust
impl World {
    fn at_point(&self, point: &Point) -> Option<&char> {
        match self.points.get(point) {
            Some(char) => Some(char),

            // Always rocks on the floor
            None if point.1 == self.floor_y => Some(&'#'),

            // Empty space everywhere above the floor
            None if point.1 < self.floor_y => Some(&'.'),

            None => None,
        }
    }
}
```

Now, the solution was about `loop`ing until a sand's resting point was `(500, 0)` (the starting point).

I loved today's puzzle: simple enough to be done in a reasonable amount of time, but still fun to work through.

## Day 13

Today's problem could be solved with different data structures. The important property was the ability to arbitrarily nest lists of integers. I used a well-known data structure for us functional programmers: linked lists. Thanks to [day 7](#day-7), I now know a bit more about Rust's smart pointers, so I was able to use `Box`es here. I started with the main data structure. A linked list is made of a **cons cell** that holds a value, plus a link to the next cons cell. In this case, since we can have nested lists, a cons cell can be:

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

### Day 13: Part Two

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

Today's puzzle was about applying [**Dijkstra's shortest-path algorithm**](https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm). The algorithm is somewhat straightforward, and the thing that took me some time was figuring out little things here and there to do with distance between vertices and so on.

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

### Day 12: Part Two

For the second part, it's about "brute forcing", really. We want to calculate the `dijkstra` function above for all starting point `a`s. It was a bit slow to run, but it could've been parallelized easily. Oh well. Not enough time today!

## Day 11

Part one went smoothly. Part two took quite a lot, and I ended up needing some help from [r/adventofcode][subreddit]. Bums me out a bit, but hey, never stop learning and being humbled!

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

### Day 9: Part Two

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

### Day 7: Part Two

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

### Day 5: Part Two

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

### Day 4: Part Two

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

### Day 3: Part Two

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

### Day 2: Part Two

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

### Day 1: Part Two

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
[subreddit]: https://reddit.com/r/adventofcode

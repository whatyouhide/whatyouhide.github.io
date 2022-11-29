---
title: Get Rid of Your Old Database Migrations
description: Are database migrations good? Probably, but are we using them in the right way? In this post, I write about how I think about migrations and what I'm doing to mitigate some of their shortcomings.
extra:
  cover_image: cover-image.jpg
taxonomies:
  tags:
    - elixir
---

Database migrations are great. I love to be able to change the shape of tables and move data around in a controlled way to avoid issues and downtime. However, lately I started to view migrations more like *Git commits* than like active pieces of code in my applications. In this post, I want to dig a bit deeper into the topic. I'll start with some context on database migrations, I'll expand on the Git commits analogy, and I'll show you *what I've been doing instead*.

<!-- more -->

I mostly write Elixir, so my examples will be in Elixir. If you're interested in the workflow I’m currently using for Elixir, jump to the last section of the post.

![Cover image of a flock of birds flying, with a sunset sky in the background](cover-image.png)

## What Are DB Migrations

DB migrations are pieces of code that you run to **change the schema (and data, if desired) of your database**. Wikipedia does [a great job][schema-migrations-wikipedia] at explaining migrations, their history, and their use cases. I'll write a few words here for context, but go read that if you want to dig deeper.

Migrations have a few selling points over executing direct SQL commands.

First, database migrations usually *keep information* about the migrations themselves in a dedicated database table. To be precise, the framework that runs the migrations is the one storing information in that table. The framework uses this table to only run migrations that have not been run yet.

Another benefit is that you'll usually write migrations in a way that makes it possible to **roll them back**. "Rolling back" a migration means executing SQL statements that revert the changes done in that migration. Most database frameworks can infer the rollback steps from the migration definition if the migration is simple enough. This results in concise pieces of code to alter the database schema that can be executed "in both directions".

Let's see an example with [Ecto][], Elixir's database framework.

### Example with Ecto

Let's say you have a `users` table with columns `email` and `password`. New requirements force you to add two new columns, `first_name` and `last_name`. To do that, you can write a migration that looks like this:

```elixir
defmodule MyApp.AddNameToUsers do
  use Ecto.Migration

  def change do
    alter table("users") do
      add :first_name, :string
      add :email, :string
    end
  end
end
```

In this simple example, the framework is able to do what I mentioned above: you can define a single `change/0` function with migration steps in it, and the framework is able to infer the corresponding rollback steps (in this case, removing the two new columns).

When you run the migration (with `mix ecto.migrate` in this case), Ecto adds a row to the `schema_migrations` table:

| `version`        | `inserted_at`         |
|------------------|-----------------------|
| `20221114232841` | `2022-11-15 21:27:50` |

## Why Do We Keep Migrations Around?

Until recently, I had never worked on an application that did not keep *all the migrations* around. I'd always seen the `priv/repo/migrations` directory in Elixir applications full of files. I want to get one disclaimer out of the way: the many-migrations experience is a personal one, and I might be late to the party here. But hey, here's to hoping someone else is too and that this write-up is gonna help them out.

At one point, I started working on an older unfamiliar codebase. The experience made me think of two things.

The first one is reading the **complete, up-to-date database schema structure**. I'd constantly fire up a Postgres GUI (I use [TablePlus][]) to look at the structure of the database, since it was hard to navigate old migrations and piece together what their end result is.

The second one revolves around **searching through code**. Working on the new codebase involved *a lot* of searching all around the code to understand the structure of the application. Function names, modules, database columns, and what have you. However, database columns stuck with me: I'd always find a bunch of misleading search results in old migrations. For example, I'd see a few results for a column name that was created, then modified, and then dropped.

So I started wondering: why do we keep old migrations around? Don't get me wrong, I know why we *write* migrations in the first place. They're great, no doubts. But why not **throw them away** after they've done their job? How many times did you roll back *more than one migration*? I have never done that. It's hard to imagine rolling back many changes, especially when they involve not only the schema but also the data in the database itself. There must be a better way.

### Analogy with Git Commits

I started to think of database migrations more like Git commits. You apply commits to get to the current state of your application. You apply database migrations to get to the current schema of your database. But after some time, Git commits become a tool for keeping track of history more than an active tool for moving back and forth between versions of the code. I'm now leaning towards treating database migrations the same way. I want them to stick around for a bit, and then "archive" them away. They're always going to be in the Git history, so I’m never really losing the source file, only the ability to apply the migrations.

So, how do we deal with this in practice?

### Dumping and Loading

It turns out that this is something others have already thought about.

Database frameworks that provide migration functionality usually provide ways to **dump** and **load** a database schema. If they don't, fear not: major databases provide that themselves. In fact, in Elixir Ecto's dump and load tasks only really act as proxies on top of tools provided by the underlying databases (such as `pg_dump` and `psql` for PostgreSQL).

The idea is always the same: to get the current state of the database, you'll run the **dumping task**. With Ecto and other frameworks, this produces an SQL file of instructions that you can feed to your database when you want to load the schema again.

Some frameworks provide a way to *squash migrations* instead. Django, for example, has the [`squashmigrations` command][django-squashmigrations]. However, the concept is almost the same. [Ruby on Rails][rails]'s `ActiveRecord` framework has a unique approach: it can [generate a **Ruby** schema file from migrations][active-record-schema-file-docs]. It can also generate the SQL schema file mentioned above via the database, but the Ruby approach is interesting. Its power is limited, however, since the Ruby schema file might not be able to reconstruct the exact schema of the database. From the documentation:

> While migrations may use execute to create database constructs that are not supported by the Ruby migration DSL, these constructs may not be able to be reconstituted by the schema dumper.

Dumping and loading the database schema works well in local development and testing, but *not in production* though, right? You don't want to load a big old SQL file in a running production database. I think. Well, you don't really have to. Production databases tend to be reliable and (hopefully) backed up, so "restoring" a schema is not something you really do in production. It'd be analogous to re-running all the migrations: you just never do it.

### Advantages and Disadvantages of Ditching Old Migrations

I find that dumping old migrations and loading an up-to-date SQL file has a few **advantages**.

  1. **You get a complete view of the schema** — The SQL file with the database schema now represents a complete look at the structure of the database. You can see all the tables, indexes, default values, constraints, and so on. Sometimes, you'll still need to create migrations and run them, but they're going to live in your codebase only temporarily, and it's only going to be a handful of them at a time, instead of tens (or hundreds) of files.

  1. **Speed**: A minor but not irrelevant advantage of this approach is that it speeds up resetting the database for local development and tests. Applying migrations can do many unnecessary operations in the database, such as creating tables only to delete them just after. When loading the database dump, you're really doing the *smallest possible set of commands* to get to the desired state.

However, it's not all great here. There are some **disadvantages** as well:

  1. **Digging through Git** — there are going to be situations in which you look at the migration table in your database and want to figure out the migration that corresponds to a given row. This approach makes this use case slightly more annoying, because you'll have to dig through your Git history to find the original migration. Not a big deal in my opinion, I don't really do this that much.

  1. **Deploying without running migrations** — make sure to deploy and run migrations. With this approach, that's not something to give for granted. You might get a bit too comfortable dumping the current database schema and deleting migration files. You might end up in situations where you create a migration, run it locally, and then dump the schema and delete the migration, all without deploying. This would result in the migration not running in production.

## Workflow in Elixir

Now for a small section specific to Elixir. Ecto provides the dump and load tasks mentioned above, [`mix ecto.dump`][mix-ecto-dump] and [`mix ecto.load`][mix-ecto-load] respectively.

In my applications, I've been doing something like this:

  1. I updated the common Mix aliases for dealing with migrations to take dumping/loading into account. Those aliases look something like this now:

     ```elixir
     defp aliases do
       [
         "ecto.setup": ["ecto.create", "ecto.load", "ecto.migrate"],
         "ecto.reset": ["ecto.drop", "ecto.setup"],
         test: [
           "ecto.create --quiet",
           "ecto.load --quiet --skip-if-loaded",
           "ecto.migrate --quiet",
           "test"
         ]
       ]
     end
     ```

     As you can see, the aliases now always run `mix ecto.load` before calling `mix ecto.migrate`. The `--skip-if-loaded` flag in the `test` alias ensures that the command is *idempotent*, that is, can be run multiple times without changing the result.

  2. I added a Mix alias to "dump migrations", that is, dump the current database structure and delete all the current migration files. It looks like this:

     ```elixir
     defp aliases do
       dump_migrations: ["ecto.dump", &delete_migration_files/1]
     end

     defp delete_migration_files(_args) do
       # Match all files in the 21st century (year is 20xx).
       Enum.each(Path.wildcard("priv/repo/migrations/20*.exs"), fn migration_file ->
         File.rm!(migration_file)
         Mix.shell().info([:bright, "Deleted: ", :reset, :red, migration_file])
       end)
     end
     ```

     The path wildcard could be improved, or you could have logic that reads the files and checks that they're migrations. However, this does a good-enough job.

## Conclusions

If you start to look at database migrations as analogous to Git commits, you can start to treat them that way. We saw how to use the "dumping" and "loading" functionality provided by many database and database frameworks. We saw the advantages and disadvantages of this approach. Finally, I showed you the approach I use in Elixir.

[TablePlus]: https://tableplus.com
[Ecto]: https://github.com/elixir-ecto/ecto
[schema-migrations-wikipedia]: https://en.wikipedia.org/wiki/Schema_migration
[mix-ecto-dump]: https://hexdocs.pm/ecto_sql/Mix.Tasks.Ecto.Dump.html
[mix-ecto-load]: https://hexdocs.pm/ecto_sql/Mix.Tasks.Ecto.Load.html
[django-squashmigrations]: https://docs.djangoproject.com/en/4.1/topics/migrations/#migration-squashing
[rails]: https://rubyonrails.org
[active-record-schema-file-docs]: https://edgeguides.rubyonrails.org/active_record_migrations.html

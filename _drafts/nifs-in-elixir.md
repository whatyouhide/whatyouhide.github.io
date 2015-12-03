---
layout: post
title: NIFs in Elixir
tags:
  - elixir
---

## Introduction

TODO

## Canonical NIF warning

TODO

## The basics

The way NIF works is simple: you write a C file and export a bunch of functions with the help of some Erlang-provided facilities, then compile that file. Then, you define an Erlang/Elixir module and call `:erlang.load_nif/2` in it. This function will define all the NIFs in the C file as functions in the calling module.

It's easier to see this in practice.

Let's start easy: let's write a NIF with no side effects that only takes a value
in an returns a value out. For the purpose of this example, we'll write
`fast_compare`, a function that takes two integers and compares them, returning
`0` if they're equal, `-1` if the first is less than the second and `1`
otherwise.

### Defining a NIF

Let's put on our surgeon vests and start with some delicate C; we'll work on `fast_compare.c`. The first thing we have to do is include the `erl_nif.h` header file, which contains all the stuff we need (type, functions, and macros) to work with NIFs.

```c
#include "erl_nif.h"
```

The C compiler won't know where `erl_nif.h` is so we'll have to specify that when we compile our program.

Now, every C file defining NIFs has a similar minimal structure: there's a list of C functions, then a list of which of these C functions should be exported to Erlang/Elixir (and with what name), and finally a call to the `ERL_NIF_INIT` macro, which performs all the magic needed to actually hook things up.

For our example, the list of C function will only include the `fast_compare` function. The signature of this function looks like this:

```c
static ERL_NIF_TERM fast_compare(ErlNifEnv *env, int argc, const ERL_NIF_TERM argv[]) {
  // cool stuff here
}
```

The two likely unfamiliar types here are `ERL_NIF_TERM` and `ErlNifEnv`. `ERL_NIF_TERM` is a "wrapper" type that represents all Erlang types (like binary, list, tuple, and so on) in C. We'll have to use functions provided by `erl_nif.h` in order to convert an `ERL_NIF_TERM` to a C value (or multiple C values). `ErlNifEnv` is just the Erlang environment the NIF is executed in, and we'll mostly just pass this around without actually doing anything with it.

Let's take a look at the arguments of `fast_compare` (which are the same for all NIFs):

* `env`: as mentioned above, this is just the Erlang environment the NIF is executed in and we won't care too much about it;
* `argc`: the number of arguments passed to the NIF when called from Erlang. We'll expand on this later;
* `argv`: the array of arguments passed to the NIF.

### Reading Erlang/Elixir values into C values

We'll call `fast_compare` from Elixir like this:

```elixir
fast_compare(99, 100)
#=> -1
```

When executing `fast_compare`, `argc` will be `2` and `argv` will be an array with the `99` and `100` arguments. These arguments however are of type `ERL_NIF_TERM`, so we have to "convert" them to C terms before being able to manipulate them. `erl_nif.h` provides functions to "get" Erlang terms into C terms; in this case, we need `enif_get_int`. The signature for `enif_get_int` is this:

```
TODO return type
enif_get_int(ErlNifEnv *, ERL_NIF_TERM, int *);
```

We have to pass in the environment `env`, the Erlang term we want to "get" (which we'll take from `argv`) and the address of an integer pointer that will be filled with the Erlang integer value.

### Turning C values to Erlang values

Now we have to convert C values back to Erlang values: `erl_nif.h` provides several `enif_make_*` functions to do exactly this. They all have a similar signature (which is adapted to the type each function has to convert) and they all return a `ERL_NIF_TERM` value. In our case, we'll need `enif_make_int`, which has this signature:

```c
ERL_NIF_TERM enif_make_int(ErlNifEnv *, int);
```

### Writing the NIF

At this point, writing the NIF is straightforward.

```c
static ERL_NIF_TERM fast_compare(ErlNifEnv *env, int argc, const ERL_NIF_TERM argv[]) {
  int a, b;
  enif_get_int(env, argv[0], &a); // fills `a` with the value of the first argument
  enif_get_int(env, argv[1], &b); // fills `b` with the value of the second argument

  // Usual C super concise code because this way is more brave and more true
  int result = a == b ? 0 : (a > b ? 1 : -1);

  return enif_make_int(env, result);
}
```

### Wiring our C up

We now have to export the function we wrote to Erlang/Elixir. We'll have to use the `ERL_NIF_INIT` macro. It looks like this:

```c
ERL_NIF_INIT(erlang_module, array_of_functions, load_ptr, upgrade_ptr, unload_ptr, reload_ptr)
```

where:

* `erlang_module` is the Erlang module where the NIFs we export will be defined; it shouldn't be surrounded by quotes as it will be stringified by the `ERL_NIF_INIT` macro (e.g., `my_module` instead of `"my_module"`);
* `array_of_functions` is an array of `ErlNifFunc` structs that defines which NIFs will be exported, along with the name to use as their Erlang counterpart and the arity;
* `load_ptr`, `upgrade_ptr`, `unload_ptr`, and `reload_ptr` are function pointers that point to hook functions that will be called when the NIF module is loaded, unloaded, and so on; we won't pay too much attention to these hooks right now, setting all of them to `NULL`.

We have all the ingredients we need. The complete C file looks like this:

```c
#include "erl_nif.h"

static ERL_NIF_TERM fast_compare(ErlNifEnv *env, int argc, const ERL_NIF_TERM argv[]) {
  int a, b;
  enif_get_int(env, argv[0], &a);
  enif_get_int(env, argv[1], &b);

  int result = a == b ? 0 : (a > b ? 1 : -1);

  return enif_make_int(env, result);
}

// Let's define the array of ErlNifFunc beforehand:
static ErlNifFunc nif_funcs[] = {
  // Each struct looks like: {erlang_function_name, erlang_function_arity, c_function}
  {"fast_compare", 2, fast_compare}
};

ERL_NIF_INIT(Elixir.FastCompare, nif_funcs, NULL, NULL, NULL, NULL)
```

Remember we have to use the full Elixir module name atom in the `ERL_NIF_INIT` macro (`Elixir.FastCompare` instead of just `FastCompare`).

### Compiling our C code

NIF files should be compiled to `.so` shared objects. Usually, it goes something like this:

```bash
$ gcc -fPIC -I$(ERL_INCLUDE_PATH) -dynamiclib -undefined dynamic_lookup -o fast_compare.so fast_compare.c
```

With this command, we're compiling `fast_compare.c` into `fast_compare.so` (`-o fast_compare.so`), using some flags for dynamic code along the way. Note how we're including `$(ERL_INCLUDE_PATH)` in the include paths: this is the directory that contains the `erl_nif.h` header file. This path is usually in the Erlang's installation directory, under `lib/erts-VERSION/include`.

### Loading NIFs in Elixir

The only thing we have left to do is load the NIF we defined in the Elixir `FastCompare` module. As the Erlang documentation for NIFs suggests, the `@on_load` hook is a great place to do this.

Note that for each NIF we want to define, we need to define the corresponding Erlang/Elixir function in the loading module as well. This can be taken advantage of in order to define, e.g., fallback cod e in case NIFs aren't available.

```elixir
# fast_compare.ex
defmodule FastCompare do
  @on_load :load_nifs

  def load_nifs do
    :erlang.load_nif('./fast_compare', 0)
  end

  def fast_compare(_a, _b) do
    raise "NIF fast_compare/2 not implemented"
  end
end
```

The second term for `:erlang.load_nif/2` can be anything and it will be passed to the the TODO. You can have a look at the [docs for `:erlang.load_nif/2`][docs-erlang-load_nif-2] to know more.

We're done! We can test our module in IEx:

```elixir
iex> c "fast_compare.ex"
iex> FastCompare.fast_compare(99, 100)
-1
```

### Examples in the wild

Writing "pure" NIFs (with no side effects, just transformations) is extremely useful. One example of this that I like a lot is the [devinus/markdown][devinus-markdown] Elixir library: this library wraps a C markdown parser in a bunch of NIFs. This use case is perfect as turning Markdown into HTML can be an expensive task, and a lot can be gained by delegating that work to C.

## Something useful: resources

As I mentioned above, a great use of NIFs is for wrapping existing C libraries. Often, however, these libraries provide their own data abstractions and data structures. For example, a C database driver could export a `db_conn_t` type to represent a database connection, defined like this:

```c
typedef struct {
  // fields
} db_conn_t;
```

alongside functions to issue queries, like this:

```c
db_conn_t *db_init_conn();
db_type db_query(db_conn_t *conn, const char *query);
void db_free_conn(db_conn_t *conn);
```

It would be useful to be able to handle `db_conn_t` values in Erlang/Elixir and pass them around between NIF calls. The NIF API has something just like that: **resources**. No better way to quickly explain what resources do than the Erlang documentation:

> The use of resource objects is a safe way to return pointers to native data structures from a NIF. A resource object is just a block of memory [...].

Resources are blocks of memory, and we can build and return safe pointers to that memory *as Erlang terms*.

Let's explore how we could wrap the simple API sketched above inside NIFs. We're going to start with this skeleton C file:

```c
#include "db.h"
#include "erl_nif.h"

typedef struct {
  // fields here
} db_conn_t;

db_type db_query(db_conn_t *, const char *query);
```

### Creating resources

To create a resource, we have to allocate some memory with the help of the `enif_alloc_resource` function. This function is similar (in principle) to `malloc`, as you can tell by its signature:

```c
void *enif_alloc_resource(ErlNifResourceType *res_type, unsigned size);
```

`enif_alloc_resource` takes a resource type (which is just something we use to distinguish resources of different types) and the size of the memory to allocate, and returns a pointer to the allocated memory.

#### Resource types

Resource types are created with the `enif_open_resource_type` function. We can declare resource types as global variables in our C files and take advantage of the `load` hook passed to `ERL_NIF_INIT` to create the resource types and assign them to the global variables. It goes something like this:

```c
ErlNifResourceType *DB_RES_TYPE;

// This is called everytime a resource is deallocated (which happens when
// enif_release_resource is called and Erlang garbage collects the memory)
void db_res_destructor(ErlNifEnv *env, void *res) {
  db_free_conn((db_conn_t *) res);
}

int load(ErlNifEnv *env, void **priv_data, ERL_NIF_TERM load_info) {
  int flags = ERL_NIF_RT_CREATE | ERL_NIF_RT_TAKEOVER;
  DB_RES_TYPE = enif_open_resource_type(env, NULL, "db", db_res_destructor, flags, NULL);
}
```

#### Creating the resource

We can now wrap `db_init_conn` and create our resource.

```c
static ERL_NIF_TERM db_init_conn_nif(ErlNifEnv *env, int argc, const ERL_NIF_TERM argv[]) {
  db_conn_t *conn = db_init_conn();

  // Now, let's allocate the memory for a db_conn_t * pointer
  db_conn_t **conn_res = enif_alloc_memory(DB_RES_TYPE, sizeof(db_conn_t *));

  // Now, we should copy the `conn` pointer into `conn_res`
  memcpy((void *) conn_res, (void *) &conn, sizeof(db_conn_t *));

  // We can now make the Erlang term that holds the resource...
  ERL_NIF_TERM term = enif_make_resource(env, conn_res);
  // ...and release the resource so that it will be freed when Erlang garbage collects
  enif_release_resource(conn_res);

  return term;
}
```

### Retrieving the resource

In order to wrap `db_query`, we'll need to retrieve the resource that we returned in `db_init_conn_nif`. To do that, we'll use `enif_get_resource`.

```c
static ERL_NIF_TERM db_query_nif(ErlNifEnv *env, int argc, const ERL_NIF_TERM argv[]) {
  db_conn_t **conn_res;
  enif_get_resource(env, argv[0], DB_RES_TYPE, (void *) &conn_res);

  db_conn_t *conn = *conn_res;

  // We can now run our query
  db_type query_result = db_query(conn, ...);

  return argv[0];
}
```

### Using resources in Elixir

Let's skip the part where we export the NIFs we created to a `DB` module and jump right into IEx, assuming the C code is compiled and loaded by `DB`. As I mentioned above, resources are completely opaque terms when returned to Erlang/Elixir. They're represented as empty binaries.

```elixir
iex> conn_res = DB.db_conn_init()
""
iex> DB.db_query(conn_res, ...)
...
```

Since resources are opaque, you can't really do anything with them in Erlang/Elixir other than passing them back to other NIFs. They act and look like binaries, and this can even cause problems because they can be mistaken for just binaries. For this reason, my advice is to wrap resources inside structs. This way, we can only pass structs around in our public API, and handle resources internally. We also get the benefit of being able to implement the `Inspect` protocol for structs, which means we can safely inspect resources, hiding the fact that they look like empty binaries.

```elixir
defmodule DBConn do
  defstruct [:resource]

  defimpl Inspect do
    # ...
  end
end
```

## Compiling with Mix

TODO

## Conclusion

TODO


[docs-erlang-load_nif-2]: http://www.erlang.org/doc/man/erlang.html#load_nif-2
[devinus-markdown]: https://github.com/devinus/markdown

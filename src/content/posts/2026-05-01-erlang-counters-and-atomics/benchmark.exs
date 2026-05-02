Mix.install([
  {:benchee, "~> 1.1"},
  {:benchee_json, "~> 1.0"}
])

defmodule Benchmark do
  @increments_per_writer 10_000

  def run_concurrent(_num_writers = 1, mod, fun, args) do
    for _ <- 1..@increments_per_writer, do: apply(mod, fun, args)
  end

  def run_concurrent(num_writers, mod, fun, args) do
    writer_tasks =
      for _ <- 1..num_writers do
        Task.async(fn ->
          for _ <- 1..@increments_per_writer, do: apply(mod, fun, args)
        end)
      end

    Task.await_many(writer_tasks, to_timeout(minute: 1))
  end

  def init_ets do
    ets_table = :ets.new(:bench_ets, [:public, :set, write_concurrency: true])
    :ets.insert(ets_table, {:counter, 0})
    ets_table
  end

  def init_atomics do
    :atomics.new(1, [])
  end

  def init_counters_atomic do
    :counters.new(1, [:atomics])
  end

  def init_counters_wc do
    :counters.new(1, [:write_concurrency])
  end

  def reset_ets(table) do
    :ets.update_element(table, :counter, {2, 0})
    table
  end

  def reset_atomics(ref) do
    :atomics.put(ref, 1, 0)
    ref
  end

  def reset_counters(ref) do
    :counters.put(ref, 1, 0)
    ref
  end
end

all_num_writers = [
  1,
  2,
  4,
  8,
  System.schedulers_online(),
  System.schedulers_online() * 2,
  System.schedulers_online() * 4,
  System.schedulers_online() * 8,
  System.schedulers_online() * 16,
  System.schedulers_online() * 32,
]

Benchee.run(
  %{
    "ETS update_counter" =>
      {fn {ets_table, num_writers} ->
         Benchmark.run_concurrent(num_writers, :ets, :update_counter, [ets_table, :counter, 1])
       end,
       before_scenario: fn num_writers -> {Benchmark.init_ets(), num_writers} end,
       before_each: fn {table, num_writers} -> {Benchmark.reset_ets(table), num_writers} end},
    ":atomics" =>
      {fn {atomics_ref, num_writers} ->
         Benchmark.run_concurrent(num_writers, :atomics, :add, [atomics_ref, 1, 1])
       end,
       before_scenario: fn num_writers -> {Benchmark.init_atomics(), num_writers} end,
       before_each: fn {ref, num_writers} -> {Benchmark.reset_atomics(ref), num_writers} end},
    ":counters (atomics)" =>
      {fn {counters_atomic_ref, num_writers} ->
         Benchmark.run_concurrent(num_writers, :counters, :add, [counters_atomic_ref, 1, 1])
       end,
       before_scenario: fn num_writers -> {Benchmark.init_counters_atomic(), num_writers} end,
       before_each: fn {ref, num_writers} -> {Benchmark.reset_counters(ref), num_writers} end},
    ":counters (write_concurrency)" =>
      {fn {counters_wc_ref, num_writers} ->
         Benchmark.run_concurrent(num_writers, :counters, :add, [counters_wc_ref, 1, 1])
       end,
       before_scenario: fn num_writers -> {Benchmark.init_counters_wc(), num_writers} end,
       before_each: fn {ref, num_writers} -> {Benchmark.reset_counters(ref), num_writers} end}
  },
  time: 5,
  warmup: 1,
  memory_time: 0,
  inputs: Enum.map(all_num_writers, &{"#{&1} writer(s)", &1}),
  formatters: [
    {Benchee.Formatters.JSON, file: Path.absname("benchmark.json", __DIR__)},
    Benchee.Formatters.Console]
)

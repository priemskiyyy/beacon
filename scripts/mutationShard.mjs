export const selectMutationShard = (mutants, value) => {
  if (value === undefined) {
    return mutants;
  }

  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(value);

  if (match === null) {
    throw new Error("MUTATION_SHARD must name a shard such as 1/8.");
  }

  const index = parseInt(match[1], 10);
  const total = parseInt(match[2], 10);

  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(total)) {
    throw new Error("Mutation shard numbers must be safe integers.");
  }

  if (index > total) {
    throw new Error("The mutation shard index exceeds the shard count.");
  }

  if (total > mutants.length) {
    throw new Error(
      "Mutation shards cannot exceed the selected mutation count.",
    );
  }

  return mutants.filter((_, position) => position % total === index - 1);
};

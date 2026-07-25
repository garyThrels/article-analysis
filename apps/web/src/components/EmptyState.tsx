interface Props {
  loading?: boolean;
  hasQuery?: boolean;
}

export function EmptyState({ loading, hasQuery }: Props) {
  return (
    <p>
      {loading
        ? "We are loading your articles."
        : hasQuery
          ? "Could not find any articles for your query."
          : "No articles yet."}
    </p>
  );
}

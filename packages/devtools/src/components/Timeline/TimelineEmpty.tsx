import { assertUnreachable } from "src/utils/assertUnreachable";

type EmptyVariant = "NO_MATCHES" | "PAUSED" | "WAITING";

type TimelineEmptyProps = {
  isFiltered: boolean;
  isPaused: boolean;
  onClearFilters: () => void;
};

const getVariant = (isFiltered: boolean, isPaused: boolean): EmptyVariant => {
  if (isFiltered) {
    return "NO_MATCHES";
  }

  if (isPaused) {
    return "PAUSED";
  }

  return "WAITING";
};

/** Explains why no rows show: filters hide them, recording is paused, or nothing happened yet. */
export const TimelineEmpty = (props: TimelineEmptyProps) => (
  <>
    {(() => {
      const variant = getVariant(props.isFiltered, props.isPaused);

      if (variant === "NO_MATCHES") {
        return (
          <>
            <strong>No matching events</strong>
            <p>Try another search, or show all routes and types.</p>
            <button type="button" onClick={() => props.onClearFilters()}>
              Clear filters
            </button>
          </>
        );
      }

      if (variant === "PAUSED") {
        return (
          <>
            <strong>Recording paused</strong>
            <p>Your application keeps running. Resume to capture new events.</p>
          </>
        );
      }

      if (variant === "WAITING") {
        return (
          <>
            <strong>Waiting for events</strong>
            <p>
              Sessions, reads, checks and commands appear here as your
              application runs. Nothing is replayed from before the panel
              mounted.
            </p>
          </>
        );
      }

      return assertUnreachable(variant);
    })()}
  </>
);

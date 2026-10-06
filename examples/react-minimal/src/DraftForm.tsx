import { useDisruption } from "@priemskiyyy/beacon-react";
import { useState } from "react";

export const DraftForm = () => {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("");

  useDisruption({
    name: "note",
    reserve: () => {
      if (text !== saved) {
        return { status: "blocked", code: "unsaved-note" };
      }

      return { status: "reserved" };
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(text);
      }}
    >
      <textarea
        aria-label="Note"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <button type="submit">Save</button>
    </form>
  );
};

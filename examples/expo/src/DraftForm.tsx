import { useDisruption } from "@priemskiyyy/beacon-react";
import { useState } from "react";
import { Button, TextInput, View } from "react-native";

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
    <View>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Write a note"
      />
      <Button title="Save" onPress={() => setSaved(text)} />
    </View>
  );
};

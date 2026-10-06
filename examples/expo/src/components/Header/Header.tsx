import { useObservable, useBeaconStatus } from "@priemskiyyy/beacon-react";
import type React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import { SESSION_TONES } from "example-shared/ui/constants/tones";
import { Badge } from "src/components/Badge/Badge";
import { Button } from "src/components/Button/Button";

type HeaderProps = { lab: ReleaseLab };

export const Header: React.FunctionComponent<HeaderProps> = ({ lab }) => {
  const { state } = useBeaconStatus();
  const { number } = useObservable(lab.boot);

  return (
    <View style={styles.header}>
      <Text style={styles.title}>Release lab</Text>
      <Badge tone={SESSION_TONES[state]}>{`session ${state}`}</Badge>
      <Badge tone="neutral">{`document ${number}`}</Badge>
      <View style={styles.reset}>
        <Button
          label="Reset demo"
          variant="ghost"
          onPress={lab.controls.reset}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#18181b" },
  reset: { marginLeft: "auto" },
});

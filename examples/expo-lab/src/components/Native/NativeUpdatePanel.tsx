import type { CommandOutcome } from "@priemskiyyy/beacon";
import { useObservable } from "@priemskiyyy/beacon-react";
import type React from "react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatOutcome } from "example-shared/formatting/formatOutcome";
import { formatRelease } from "example-shared/formatting/formatRelease";
import { OUTCOME_TONES } from "example-shared/ui/constants/tones";
import { Badge } from "src/components/Badge/Badge";
import { Button } from "src/components/Button/Button";
import { Panel } from "src/components/Panel/Panel";
import type { NativeBeacon } from "src/lab/types/NativeBeacon";

type NativeUpdatePanelProps = { beacon: NativeBeacon };

export const NativeUpdatePanel: React.FunctionComponent<
  NativeUpdatePanelProps
> = ({ beacon }) => {
  const ota = beacon.route("ota");
  const { observation, prepared } = useObservable(ota.state);

  const [outcome, setOutcome] = useState<CommandOutcome<{
    kind: string;
  }> | null>(null);

  const handleDownloadPress = async () => {
    if (observation.status !== "available") {
      return;
    }

    setOutcome(await ota.download({ offer: observation.offer.ref }));
  };

  const handleReloadPress = async () => {
    if (prepared.status !== "ready") {
      return;
    }

    setOutcome(await ota.reload({ prepared: prepared.value.ref }));
  };

  return (
    <Panel
      title="Update"
      shows="Download prepares an update the provider may select on a later start; reload restarts the JavaScript runtime. Neither claims what runs."
    >
      <Text testID="offer" style={styles.detail}>
        {observation.status === "available"
          ? `On offer: ${formatRelease(observation.offer.release)} (${observation.offer.kind})`
          : "Nothing on offer."}
      </Text>
      <Text testID="prepared" style={styles.detail}>
        {prepared.status === "ready"
          ? `Prepared: ${formatRelease(prepared.value.release)}`
          : `Prepared: ${prepared.status}`}
      </Text>
      <View style={styles.actions}>
        <Button
          label="Download"
          disabled={observation.status !== "available"}
          onPress={handleDownloadPress}
        />
        <Button
          label="Reload"
          variant="ghost"
          disabled={prepared.status !== "ready"}
          onPress={handleReloadPress}
        />
        <Button
          label="Check again"
          variant="ghost"
          onPress={() => beacon.check({ reason: "manual" })}
        />
      </View>
      {outcome === null ? null : (
        <View style={styles.outcome}>
          <Badge tone={OUTCOME_TONES[outcome.status]}>{outcome.status}</Badge>
          <Text testID="outcome" style={styles.detail}>
            {formatOutcome(outcome)}
          </Text>
        </View>
      )}
    </Panel>
  );
};

const styles = StyleSheet.create({
  detail: { fontSize: 13, color: "#52525b" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  outcome: { flexDirection: "column", alignItems: "flex-start", gap: 6 },
});

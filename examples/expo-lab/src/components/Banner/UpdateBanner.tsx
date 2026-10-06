import type { CommandOutcome } from "@priemskiyyy/beacon";
import { useBeacon, useRoute, useSupport } from "@priemskiyyy/beacon-react";
import type React from "react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatOutcome } from "example-shared/formatting/formatOutcome";
import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import { OUTCOME_TONES } from "example-shared/ui/constants/tones";
import { Badge } from "src/components/Badge/Badge";
import { Button } from "src/components/Button/Button";
import { Panel } from "src/components/Panel/Panel";
import { describeBanner } from "example-shared/lab/utils/describeBanner";

type UpdateBannerProps = { lab: ReleaseLab };

export const UpdateBanner: React.FunctionComponent<UpdateBannerProps> = ({
  lab,
}) => {
  const beacon = useBeacon();
  const { observation, check, operation } = useRoute("web");
  const support = useSupport();

  const [outcome, setOutcome] = useState<CommandOutcome<{
    kind: string;
  }> | null>(null);

  const { headline, detail } = describeBanner({ observation, support });

  const handleUpdatePress = async () => {
    if (observation.status !== "available") {
      return;
    }

    setOutcome(
      await beacon.route("web").reload({ offer: observation.offer.ref }),
    );
  };

  return (
    <Panel
      title="Update banner"
      shows="The offer, the forced state of an unsupported build, and the outcome of the request a person made."
    >
      <View style={styles.banner}>
        <Text testID="banner-headline" style={styles.headline}>
          {headline}
        </Text>
        <Text style={styles.detail}>{detail}</Text>
        {check.state === "failed" ? (
          <Text testID="banner-inconclusive" style={styles.warning}>
            {`Inconclusive: the last check failed (${check.error.code}).`}
          </Text>
        ) : null}
        {operation.state === "indeterminate" ? (
          <Text testID="banner-unresolved" style={styles.warning}>
            The reload was requested and the navigation has not happened.
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        {observation.status === "available" ? (
          <Button label="Update" onPress={handleUpdatePress} />
        ) : null}
        <Button
          label="Check again"
          variant="ghost"
          disabled={check.state === "checking"}
          onPress={() => lab.controls.check("manual")}
        />
        {operation.state === "indeterminate" ? (
          <Button
            label="Continue in this build"
            variant="ghost"
            onPress={() => beacon.route("web").acknowledge()}
          />
        ) : null}
      </View>
      <View style={styles.outcome}>
        {outcome === null ? (
          <Text testID="outcome" style={styles.detail}>
            No update requested yet.
          </Text>
        ) : (
          <>
            <Badge tone={OUTCOME_TONES[outcome.status]}>{outcome.status}</Badge>
            <Text testID="outcome" style={styles.detail}>
              {formatOutcome(outcome)}
            </Text>
          </>
        )}
      </View>
    </Panel>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "column",
    gap: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e4e4e7",
  },
  headline: { fontSize: 16, fontWeight: "700", color: "#18181b" },
  detail: { fontSize: 13, color: "#52525b" },
  warning: { fontSize: 13, color: "#92400e" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  outcome: { flexDirection: "column", alignItems: "flex-start", gap: 6 },
});

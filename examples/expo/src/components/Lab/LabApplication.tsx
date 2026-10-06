import { BeaconProvider, useObservable } from "@priemskiyyy/beacon-react";
import type React from "react";
import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import { UpdateBanner } from "src/components/Banner/UpdateBanner";
import { Header } from "src/components/Header/Header";
import { SimulationPanel } from "src/components/Simulation/SimulationPanel";
import { StatusPanel } from "src/components/Status/StatusPanel";
import { TimelinePanel } from "src/components/Timeline/TimelinePanel";
import { TransitionsPanel } from "src/components/Transitions/TransitionsPanel";

type LabApplicationProps = { lab: ReleaseLab; runtime: string };

export const LabApplication: React.FunctionComponent<LabApplicationProps> = ({
  lab,
  runtime,
}) => {
  const { number, beacon } = useObservable(lab.boot);

  // Effects run children first, so the provider has opened the session before the startup check asks for it.
  useEffect(() => {
    lab.controls.check("startup");
  }, [lab, beacon]);

  return (
    // A new document is a new tree, as a launch would be.
    <BeaconProvider key={number} beacon={beacon}>
      <View style={styles.root}>
        <Header lab={lab} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.intro}>
            One Beacon holds the build this app runs, what a scripted release
            service wants, and a request to reload. Publish, break and expire
            the service, then boot the next document.
          </Text>
          <StatusPanel runtime={runtime} />
          <UpdateBanner lab={lab} />
          <SimulationPanel lab={lab} />
          <TransitionsPanel />
          <TimelinePanel lab={lab} />
        </ScrollView>
      </View>
    </BeaconProvider>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fafafa" },
  content: { flexDirection: "column", gap: 16, padding: 16 },
  intro: { fontSize: 13, color: "#52525b" },
});

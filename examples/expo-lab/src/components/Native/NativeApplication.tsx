import type { BeaconDiagnosticEvent } from "@priemskiyyy/beacon";
import { checkOn, foreground } from "@priemskiyyy/beacon/triggers";
import type React from "react";
import { useEffect } from "react";
import { AppState, ScrollView, StyleSheet, Text, View } from "react-native";

import type { EventLog } from "example-shared/types/EventLog";
import { NativeStatusPanel } from "src/components/Native/NativeStatusPanel";
import { NativeTimelinePanel } from "src/components/Native/NativeTimelinePanel";
import { NativeUpdatePanel } from "src/components/Native/NativeUpdatePanel";
import type { NativeBeacon } from "src/lab/types/NativeBeacon";

type NativeApplicationProps = {
  beacon: NativeBeacon;
  diagnostics: EventLog<BeaconDiagnosticEvent>;
  runtime: string;
};

// The registered hooks and the provider are typed for the lab's Beacon, whose routes this one does not have, so this tree passes its own Beacon down and reads it with `useObservable`.
export const NativeApplication: React.FunctionComponent<
  NativeApplicationProps
> = ({ beacon, diagnostics, runtime }) => {
  useEffect(() => {
    const stop = beacon.start();

    // Only a trip through the background is a return: on iOS a system dialog is inactive and back to active.
    const stopChecking = checkOn(beacon, {
      triggers: [foreground({ appState: AppState })],
    });

    return () => {
      stopChecking();
      stop();
    };
  }, [beacon]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Release lab</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          One Beacon over Expo Updates: the provider checks, downloads and
          reloads, and the manifest of the application&apos;s own backend
          decides support. Expo Go and development builds cannot check, and
          Beacon says so.
        </Text>
        <NativeStatusPanel beacon={beacon} runtime={runtime} />
        <NativeUpdatePanel beacon={beacon} />
        <NativeTimelinePanel diagnostics={diagnostics} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fafafa" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#18181b" },
  content: { flexDirection: "column", gap: 16, padding: 16 },
  intro: { fontSize: 13, color: "#52525b" },
});

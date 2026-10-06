import { useBeacon } from "@priemskiyyy/beacon-solid";
import { onMount } from "solid-js";
import type { Component } from "solid-js";

import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import { UpdateBanner } from "src/components/Banner/UpdateBanner";
import { Footer } from "src/components/Footer/Footer";
import { Header } from "src/components/Header/Header";
import { Hero } from "src/components/Hero/Hero";
import { Section } from "src/components/Section/Section";
import { SimulationPanel } from "src/components/Simulation/SimulationPanel";
import { ApplicationPanel } from "src/components/Status/ApplicationPanel";
import { RoutePanel } from "src/components/Status/RoutePanel";
import { TimelinePanel } from "src/components/Timeline/TimelinePanel";
import { TransitionsPanel } from "src/components/Transitions/TransitionsPanel";

type DocumentProps = { lab: ReleaseLab };

/** The page of one document: everything below the provider, which a new document replaces. */
export const Document: Component<DocumentProps> = (props) => {
  const beacon = useBeacon();

  // The provider starts the session before any child mounts, so the startup check finds it running.
  onMount(() => {
    beacon().check({ reason: "startup" });
  });

  return (
    <>
      <Header lab={props.lab} />
      <main class="mx-auto flex max-w-7xl flex-col gap-16 px-4 py-8 sm:px-6">
        <Hero />
        <Section
          id="status"
          hint="Load the page: the session runs, the startup check finds the build you run named as current, and support is supported. Every fact says what it knows and no more."
        >
          <div class="grid items-start gap-4 lg:grid-cols-2">
            <RoutePanel />
            <ApplicationPanel />
          </div>
        </Section>
        <Section
          id="update"
          hint="Publish a newer build in the simulation and check: the banner offers it. Update asks for a reload, which is a request; the running build changes only when the next document boots."
        >
          <UpdateBanner />
        </Section>
        <Section
          id="simulation"
          hint="Tick Unsaved draft, publish a build, check and press Update: the draft blocks it. Save the draft and press Update again. Publish a required build to see the forced state."
        >
          <SimulationPanel lab={props.lab} />
        </Section>
        <Section
          id="timeline"
          hint="After Update, press Boot the new build: the next document reads the journal and says whether it runs the build the reload aimed at. Turn on Deployment lags first to see it say no."
        >
          <div class="grid items-start gap-4 lg:grid-cols-2">
            <TransitionsPanel />
            <TimelinePanel lab={props.lab} />
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
};

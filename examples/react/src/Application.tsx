import { BeaconProvider, useObservable } from "@priemskiyyy/beacon-react";
import type React from "react";
import { useEffect } from "react";

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

type ApplicationProps = { lab: ReleaseLab };

export const Application: React.FunctionComponent<ApplicationProps> = ({
  lab,
}) => {
  const { number, beacon } = useObservable(lab.boot);

  // Effects run children first, so the provider has opened the session before the startup check asks for it.
  useEffect(() => {
    lab.controls.check("startup");
  }, [lab, beacon]);

  return (
    // A new document is a new tree, as a page load would be.
    <BeaconProvider key={number} beacon={beacon}>
      <Header lab={lab} />
      <main className="mx-auto flex max-w-7xl flex-col gap-16 px-4 py-8 sm:px-6">
        <Hero />
        <Section
          id="status"
          hint="Load the page: the session runs, the startup check finds the build you run named as current, and support is supported. Every fact says what it knows and no more."
        >
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <RoutePanel />
            <ApplicationPanel />
          </div>
        </Section>
        <Section
          id="update"
          hint="Publish a newer build in the simulation and check: the banner offers it. Update asks for a reload, which is a request; the running build changes only when the next document boots."
        >
          <UpdateBanner lab={lab} />
        </Section>
        <Section
          id="simulation"
          hint="Tick Unsaved draft, publish a build, check and press Update: the draft blocks it. Save the draft and press Update again. Publish a required build to see the forced state."
        >
          <SimulationPanel lab={lab} />
        </Section>
        <Section
          id="timeline"
          hint="After Update, press Boot the new build: the next document reads the journal and says whether it runs the build the reload aimed at. Turn on Deployment lags first to see it say no."
        >
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <TransitionsPanel />
            <TimelinePanel lab={lab} />
          </div>
        </Section>
      </main>
      <Footer />
    </BeaconProvider>
  );
};

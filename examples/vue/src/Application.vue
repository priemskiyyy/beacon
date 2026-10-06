<script setup lang="ts">
import { BeaconProvider, useObservable } from "@priemskiyyy/beacon-vue";
import { onMounted, watch } from "vue";

import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import UpdateBanner from "src/components/Banner/UpdateBanner.vue";
import AppFooter from "src/components/Footer/AppFooter.vue";
import AppHeader from "src/components/Header/AppHeader.vue";
import HeroSection from "src/components/Hero/HeroSection.vue";
import PageSection from "src/components/Section/PageSection.vue";
import SimulationPanel from "src/components/Simulation/SimulationPanel.vue";
import ApplicationPanel from "src/components/Status/ApplicationPanel.vue";
import RoutePanel from "src/components/Status/RoutePanel.vue";
import TimelinePanel from "src/components/Timeline/TimelinePanel.vue";
import TransitionsPanel from "src/components/Transitions/TransitionsPanel.vue";

type Props = { lab: ReleaseLab };

const props = defineProps<Props>();
const boot = useObservable(props.lab.boot);

const checkAtStartup = () => {
  props.lab.controls.check("startup");
};

// The provider opens the session before its children mount, and this runs after they have, so the startup check finds it.
onMounted(checkAtStartup);
watch(() => boot.value.beacon, checkAtStartup, { flush: "post" });
</script>

<template>
  <!-- A new document is a new tree, as a page load would be. -->
  <BeaconProvider :key="boot.number" :beacon="boot.beacon" start>
    <AppHeader :lab="lab" />
    <main class="mx-auto flex max-w-7xl flex-col gap-16 px-4 py-8 sm:px-6">
      <HeroSection />
      <PageSection
        id="status"
        hint="Load the page: the session runs, the startup check finds the build you run named as current, and support is supported. Every fact says what it knows and no more."
      >
        <div class="grid items-start gap-4 lg:grid-cols-2">
          <RoutePanel />
          <ApplicationPanel />
        </div>
      </PageSection>
      <PageSection
        id="update"
        hint="Publish a newer build in the simulation and check: the banner offers it. Update asks for a reload, which is a request; the running build changes only when the next document boots."
      >
        <UpdateBanner :lab="lab" />
      </PageSection>
      <PageSection
        id="simulation"
        hint="Tick Unsaved draft, publish a build, check and press Update: the draft blocks it. Save the draft and press Update again. Publish a required build to see the forced state."
      >
        <SimulationPanel :lab="lab" />
      </PageSection>
      <PageSection
        id="timeline"
        hint="After Update, press Boot the new build: the next document reads the journal and says whether it runs the build the reload aimed at. Turn on Deployment lags first to see it say no."
      >
        <div class="grid items-start gap-4 lg:grid-cols-2">
          <TransitionsPanel />
          <TimelinePanel :lab="lab" />
        </div>
      </PageSection>
    </main>
    <AppFooter />
  </BeaconProvider>
</template>

<script lang="ts">
  import { onMount } from "svelte";

  import UpdateBanner from "src/components/Banner/UpdateBanner.svelte";
  import Footer from "src/components/Footer/Footer.svelte";
  import Header from "src/components/Header/Header.svelte";
  import Hero from "src/components/Hero/Hero.svelte";
  import Section from "src/components/Section/Section.svelte";
  import SimulationPanel from "src/components/Simulation/SimulationPanel.svelte";
  import ApplicationPanel from "src/components/Status/ApplicationPanel.svelte";
  import RoutePanel from "src/components/Status/RoutePanel.svelte";
  import TimelinePanel from "src/components/Timeline/TimelinePanel.svelte";
  import TransitionsPanel from "src/components/Transitions/TransitionsPanel.svelte";
  import { useLab } from "src/hooks/useLab";

  const lab = useLab();

  // The provider opens the session before its children mount, so the startup check finds it running.
  onMount(() => {
    lab.controls.check("startup");
  });
</script>

<Header />
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
    <SimulationPanel />
  </Section>
  <Section
    id="timeline"
    hint="After Update, press Boot the new build: the next document reads the journal and says whether it runs the build the reload aimed at. Turn on Deployment lags first to see it say no."
  >
    <div class="grid items-start gap-4 lg:grid-cols-2">
      <TransitionsPanel />
      <TimelinePanel />
    </div>
  </Section>
</main>
<Footer />

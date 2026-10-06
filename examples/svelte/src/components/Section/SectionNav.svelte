<script lang="ts">
  import { navLinkStyles } from "example-shared/ui/styles/navLinkStyles";
  import { useCurrentSection } from "src/hooks/useCurrentSection.svelte";
  import { SECTION_IDS, SECTIONS } from "src/utils/constants/sections";
  import { scrollToElement } from "src/utils/scrollToElement";

  const current = useCurrentSection();
</script>

<nav aria-label="Explore the lab" class="flex gap-1 overflow-x-auto py-1">
  {#each SECTION_IDS as id (id)}
    <button
      type="button"
      aria-current={current.current === id ? "location" : undefined}
      onclick={() => scrollToElement(id)}
      class={navLinkStyles({ current: current.current === id })}
    >
      {SECTIONS[id].label}
    </button>
  {/each}
</nav>

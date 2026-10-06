<script lang="ts">
  import { untrack } from "svelte";
  import { useRoute } from "../utilities/useRoute.js";
  import { useRunning } from "../utilities/useRunning.js";

  type Props = {
    seen?: string[] | undefined;
  };

  const props: Props = $props();

  const observation = useRoute("web", ({ observation }) => observation.status);
  const running = useRunning(({ web }) => web.state);

  // What the first render read, which is what hydration has to match.
  untrack(() => props.seen)?.push(`${observation.current}/${running.current}`);
</script>

<span>{observation.current}/{running.current}</span>

---
description: "probe"
---

# Probe

```vue
<!-- src/Child.vue -->
<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <h1>{{ title }}</h1>
  <slot :item="{ id: 1 }" />
</template>
```

```vue
<!-- src/Parent.vue -->
<script setup lang="ts">
import { computed, ref } from "vue";

import Child from "src/Child.vue";

const count = ref(0);
const items = ref([{ id: 1, name: "a" }]);
const record = { a: 1, b: 2 };
const kind = computed(() => (count.value > 1 ? "many" : "few"));
const text = ref("");
</script>

<template>
  <Child title="x" v-slot="{ item }">
    <p v-if="kind === 'many'">{{ item.id.toFixed(1) }}</p>
    <p v-else-if="kind === 'few'" :class="{ on: count > 0 }">few</p>
    <p v-else>none</p>
  </Child>
  <child title="y" />
  <ul>
    <li v-for="{ id, name } in items" :key="id" @click="count++; text = name">{{ name.toUpperCase() }}</li>
    <li v-for="(value, key, index) in record" :key="key">{{ key }} {{ value.toFixed(0) }} {{ index.toFixed(0) }}</li>
    <li v-for="n in 3" :key="n">{{ n.toFixed(0) }}</li>
  </ul>
  <input v-model.trim="text" @input="($event: Event) => console.log($event)" />
  <button @click="count = count + 1">{{ count }}</button>
</template>
```

<script setup lang="ts">
defineProps<{ titulo: string }>();
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-xl font-semibold tracking-tight">{{ titulo }}</h1>
    <div class="flex items-center gap-2">
      <slot />
    </div>
  </header>
</template>

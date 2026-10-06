<script setup lang="ts">
import { Badge } from "@/components/ui/badge";

defineProps<{ titulo: string; quantidade: number }>();
</script>

<template>
  <section class="grid gap-3 rounded-xl bg-muted/50 p-3" :aria-label="titulo">
    <header class="flex items-center justify-between px-1">
      <h2 class="text-sm font-semibold">{{ titulo }}</h2>
      <Badge variant="secondary" class="tabular-nums">{{ quantidade }}</Badge>
    </header>
    <div class="grid gap-2">
      <slot />
      <p v-if="quantidade === 0" class="px-1 py-2 text-sm text-muted-foreground">Nenhum capítulo aqui.</p>
    </div>
  </section>
</template>

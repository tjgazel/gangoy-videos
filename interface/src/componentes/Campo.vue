<script setup lang="ts">
// Rótulo + controle (Input, Textarea…) no mesmo <label>, com a dica opcional embaixo.
import { Label } from "@/components/ui/label";

defineProps<{ rotulo: string }>();
</script>

<template>
  <Label class="grid items-stretch gap-2 font-normal leading-normal">
    <span class="font-medium">{{ rotulo }}</span>
    <slot />
    <small v-if="$slots.dica" class="text-xs font-normal text-muted-foreground"><slot name="dica" /></small>
  </Label>
</template>

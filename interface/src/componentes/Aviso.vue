<script setup lang="ts">
import { Toaster } from "@/components/ui/sonner";
import { usarModoTema } from "../estado/usarModoTema";

const { modo } = usarModoTema();
</script>

<template>
  <Toaster rich-colors position="bottom-right" container-aria-label="Avisos" :theme="modo === 'auto' ? 'system' : modo" />
</template>

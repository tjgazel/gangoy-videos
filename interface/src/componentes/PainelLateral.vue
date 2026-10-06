<script setup lang="ts">
import { X } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

defineProps<{ aberto: boolean; titulo: string }>();
const emitir = defineEmits<{ fechar: [] }>();
</script>

<template>
  <Sheet :open="aberto" @update:open="(valor: boolean) => !valor && emitir('fechar')">
    <SheetContent side="right" class="overflow-y-auto sm:max-w-md" :show-close-button="false" :aria-describedby="undefined">
      <SheetHeader class="flex-row items-center justify-between">
        <SheetTitle>{{ titulo }}</SheetTitle>
        <SheetClose as-child>
          <Button variant="ghost" size="icon-sm" aria-label="Fechar"><X /></Button>
        </SheetClose>
      </SheetHeader>
      <div class="px-4 pb-4">
        <slot />
      </div>
    </SheetContent>
  </Sheet>
</template>

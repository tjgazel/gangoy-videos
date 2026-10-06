<script setup lang="ts">
import { Cpu, HardDrive } from "@lucide/vue";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usarStatusSistema } from "../estado/usarStatusSistema";
import IndicadorFila from "./IndicadorFila.vue";
import SeletorProjeto from "./SeletorProjeto.vue";

const { status } = usarStatusSistema();
</script>

<template>
  <header class="flex h-14 shrink-0 items-center gap-2 border-b px-4">
    <SidebarTrigger aria-label="Alternar barra lateral" class="-ml-1" />
    <Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center" />
    <SeletorProjeto v-if="status?.workspace.disponivel" />
    <span class="flex-1"></span>
    <IndicadorFila v-if="status?.workspace.disponivel" />
    <template v-if="status">
      <Tooltip>
        <TooltipTrigger as-child>
          <span
            role="img"
            tabindex="0"
            :aria-label="status.ollama.online ? 'Ollama online' : 'Ollama fora do ar'"
            :class="status.ollama.online ? 'text-green-600 dark:text-green-400' : 'text-destructive'"
          >
            <Cpu class="size-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent>{{ status.ollama.online ? "Ollama online" : "Ollama fora do ar" }}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger as-child>
          <span
            role="img"
            tabindex="0"
            :aria-label="status.workspace.disponivel ? 'Workspace disponível' : 'Workspace não encontrada'"
            :class="status.workspace.disponivel ? 'text-green-600 dark:text-green-400' : 'text-destructive'"
          >
            <HardDrive class="size-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent>{{ status.workspace.disponivel ? "Workspace disponível" : "Workspace não encontrada" }}</TooltipContent>
      </Tooltip>
    </template>
  </header>
</template>

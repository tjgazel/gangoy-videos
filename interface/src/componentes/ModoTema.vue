<script setup lang="ts">
import { Monitor, Moon, Sun } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usarModoTema } from "../estado/usarModoTema";

const { modo } = usarModoTema();
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="icon" aria-label="Tema">
        <Sun class="dark:hidden" />
        <Moon class="hidden dark:block" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem @click="modo = 'light'"><Sun /> Claro</DropdownMenuItem>
      <DropdownMenuItem @click="modo = 'dark'"><Moon /> Escuro</DropdownMenuItem>
      <DropdownMenuItem @click="modo = 'auto'"><Monitor /> Sistema</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

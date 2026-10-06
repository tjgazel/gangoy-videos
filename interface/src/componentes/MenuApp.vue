<script setup lang="ts">
import { BookOpen, Clapperboard, ClipboardCheck, Film, FolderKanban, Settings } from "@lucide/vue";
import { useRoute } from "vue-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import ModoTema from "./ModoTema.vue";

const rota = useRoute();

const itens = [
  { rota: "/producao", texto: "Produção", icone: Clapperboard },
  { rota: "/revisao", texto: "Revisão", icone: ClipboardCheck },
  { rota: "/dossie", texto: "Dossiê", icone: BookOpen },
  { rota: "/projetos", texto: "Projetos", icone: FolderKanban },
  { rota: "/configuracoes", texto: "Configurações", icone: Settings },
];

// "/capitulos/3" pertence à Produção.
function ativo(destino: string): boolean {
  if (destino === "/producao") return rota.path.startsWith("/producao") || rota.path.startsWith("/capitulos");
  return rota.path.startsWith(destino);
}
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" as-child>
            <RouterLink to="/producao">
              <Film />
              <span class="font-semibold">Gangoy Vídeos</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupContent>
          <nav aria-label="Menu principal">
            <SidebarMenu>
              <SidebarMenuItem v-for="item in itens" :key="item.rota">
                <SidebarMenuButton as-child :is-active="ativo(item.rota)" :tooltip="item.texto">
                  <RouterLink :to="item.rota">
                    <component :is="item.icone" />
                    <span>{{ item.texto }}</span>
                  </RouterLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </nav>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <ModoTema />
    </SidebarFooter>
  </Sidebar>
</template>

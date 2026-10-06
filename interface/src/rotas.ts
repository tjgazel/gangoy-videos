import { createRouter, createWebHistory } from "vue-router";

export const rotas = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/producao" },
    { path: "/boas-vindas", component: () => import("./telas/TelaBoasVindas.vue") },
    { path: "/producao", component: () => import("./telas/TelaProducao.vue") },
    { path: "/producao/planejamento", component: () => import("./telas/TelaPlanejamento.vue") },
    { path: "/capitulos/:numero", component: () => import("./telas/TelaCapitulo.vue") },
    { path: "/revisao", component: () => import("./telas/TelaRevisao.vue") },
    { path: "/dossie", component: () => import("./telas/TelaDossie.vue") },
    { path: "/projetos", component: () => import("./telas/TelaProjetos.vue") },
    { path: "/configuracoes", component: () => import("./telas/TelaConfiguracoes.vue") },
  ],
});

// Sem workspace configurada, qualquer tela leva às boas-vindas.
rotas.beforeEach(async (destino) => {
  if (destino.path === "/boas-vindas") return true;
  const { usarStatusSistema } = await import("./estado/usarStatusSistema");
  try {
    const status = await usarStatusSistema().garantirCarregado();
    if (!status.workspace.configurada) return "/boas-vindas";
  } catch {
    // Servidor fora do ar: deixa a tela abrir e mostrar o erro.
  }
  return true;
});

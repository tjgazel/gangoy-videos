import { createApp } from "vue";
import App from "./App.vue";
import { rotas } from "./rotas";
import "./estilos/global.css";
import "./estilos/temas.css";
import "./estilos/base.css";
import "./estado/compatTema";

createApp(App).use(rotas).mount("#app");

import { createApp } from "vue";
import App from "./App.vue";
import { rotas } from "./rotas";
import "./estilos/temas.css";
import "./estilos/base.css";

createApp(App).use(rotas).mount("#app");

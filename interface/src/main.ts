import { createApp } from "vue";
import App from "./App.vue";
import { rotas } from "./rotas";
import "./estilos/global.css";

createApp(App).use(rotas).mount("#app");

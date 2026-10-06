import { createApp } from "vue";
import App from "./App.vue";
import { rotas } from "./rotas";
import "vue-sonner/style.css";
import "./estilos/global.css";

createApp(App).use(rotas).mount("#app");

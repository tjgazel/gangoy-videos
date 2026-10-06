import { criarApp } from "./app.js";
import { obterOpcoesExecucao } from "../nucleo/opcoesExecucao.js";

// npm run dev passa --desenvolvimento para aceitar a interface servida pelo Vite.
const app = await criarApp({ desenvolvimento: process.argv.includes("--desenvolvimento") });
await app.listen({ port: obterOpcoesExecucao().porta, host: "127.0.0.1" });

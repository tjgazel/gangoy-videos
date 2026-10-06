import { criarApp } from "./app.js";
import { obterOpcoesExecucao } from "../nucleo/opcoesExecucao.js";

const app = await criarApp();
await app.listen({ port: obterOpcoesExecucao().porta, host: "127.0.0.1" });

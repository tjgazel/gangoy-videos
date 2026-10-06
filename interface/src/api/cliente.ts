// Chamada à API do servidor. Erro vira Error com a mensagem em pt-BR que o servidor mandou.
export async function chamarApi<T>(
  caminho: string,
  opcoes: { metodo?: "GET" | "POST" | "PUT" | "DELETE"; corpo?: unknown } = {},
): Promise<T> {
  const resposta = await fetch(caminho, {
    method: opcoes.metodo ?? "GET",
    headers: opcoes.corpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  });
  if (resposta.status === 204) return undefined as T;
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error((dados as { erro?: string }).erro ?? `Erro ${resposta.status}`);
  return dados as T;
}

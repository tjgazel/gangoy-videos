import { createHash, randomBytes } from "node:crypto";
import { obterBanco } from "../banco/banco.js";
import { lerCredenciaisCompletasYoutube } from "../configuracoes/youtube.js";
import { obterOpcoesExecucao } from "../nucleo/opcoesExecucao.js";
import { ErroAplicacao } from "../nucleo/erros.js";

const URL_AUTORIZACAO = "https://accounts.google.com/o/oauth2/v2/auth";
const URL_TOKEN = "https://oauth2.googleapis.com/token";
const URL_REVOGAR = "https://oauth2.googleapis.com/revoke";
const URL_CANAIS = "https://www.googleapis.com/youtube/v3/channels";

// upload: envio de vídeos. force-ssl: legendas, playlists e edição dos vídeos do canal.
const ESCOPOS = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

const VALIDADE_PEDIDO_MS = 10 * 60 * 1000;
// Renova o token um pouco antes de vencer, para não falhar no meio de um upload.
const FOLGA_RENOVACAO_MS = 60 * 1000;

export interface ContaYoutube {
  idCanal: string;
  tituloCanal: string;
  conectadoEm: string;
}

interface LinhaConta {
  id_canal: string;
  titulo_canal: string;
  token_acesso: string;
  token_atualizacao: string;
  token_expira_em: string;
  conectado_em: string;
}

interface RespostaToken {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

// Pedidos de conexão em andamento: state -> verificador PKCE. Ficam só na memória do servidor.
const pedidosPendentes = new Map<string, { verificador: string; criadoEm: number }>();

function base64Url(dados: Buffer): string {
  return dados.toString("base64url");
}

// Credencial "App para computador" aceita retorno em 127.0.0.1 sem cadastrar a URL no Google.
export function uriRetornoOAuth(): string {
  return `http://127.0.0.1:${obterOpcoesExecucao().porta}/api/youtube/oauth/retorno`;
}

function exigirCredenciais() {
  const credenciais = lerCredenciaisCompletasYoutube();
  if (!credenciais) {
    throw new ErroAplicacao(
      "Salve o Client ID e o Client Secret em Configurações antes de conectar uma conta.",
    );
  }
  return credenciais;
}

function limparPedidosVencidos(): void {
  const agora = Date.now();
  for (const [estado, pedido] of pedidosPendentes) {
    if (agora - pedido.criadoEm > VALIDADE_PEDIDO_MS) pedidosPendentes.delete(estado);
  }
}

// Monta a URL do Google para o usuário escolher a conta e o canal (PKCE + state).
export function iniciarConexaoYoutube(): string {
  const { clientId } = exigirCredenciais();
  limparPedidosVencidos();

  const estado = base64Url(randomBytes(24));
  const verificador = base64Url(randomBytes(48));
  const desafio = base64Url(createHash("sha256").update(verificador).digest());
  pedidosPendentes.set(estado, { verificador, criadoEm: Date.now() });

  const parametros = new URLSearchParams({
    client_id: clientId,
    redirect_uri: uriRetornoOAuth(),
    response_type: "code",
    scope: ESCOPOS.join(" "),
    // offline + consent: garante o refresh_token mesmo se a conta já autorizou antes.
    access_type: "offline",
    prompt: "consent select_account",
    state: estado,
    code_challenge: desafio,
    code_challenge_method: "S256",
  });
  return `${URL_AUTORIZACAO}?${parametros}`;
}

async function pedirToken(corpo: Record<string, string>): Promise<RespostaToken> {
  const resposta = await fetch(URL_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(corpo),
  });
  const dados = (await resposta.json().catch(() => ({}))) as RespostaToken & {
    error?: string;
    error_description?: string;
  };
  if (!resposta.ok) {
    const erro = new ErroAplicacao(
      `O Google recusou o pedido de token: ${dados.error_description || dados.error || resposta.status}`,
    );
    (erro as ErroAplicacao & { codigoGoogle?: string }).codigoGoogle = dados.error;
    throw erro;
  }
  return dados;
}

function calcularExpiracao(segundos: number): string {
  return new Date(Date.now() + segundos * 1000).toISOString();
}

// Recebe o retorno do Google: troca o código por tokens e grava um registro por canal.
export async function concluirConexaoYoutube(codigo: string, estado: string): Promise<ContaYoutube[]> {
  const pedido = pedidosPendentes.get(estado);
  pedidosPendentes.delete(estado);
  if (!pedido || Date.now() - pedido.criadoEm > VALIDADE_PEDIDO_MS) {
    throw new ErroAplicacao("Pedido de conexão inválido ou vencido. Clique em Conectar de novo.");
  }

  const { clientId, clientSecret } = exigirCredenciais();
  const token = await pedirToken({
    client_id: clientId,
    client_secret: clientSecret,
    code: codigo,
    code_verifier: pedido.verificador,
    grant_type: "authorization_code",
    redirect_uri: uriRetornoOAuth(),
  });
  if (!token.refresh_token) {
    throw new ErroAplicacao("O Google não devolveu o token de atualização. Tente conectar de novo.");
  }

  const resposta = await fetch(`${URL_CANAIS}?part=snippet&mine=true`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const dados = (await resposta.json().catch(() => ({}))) as {
    items?: { id: string; snippet?: { title?: string } }[];
    error?: { message?: string };
  };
  if (!resposta.ok) {
    throw new ErroAplicacao(`Não foi possível ler o canal: ${dados.error?.message ?? resposta.status}`);
  }
  const canais = dados.items ?? [];
  if (canais.length === 0) {
    throw new ErroAplicacao("A conta escolhida não tem canal no YouTube. Crie o canal e conecte de novo.");
  }

  const agora = new Date().toISOString();
  const gravar = obterBanco().prepare(`
    INSERT INTO contas_youtube (id_canal, titulo_canal, token_acesso, token_atualizacao, token_expira_em, conectado_em)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id_canal) DO UPDATE SET
      titulo_canal = excluded.titulo_canal,
      token_acesso = excluded.token_acesso,
      token_atualizacao = excluded.token_atualizacao,
      token_expira_em = excluded.token_expira_em,
      conectado_em = excluded.conectado_em
  `);
  for (const canal of canais) {
    gravar.run(
      canal.id,
      canal.snippet?.title ?? "",
      token.access_token,
      token.refresh_token,
      calcularExpiracao(token.expires_in),
      agora,
    );
  }

  return canais.map((canal) => ({
    idCanal: canal.id,
    tituloCanal: canal.snippet?.title ?? "",
    conectadoEm: agora,
  }));
}

export function listarContasYoutube(): ContaYoutube[] {
  const linhas = obterBanco()
    .prepare("SELECT * FROM contas_youtube ORDER BY titulo_canal")
    .all() as unknown as LinhaConta[];
  return linhas.map((linha) => ({
    idCanal: linha.id_canal,
    tituloCanal: linha.titulo_canal,
    conectadoEm: linha.conectado_em,
  }));
}

function lerConta(idCanal: string): LinhaConta | undefined {
  return obterBanco()
    .prepare("SELECT * FROM contas_youtube WHERE id_canal = ?")
    .get(idCanal) as unknown as LinhaConta | undefined;
}

// Token de acesso válido para chamar a API em nome do canal; renova quando está para vencer.
export async function obterTokenAcessoCanal(idCanal: string): Promise<string> {
  const conta = lerConta(idCanal);
  if (!conta) {
    throw new ErroAplicacao(`O canal ${idCanal || "(vazio)"} não está conectado. Conecte em Configurações.`);
  }

  const expiraEm = Date.parse(conta.token_expira_em || "");
  if (conta.token_acesso && expiraEm - Date.now() > FOLGA_RENOVACAO_MS) return conta.token_acesso;

  const { clientId, clientSecret } = exigirCredenciais();
  try {
    const token = await pedirToken({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conta.token_atualizacao,
      grant_type: "refresh_token",
    });
    obterBanco()
      .prepare(`
        UPDATE contas_youtube
        SET token_acesso = ?, token_expira_em = ?, token_atualizacao = COALESCE(?, token_atualizacao)
        WHERE id_canal = ?
      `)
      .run(token.access_token, calcularExpiracao(token.expires_in), token.refresh_token ?? null, idCanal);
    return token.access_token;
  } catch (erro) {
    // invalid_grant: acesso revogado na conta Google ou credencial trocada. Só reconectando.
    const codigo = (erro as { codigoGoogle?: string }).codigoGoogle;
    if (codigo === "invalid_grant" || codigo === "unauthorized_client") {
      throw new ErroAplicacao(
        `O acesso ao canal "${conta.titulo_canal || idCanal}" expirou ou foi revogado. Desconecte e conecte de novo.`,
        401,
      );
    }
    throw erro;
  }
}

// Revoga no Google (melhor esforço) e apaga os tokens locais do canal.
export async function desconectarCanalYoutube(idCanal: string): Promise<{ revogadoNoGoogle: boolean }> {
  const conta = lerConta(idCanal);
  if (!conta) throw new ErroAplicacao("Canal não encontrado", 404);

  let revogadoNoGoogle = false;
  try {
    const resposta = await fetch(URL_REVOGAR, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: conta.token_atualizacao }),
    });
    revogadoNoGoogle = resposta.ok;
  } catch {
    // Sem internet: os tokens locais são apagados mesmo assim.
  }

  obterBanco().prepare("DELETE FROM contas_youtube WHERE id_canal = ?").run(idCanal);
  return { revogadoNoGoogle };
}

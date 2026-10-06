// Erro previsível de regra de negócio (ex.: projeto não encontrado, dossiê já existe).
export class ErroAplicacao extends Error {
  constructor(mensagem: string, public status = 400) {
    super(mensagem);
    this.name = "ErroAplicacao";
  }
}

// Erros do sistema operacional chegam em inglês ("EBUSY: resource busy or locked, ...").
const ERROS_DO_SISTEMA: Record<string, string> = {
  EACCES: "Sem permissão para acessar",
  EPERM: "Sem permissão para acessar",
  EBUSY: "Arquivo em uso por outro programa",
  ENOSPC: "Sem espaço livre no disco",
  ENOENT: "Arquivo ou pasta não encontrado",
  EEXIST: "Já existe um arquivo ou pasta com esse nome",
  ENOTEMPTY: "A pasta não está vazia",
  EIO: "Erro de leitura ou gravação no disco",
  EROFS: "O disco está protegido contra gravação",
  EMFILE: "Arquivos abertos demais ao mesmo tempo",
};

// Mensagem em pt-BR para um erro do sistema de arquivos; null se o erro não for um deles.
export function traduzirErroSistema(erro: unknown): string | null {
  const { code, path } = (erro ?? {}) as { code?: unknown; path?: unknown };
  const texto = typeof code === "string" ? ERROS_DO_SISTEMA[code] : undefined;
  if (!texto) return null;
  return typeof path === "string" ? `${texto}: ${path}` : texto;
}

// Texto que vai para o usuário: erro do sistema traduzido; os demais, como vieram.
export function descreverErro(erro: unknown): string {
  return traduzirErroSistema(erro) ?? (erro as Error).message;
}

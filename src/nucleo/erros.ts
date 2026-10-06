// Erro previsível de regra de negócio (ex.: projeto não encontrado, dossiê já existe).
export class ErroAplicacao extends Error {
  constructor(mensagem: string, public status = 400) {
    super(mensagem);
    this.name = "ErroAplicacao";
  }
}

// Ponte temporária: as telas ainda não migradas leem [data-tema]; o tema novo usa a classe "dark".
// Removida quando a última tela migrar.
const raiz = document.documentElement;

function espelhar(): void {
  raiz.dataset.tema = raiz.classList.contains("dark") ? "escuro" : "claro";
}

new MutationObserver(espelhar).observe(raiz, { attributes: true, attributeFilter: ["class"] });

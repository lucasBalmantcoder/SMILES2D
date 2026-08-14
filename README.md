# Leitor de SMILES

Visualizador de estruturas moleculares: converte uma notação SMILES em uma estrutura 2D e calcula propriedades básicas (massa molar, fórmula, anéis, TPSA, entre outras). Todo o processamento acontece no navegador, via [RDKit.js](https://www.rdkit.org/) (WebAssembly) — não há backend nem envio de dados a um servidor.

## Estrutura do projeto

```
index.html   estrutura da página
style.css    identidade visual
script.js    carregamento do RDKit.js, renderização e cálculo de propriedades
```

## Executar localmente

Como o projeto não usa build (sem npm, sem bundler), basta servir a pasta com qualquer servidor estático — abrir o `index.html` direto do disco (`file://`) pode bloquear o carregamento do WebAssembly em alguns navegadores.

```
python -m http.server 8000
# depois acesse http://localhost:8000
```

## Publicar no GitHub Pages

1. Suba estes arquivos para a raiz de um repositório no GitHub.
2. Em **Settings > Pages**, selecione a branch `main` e a pasta `/root` como origem.
3. O site fica disponível em `https://<usuario>.github.io/<repositorio>/`.

Não é necessário nenhum passo de build — o GitHub Pages serve os arquivos estáticos diretamente.

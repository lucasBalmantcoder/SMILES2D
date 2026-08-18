# Leitor de SMILES

![Preview do Leitor de SMILES](screenshot.png)

Visualizador de estruturas moleculares: converte uma notação SMILES em uma estrutura 2D e calcula propriedades básicas (massa molar, fórmula, anéis, TPSA, entre outras). Todo o processamento acontece no navegador, via [RDKit.js](https://www.rdkit.org/) (WebAssembly) — não há backend próprio nem envio de dados a um servidor.

**Funcionalidades**

- Desenho de estrutura 2D e cálculo de propriedades a partir do SMILES.
- Busca por nome comum (ex.: "ibuprofeno"), resolvida via [API pública do PubChem](https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest).
- Link compartilhável — a URL reflete a molécula atual (`?smiles=...`).
- Exportação da estrutura como SVG ou PNG.
- Histórico das últimas moléculas consultadas, salvo em `localStorage` do navegador.

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

## Licença

Distribuído sob a licença MIT — veja o arquivo [LICENSE](LICENSE).

# Leitor de SMILES

[![CI](https://github.com/lucasBalmantcoder/SMILES2D/actions/workflows/ci.yml/badge.svg)](https://github.com/lucasBalmantcoder/SMILES2D/actions/workflows/ci.yml)

![Preview do Leitor de SMILES](screenshot.png)

Visualizador de estruturas moleculares: converte uma notação SMILES em uma estrutura 2D e calcula propriedades básicas (massa molar, fórmula, anéis, TPSA, entre outras). Todo o processamento acontece no navegador, via [RDKit.js](https://www.rdkit.org/) (WebAssembly) — não há backend próprio nem envio de dados a um servidor.

**Funcionalidades**

- Desenho de estrutura 2D e cálculo de propriedades a partir do SMILES (massa molar, fórmula, anéis, TPSA, LogP e avaliação da Regra dos 5 de Lipinski).
- Visualizador 3D interativo via [3Dmol.js](https://3dmol.csb.pitt.edu/) com suporte a múltiplos estilos (bastonetes, esferas CPK, linhas e superfície), rotação automática (spin), centralização e sincronização com o tema escuro.
- PWA (Progressive Web App): instalável no computador e celular, com suporte a uso 100% offline através de Service Worker com cache do RDKit WebAssembly.
- Busca por nome comum (ex.: "ibuprofeno"), resolvida via [API pública do PubChem](https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest).
- Link compartilhável — a URL reflete a molécula atual (`?smiles=...`).
- Exportação da estrutura como SVG, PNG ou arquivo MDL Molfile (`.mol`).
- Histórico das últimas moléculas consultadas, salvo em `localStorage` do navegador.

## Estrutura do projeto

```
index.html            estrutura da página
style.css             identidade visual
sw.js                 service worker (cache e suporte PWA offline)
manifest.webmanifest  manifesto de aplicativo PWA instalável
icon.svg / .png       ícones do aplicativo
js/app.js             ponto de entrada — estado da aplicação e eventos da interface
js/dom.js             referências de elementos e atualizações de tela
js/molecule.js        interação com o RDKit.js (parsing, molfile e propriedades)
js/pubchem.js         busca de compostos por nome via API do PubChem
js/history.js         histórico de moléculas consultadas (localStorage)
js/export.js          link compartilhável, cópia para área de transferência e exportação SVG/PNG/MOL
js/theme.js           alternância entre tema claro/escuro (persistida em localStorage)
js/viewer3d.js        resolve o SMILES para um composto do PubChem e renderiza a estrutura 3D com 3Dmol.js
js/utils.js           formatação (fórmula, arredondamento, Lipinski, seleção de descritores)
```

`js/app.js` é carregado como módulo ES nativo (`<script type="module">`), então a divisão em arquivos não exige nenhuma etapa de build — o navegador resolve os `import`/`export` diretamente.

**Sobre a visualização 3D:** o RDKit.js (build "minimal" usada aqui) não gera conformações tridimensionais. A estrutura 3D vem do PubChem — o SMILES é resolvido para um CID e, a partir dele, buscado o SDF 3D já calculado. Por isso, só funciona para compostos catalogados no PubChem; SMILES sintéticos ou muito incomuns podem não ter 3D disponível.

## Executar localmente

Como o projeto não usa build (sem npm, sem bundler), basta servir a pasta com qualquer servidor estático — abrir o `index.html` direto do disco (`file://`) pode bloquear o carregamento do WebAssembly em alguns navegadores.

```
python -m http.server 8000
# depois acesse http://localhost:8000
```

## Testes e lint

Os módulos puros (`utils.js`, `molecule.js`) têm testes automatizados, rodados com o test runner nativo do Node (sem framework externo) e verificados a cada push via GitHub Actions.

```
npm install     # só na primeira vez — instala o ESLint como dependência de desenvolvimento
npm test        # roda os testes (node --test)
npm run lint    # roda o ESLint
```

Essas dependências existem só para testes e lint em ambiente de desenvolvimento — o site publicado continua 100% estático, sem nenhuma etapa de build.

## Licença

Distribuído sob a licença MIT — veja o arquivo [LICENSE](LICENSE).

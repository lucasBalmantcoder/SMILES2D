// Ponto de entrada: mantém o estado (módulo do RDKit carregado, molécula
// atual) e conecta os eventos da interface às funções dos outros módulos.

import { pick, formatFormula, roundOrDash } from "./utils.js";
import {
  els,
  SKELETON_SVG,
  setStatus,
  resetProps,
  setPubchemFields,
  setExportButtonsEnabled,
  showErrorPlaceholder,
} from "./dom.js";
import { renderMolecule } from "./molecule.js";
import { loadHistory, addToHistory } from "./history.js";
import { fetchByName } from "./pubchem.js";
import { buildShareUrl, copyToClipboard, downloadSvg, downloadPng } from "./export.js";

var RDKIT_CDN_BASE = "https://unpkg.com/@rdkit/rdkit/Code/MinimalLib/dist/";
var DEFAULT_SMILES = "CN1C=NC2=C1C(=O)N(C(=O)N2C)C"; // cafeína

var RDKitModule = null;
var current = null; // { smiles, formulaRaw, svg }

function renderHistory() {
  var list = loadHistory();
  els.historyRow.innerHTML = "";

  if (!list.length) {
    els.historyBlock.hidden = true;
    return;
  }

  els.historyBlock.hidden = false;
  list.forEach(function (item) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.setAttribute("data-smiles", item.smiles);
    btn.textContent = item.formula
      ? item.formula.replace(/\d+/g, "") + " · " + item.smiles.slice(0, 14)
      : item.smiles.slice(0, 18);
    btn.title = item.smiles;
    btn.addEventListener("click", function () {
      els.input.value = item.smiles;
      draw(item.smiles, { addHistory: false });
    });
    els.historyRow.appendChild(btn);
  });
}

// Desenha um SMILES e atualiza toda a interface a partir do resultado.
function draw(smiles, options) {
  options = options || {};
  var addHistory = options.addHistory !== false;

  if (!RDKitModule) {
    setStatus("RDKit ainda está carregando, aguarde…");
    return;
  }

  var result = renderMolecule(RDKitModule, smiles);

  if (!result.ok) {
    current = null;
    setExportButtonsEnabled(false);
    resetProps();

    if (result.reason === "empty") {
      setStatus("Digite uma notação SMILES.");
    } else if (result.reason === "exception") {
      setStatus("Erro ao processar o SMILES: " + result.message);
    } else {
      setStatus("SMILES inválido — não foi possível interpretar a estrutura.");
      showErrorPlaceholder("Nenhuma estrutura válida para exibir.");
    }
    return;
  }

  els.canvasWrap.innerHTML = result.svg;
  setPubchemFields(null, null);
  els.formulaOut.innerHTML = formatFormula(result.formula);

  var d = result.descriptors;
  var mw = pick(d, ["amw", "AMW", "exactmw"]);
  var rings = pick(d, ["NumRings", "ringCount", "NumAliphaticRings"]);
  var hbd = pick(d, ["NumHBD", "lipinskiHBD", "NumHDonors"]);
  var hba = pick(d, ["NumHBA", "lipinskiHBA", "NumHAcceptors"]);
  var tpsa = pick(d, ["tpsa", "TPSA"]);
  var rot = pick(d, ["NumRotatableBonds", "NumRotBonds"]);

  els.mw.textContent = mw !== null ? roundOrDash(mw, 2) + " g/mol" : "—";
  els.rings.textContent = rings !== null ? roundOrDash(rings, 0) : "—";
  els.hbd.textContent = hbd !== null ? roundOrDash(hbd, 0) : "—";
  els.hba.textContent = hba !== null ? roundOrDash(hba, 0) : "—";
  els.tpsa.textContent = tpsa !== null ? roundOrDash(tpsa, 1) + " Å²" : "—";
  els.rot.textContent = rot !== null ? roundOrDash(rot, 0) : "—";

  setStatus("Estrutura desenhada.", "ok");

  current = { smiles: result.smiles, formulaRaw: result.formula, svg: result.svg };
  setExportButtonsEnabled(true);

  if (addHistory) {
    addToHistory(result.smiles, result.formula);
    renderHistory();
  }
}

function searchByName(name) {
  var trimmed = (name || "").trim();
  if (!trimmed) {
    setStatus("Digite um nome para buscar.");
    return;
  }

  els.searchBtn.disabled = true;
  setStatus('Buscando "' + trimmed + '" no PubChem…');

  fetchByName(trimmed)
    .then(function (result) {
      els.input.value = result.smiles;
      draw(result.smiles);
      setPubchemFields(result.iupacName, result.inchikey);
    })
    .catch(function (err) {
      setStatus('Não foi possível encontrar "' + trimmed + '" no PubChem (' + err.message + ").");
    })
    .finally(function () {
      els.searchBtn.disabled = false;
    });
}

function handleCopySmiles() {
  if (!current) return;
  copyToClipboard(current.smiles)
    .then(function () {
      setStatus("SMILES copiado para a área de transferência.", "ok");
    })
    .catch(function () {
      window.prompt("Copie o SMILES:", current.smiles);
    });
}

function handleCopyLink() {
  if (!current) return;
  var url = buildShareUrl(current.smiles);
  copyToClipboard(url)
    .then(function () {
      setStatus("Link copiado para a área de transferência.", "ok");
    })
    .catch(function () {
      window.prompt("Copie o link:", url);
    });
}

function handleDownloadSvg() {
  if (!current) return;
  downloadSvg(current.svg, "molecula.svg");
}

function handleDownloadPng() {
  if (!current) return;
  downloadPng(current.svg, "molecula.png", 2).catch(function (err) {
    setStatus(err.message);
  });
}

function init() {
  els.drawBtn.disabled = true;
  setExportButtonsEnabled(false);
  setStatus("Carregando RDKit…");
  els.canvasWrap.innerHTML = SKELETON_SVG;
  renderHistory();

  document.querySelectorAll(".chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      els.input.value = chip.getAttribute("data-smiles");
      draw(els.input.value);
    });
  });

  els.drawBtn.addEventListener("click", function () {
    draw(els.input.value);
  });

  els.input.addEventListener("keydown", function (evt) {
    if (evt.key === "Enter") draw(els.input.value);
  });

  els.searchBtn.addEventListener("click", function () {
    searchByName(els.nameInput.value);
  });

  els.nameInput.addEventListener("keydown", function (evt) {
    if (evt.key === "Enter") searchByName(els.nameInput.value);
  });

  els.copySmilesBtn.addEventListener("click", handleCopySmiles);
  els.shareBtn.addEventListener("click", handleCopyLink);
  els.svgBtn.addEventListener("click", handleDownloadSvg);
  els.pngBtn.addEventListener("click", handleDownloadPng);

  if (typeof window.initRDKitModule !== "function") {
    setStatus("Não foi possível carregar o RDKit.js (verifique a conexão).");
    showErrorPlaceholder("Não foi possível carregar o RDKit.js.");
    return;
  }

  window
    .initRDKitModule({
      locateFile: function (file) {
        return RDKIT_CDN_BASE + file;
      },
    })
    .then(function (RDKit) {
      RDKitModule = RDKit;
      els.drawBtn.disabled = false;
      setStatus("");

      var params = new URLSearchParams(window.location.search);
      var fromUrl = params.get("smiles");
      var initial = fromUrl || DEFAULT_SMILES;

      els.input.value = initial;
      draw(initial, { addHistory: !!fromUrl });
    })
    .catch(function (err) {
      setStatus("Falha ao inicializar o RDKit: " + err.message);
      showErrorPlaceholder("Falha ao inicializar o RDKit.");
    });
}

document.addEventListener("DOMContentLoaded", init);

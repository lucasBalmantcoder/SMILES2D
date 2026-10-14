// Ponto de entrada: mantém o estado (módulo do RDKit carregado, molécula
// atual) e conecta os eventos da interface às funções dos outros módulos.

import { pick, formatFormula, roundOrDash, calculateLipinski } from "./utils.js";
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
import { buildShareUrl, copyToClipboard, downloadSvg, downloadPng, downloadMol } from "./export.js";
import { initThemeToggle } from "./theme.js";
import {
  fetchSdf3dBySmiles,
  renderViewer,
  applyViewerStyle,
  setViewerTheme,
  setViewerSpin,
  resetViewerCamera,
} from "./viewer3d.js";

var RDKIT_CDN_BASE = "https://unpkg.com/@rdkit/rdkit@2026.9.1/dist/";
var DEFAULT_SMILES = "CN1C=NC2=C1C(=O)N(C(=O)N2C)C"; // cafeína

var RDKitModule = null;
var current = null; // { smiles, formulaRaw, svg }
var viewer3dState = {
  sdf: null,
  viewer: null,
  smiles: null,
  isSpinning: false,
  currentStyle: "stick",
};

function updateSpinButton(spinning) {
  if (!els.viewer3dSpinBtn) return;
  els.viewer3dSpinBtn.setAttribute("aria-pressed", spinning ? "true" : "false");
  els.viewer3dSpinBtn.textContent = spinning ? "pausar" : "girar";
  if (spinning) {
    els.viewer3dSpinBtn.classList.add("active");
  } else {
    els.viewer3dSpinBtn.classList.remove("active");
  }
}

function setActiveStyleButton(styleName) {
  if (!els.viewer3dToolbar) return;
  var buttons = els.viewer3dToolbar.querySelectorAll(".viewer3d-styles button");
  buttons.forEach(function (btn) {
    if (btn.getAttribute("data-style") === styleName) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

function resetViewer3d() {
  if (viewer3dState.viewer) {
    try {
      setViewerSpin(viewer3dState.viewer, false);
      if (typeof viewer3dState.viewer.clear === "function") {
        viewer3dState.viewer.clear();
      }
    } catch (e) {}
  }
  viewer3dState = {
    sdf: null,
    viewer: null,
    smiles: null,
    isSpinning: false,
    currentStyle: "stick",
  };
  els.viewer3dContainer.hidden = true;
  els.viewer3dContainer.innerHTML = "";
  if (els.viewer3dToolbar) {
    els.viewer3dToolbar.hidden = true;
  }
  els.viewer3dStatus.textContent = "";
  els.view3dBtn.textContent = "3D";
  updateSpinButton(false);
  setActiveStyleButton("stick");
}

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
  resetViewer3d();

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
  var logp = pick(d, ["CrippenClogP", "Crippen_ClogP", "clogp", "MolLogP", "logp"]);
  var rings = pick(d, ["NumRings", "ringCount", "NumAliphaticRings"]);
  var hbd = pick(d, ["NumHBD", "lipinskiHBD", "NumHDonors"]);
  var hba = pick(d, ["NumHBA", "lipinskiHBA", "NumHAcceptors"]);
  var tpsa = pick(d, ["tpsa", "TPSA"]);
  var rot = pick(d, ["NumRotatableBonds", "NumRotBonds"]);

  els.mw.textContent = mw !== null ? roundOrDash(mw, 2) + " g/mol" : "—";
  els.logp.textContent = logp !== null ? roundOrDash(logp, 2) : "—";
  els.rings.textContent = rings !== null ? roundOrDash(rings, 0) : "—";
  els.hbd.textContent = hbd !== null ? roundOrDash(hbd, 0) : "—";
  els.hba.textContent = hba !== null ? roundOrDash(hba, 0) : "—";
  els.tpsa.textContent = tpsa !== null ? roundOrDash(tpsa, 1) + " Å²" : "—";
  els.rot.textContent = rot !== null ? roundOrDash(rot, 0) : "—";

  var lipinski = calculateLipinski({ mw: mw, logp: logp, hbd: hbd, hba: hba });
  if (!lipinski) {
    els.lipinski.textContent = "—";
    els.lipinski.className = "";
    els.lipinski.removeAttribute("title");
  } else if (lipinski.violationsCount === 0) {
    els.lipinski.textContent = "Atende (0 violações)";
    els.lipinski.className = "lipinski-pass";
    els.lipinski.title = "Atende a todos os critérios da Regra dos 5 de Lipinski";
  } else if (lipinski.violationsCount === 1) {
    els.lipinski.textContent = "Atende (1 violação)";
    els.lipinski.className = "lipinski-warn";
    els.lipinski.title = "Violação: " + lipinski.violations.join(", ");
  } else {
    els.lipinski.textContent = "Não atende (" + lipinski.violationsCount + " violações)";
    els.lipinski.className = "lipinski-fail";
    els.lipinski.title = "Violações: " + lipinski.violations.join(", ");
  }

  setStatus("Estrutura desenhada.", "ok");

  current = {
    smiles: result.smiles,
    formulaRaw: result.formula,
    svg: result.svg,
    molfile: result.molfile,
  };
  setExportButtonsEnabled(true);
  load3d(result.smiles);

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

function handleDownloadMol() {
  if (!current || !current.molfile) {
    setStatus("Arquivo MOL indisponível para esta estrutura.");
    return;
  }
  downloadMol(current.molfile, "molecula.mol");
}

// Busca e renderiza a estrutura 3D no PubChem. Chamada automaticamente a
// cada molécula desenhada, e também pelo botão (para tentar de novo em
// caso de falha, já que quando já carregada o botão só alterna visibilidade).
function load3d(smiles) {
  els.view3dBtn.disabled = true;
  els.view3dBtn.textContent = "Carregando 3D…";
  els.viewer3dStatus.textContent = "Buscando estrutura 3D no PubChem…";
  els.viewer3dStatus.removeAttribute("data-state");

  fetchSdf3dBySmiles(smiles)
    .then(function (sdf) {
      // Se o usuário desenhou outra molécula enquanto a busca corria, descarta.
      if (!current || current.smiles !== smiles) return;

      viewer3dState = { sdf: sdf, smiles: smiles, viewer: null };
      els.viewer3dContainer.hidden = false;
      viewer3dState.viewer = renderViewer(els.viewer3dContainer, sdf);
      els.viewer3dStatus.textContent = "Estrutura 3D carregada (dados do PubChem).";
      els.viewer3dStatus.setAttribute("data-state", "ok");
      els.view3dBtn.textContent = "Ocultar 3D";
      els.view3dBtn.disabled = false;
    })
    .catch(function (err) {
      if (!current || current.smiles !== smiles) return;
      els.viewer3dStatus.textContent = "Estrutura 3D indisponível (" + err.message + ").";
      els.viewer3dStatus.removeAttribute("data-state");
      els.view3dBtn.textContent = "Tentar novamente";
      els.view3dBtn.disabled = false;
    });
}

function handleView3d() {
  if (!current) return;

  // Já carregado para esta molécula: só alterna mostrar/ocultar.
  if (viewer3dState.sdf && viewer3dState.smiles === current.smiles) {
    var nowHidden = !els.viewer3dContainer.hidden;
    els.viewer3dContainer.hidden = nowHidden;
    els.view3dBtn.textContent = nowHidden ? "Mostrar 3D" : "Ocultar 3D";
    return;
  }

  // Ainda não carregado (ou a tentativa anterior falhou) — busca de novo.
  load3d(current.smiles);
}

function init() {
  initThemeToggle(document.getElementById("theme-toggle"), document.getElementById("theme-toggle-label"));

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
  els.molBtn.addEventListener("click", handleDownloadMol);
  els.view3dBtn.addEventListener("click", handleView3d);

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

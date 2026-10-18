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
import { evaluateBioavailability, renderRadarSvg } from "./radar.js";
import { findSubstructure, FUNCTIONAL_GROUPS } from "./substructure.js";



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

var canvas2dState = {
  scale: 1,
  panX: 0,
  panY: 0,
  isDragging: false,
  startX: 0,
  startY: 0,
  startPanX: 0,
  startPanY: 0,
  showAtomIndices: false,
  isFullscreen: false,
};

var substructState = {
  activeSmarts: "",
  activeLabel: "",
  highlightAtoms: [],
  highlightBonds: [],
};

function setSubstructStatus(message, state) {
  if (!els.substructStatus) return;
  els.substructStatus.textContent = message || "";
  if (state) {
    els.substructStatus.setAttribute("data-state", state);
  } else {
    els.substructStatus.removeAttribute("data-state");
  }
}

function updateSubstructChipsActive(activeSmarts) {
  if (!els.substructChips) return;
  var buttons = els.substructChips.querySelectorAll("button");
  buttons.forEach(function (btn, idx) {
    if (FUNCTIONAL_GROUPS[idx] && FUNCTIONAL_GROUPS[idx].smarts === activeSmarts) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

function renderFunctionalGroupsChips() {
  if (!els.substructChips) return;
  els.substructChips.innerHTML = "";
  FUNCTIONAL_GROUPS.forEach(function (grp) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = grp.name;
    btn.title = grp.desc + " — " + grp.smarts;
    btn.disabled = !current;
    btn.addEventListener("click", function () {
      if (substructState.activeSmarts === grp.smarts) {
        clearSubstructureHighlight();
      } else {
        if (els.smartsInput) els.smartsInput.value = grp.smarts;
        applySubstructureHighlight(grp.smarts, grp.name);
      }
    });
    els.substructChips.appendChild(btn);
  });
}

function applySubstructureHighlight(smarts, label) {
  if (!current || !RDKitModule) return;
  var trimmed = (smarts || "").trim();
  if (!trimmed) {
    setSubstructStatus("Digite um padrão SMARTS para destacar.", "warn");
    return;
  }

  var res = findSubstructure(RDKitModule, current.smiles, trimmed);
  if (!res.ok) {
    if (res.reason === "invalid_smarts") {
      setSubstructStatus("SMARTS inválido — verifique a sintaxe da consulta.", "error");
    } else {
      setSubstructStatus("Não foi possível processar o padrão SMARTS.", "error");
    }
    clearSubstructureHighlight({ keepStatus: true });
    return;
  }

  if (res.matchCount === 0) {
    var notFoundLabel = label ? label + " (" + trimmed + ")" : trimmed;
    setSubstructStatus("Nenhuma correspondência para " + notFoundLabel + ".", "warn");
    clearSubstructureHighlight({ keepStatus: true });
    return;
  }

  substructState.activeSmarts = trimmed;
  substructState.activeLabel = label || trimmed;
  substructState.highlightAtoms = res.atoms;
  substructState.highlightBonds = res.bonds;

  if (els.substructClearBtn) els.substructClearBtn.hidden = false;
  updateSubstructChipsActive(trimmed);

  var occText = res.matchCount === 1 ? "1 ocorrência encontrada" : res.matchCount + " ocorrências encontradas";
  var atomText = res.atoms.length === 1 ? "1 átomo destacado" : res.atoms.length + " átomos destacados";
  var nameText = label ? label + " (" + trimmed + ")" : trimmed;
  setSubstructStatus(nameText + ": " + occText + " (" + atomText + ").", "ok");

  draw(current.smiles, {
    addHistory: false,
    preserveTransform: true,
    highlightAtoms: res.atoms,
    highlightBonds: res.bonds,
  });
}

function clearSubstructureHighlight(opts) {
  opts = opts || {};
  substructState.activeSmarts = "";
  substructState.activeLabel = "";
  substructState.highlightAtoms = [];
  substructState.highlightBonds = [];

  if (els.substructClearBtn) els.substructClearBtn.hidden = true;
  if (!opts.keepStatus) {
    setSubstructStatus("");
    if (els.smartsInput) els.smartsInput.value = "";
  }
  updateSubstructChipsActive("");

  if (current && current.smiles) {
    draw(current.smiles, {
      addHistory: false,
      preserveTransform: true,
      highlightAtoms: [],
      highlightBonds: [],
    });
  }
}


function applyCanvasTransform() {
  if (!els.canvasViewport) return;
  els.canvasViewport.style.transform =
    "translate(" + canvas2dState.panX + "px, " + canvas2dState.panY + "px) scale(" + canvas2dState.scale + ")";
  if (els.zoomResetBtn) {
    els.zoomResetBtn.textContent = Math.round(canvas2dState.scale * 100) + "%";
  }
}

function resetCanvasTransform() {
  canvas2dState.scale = 1;
  canvas2dState.panX = 0;
  canvas2dState.panY = 0;
  applyCanvasTransform();
}

function setZoom(newScale, focalX, focalY) {
  var clamped = Math.max(0.3, Math.min(6.0, newScale));
  if (Math.abs(clamped - canvas2dState.scale) < 0.001) return;

  if (focalX !== undefined && focalY !== undefined && els.canvasWrap) {
    var rect = els.canvasWrap.getBoundingClientRect();
    var cx = focalX - rect.left - rect.width / 2;
    var cy = focalY - rect.top - rect.height / 2;
    var ratio = clamped / canvas2dState.scale;
    canvas2dState.panX = cx - (cx - canvas2dState.panX) * ratio;
    canvas2dState.panY = cy - (cy - canvas2dState.panY) * ratio;
  }
  canvas2dState.scale = clamped;
  applyCanvasTransform();
}

function handleZoomIn() {
  setZoom(canvas2dState.scale * 1.25);
}

function handleZoomOut() {
  setZoom(canvas2dState.scale / 1.25);
}

function handleZoomReset() {
  resetCanvasTransform();
}

function handleToggleAtomIndices() {
  canvas2dState.showAtomIndices = !canvas2dState.showAtomIndices;
  if (els.atomIndicesBtn) {
    els.atomIndicesBtn.setAttribute("aria-pressed", canvas2dState.showAtomIndices ? "true" : "false");
    if (canvas2dState.showAtomIndices) {
      els.atomIndicesBtn.classList.add("active");
    } else {
      els.atomIndicesBtn.classList.remove("active");
    }
  }
  if (current && current.smiles) {
    draw(current.smiles, { addHistory: false, preserveTransform: true });
  }
}

function updateFullscreenUi(isFullscreen) {
  canvas2dState.isFullscreen = isFullscreen;
  if (!els.canvasFsBtn || !els.canvasWrap) return;
  els.canvasFsBtn.setAttribute("aria-pressed", isFullscreen ? "true" : "false");
  if (isFullscreen) {
    els.canvasWrap.classList.add("is-fullscreen");
    els.canvasFsBtn.classList.add("active");
    els.canvasFsBtn.textContent = "✕";
    els.canvasFsBtn.title = "Sair da tela cheia (Esc)";
    els.canvasFsBtn.setAttribute("aria-label", "Sair da tela cheia");
  } else {
    els.canvasWrap.classList.remove("is-fullscreen");
    els.canvasFsBtn.classList.remove("active");
    els.canvasFsBtn.textContent = "⛶";
    els.canvasFsBtn.title = "Alternar tela cheia";
    els.canvasFsBtn.setAttribute("aria-label", "Alternar tela cheia");
  }
}

function handleToggleFullscreen() {
  if (!els.canvasWrap) return;
  var isFs = document.fullscreenElement === els.canvasWrap || canvas2dState.isFullscreen;
  if (isFs) {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(function () {});
    }
    updateFullscreenUi(false);
  } else {
    if (typeof els.canvasWrap.requestFullscreen === "function") {
      els.canvasWrap.requestFullscreen().then(function () {
        updateFullscreenUi(true);
      }).catch(function () {
        updateFullscreenUi(true);
      });
    } else {
      updateFullscreenUi(true);
    }
  }
}

function setupCanvasInteractivity() {
  if (!els.canvasWrap) return;

  els.canvasWrap.addEventListener("pointerdown", function (e) {
    if (e.target && e.target.closest("#canvas-toolbar")) return;
    if (!current) return;

    canvas2dState.isDragging = true;
    canvas2dState.startX = e.clientX;
    canvas2dState.startY = e.clientY;
    canvas2dState.startPanX = canvas2dState.panX;
    canvas2dState.startPanY = canvas2dState.panY;
    els.canvasWrap.classList.add("is-dragging");
    try {
      els.canvasWrap.setPointerCapture(e.pointerId);
    } catch (err) {}
  });

  els.canvasWrap.addEventListener("pointermove", function (e) {
    if (!canvas2dState.isDragging) return;
    canvas2dState.panX = canvas2dState.startPanX + (e.clientX - canvas2dState.startX);
    canvas2dState.panY = canvas2dState.startPanY + (e.clientY - canvas2dState.startY);
    applyCanvasTransform();
  });

  function stopDrag(e) {
    if (canvas2dState.isDragging) {
      canvas2dState.isDragging = false;
      els.canvasWrap.classList.remove("is-dragging");
      try {
        if (e && e.pointerId) {
          els.canvasWrap.releasePointerCapture(e.pointerId);
        }
      } catch (err) {}
    }
  }

  els.canvasWrap.addEventListener("pointerup", stopDrag);
  els.canvasWrap.addEventListener("pointercancel", stopDrag);

  els.canvasWrap.addEventListener("wheel", function (e) {
    if (!current) return;
    e.preventDefault();
    var factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom(canvas2dState.scale * factor, e.clientX, e.clientY);
  }, { passive: false });

  els.canvasWrap.addEventListener("dblclick", function (e) {
    if (e.target && e.target.closest("#canvas-toolbar")) return;
    if (!current) return;
    resetCanvasTransform();
  });

  document.addEventListener("fullscreenchange", function () {
    var isFs = document.fullscreenElement === els.canvasWrap;
    updateFullscreenUi(isFs);
  });

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && canvas2dState.isFullscreen) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(function () {});
      }
      updateFullscreenUi(false);
    }
  });

  if (els.zoomInBtn) els.zoomInBtn.addEventListener("click", handleZoomIn);
  if (els.zoomOutBtn) els.zoomOutBtn.addEventListener("click", handleZoomOut);
  if (els.zoomResetBtn) els.zoomResetBtn.addEventListener("click", handleZoomReset);
  if (els.atomIndicesBtn) els.atomIndicesBtn.addEventListener("click", handleToggleAtomIndices);
  if (els.canvasFsBtn) els.canvasFsBtn.addEventListener("click", handleToggleFullscreen);
}


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
  var preserveTransform = options.preserveTransform === true;

  if (!RDKitModule) {
    setStatus("RDKit ainda está carregando, aguarde…");
    return;
  }

  var trimmed = (smiles || "").trim();
  if (current && current.smiles !== trimmed && options.highlightAtoms === undefined) {
    substructState.activeSmarts = "";
    substructState.activeLabel = "";
    substructState.highlightAtoms = [];
    substructState.highlightBonds = [];
    if (els.substructClearBtn) els.substructClearBtn.hidden = true;
    if (els.substructStatus) {
      els.substructStatus.textContent = "";
      els.substructStatus.removeAttribute("data-state");
    }
    updateSubstructChipsActive("");
    if (els.smartsInput) els.smartsInput.value = "";
  }

  var highlightAtoms =
    options.highlightAtoms !== undefined ? options.highlightAtoms : substructState.highlightAtoms;
  var highlightBonds =
    options.highlightBonds !== undefined ? options.highlightBonds : substructState.highlightBonds;

  var result = renderMolecule(RDKitModule, smiles, {
    addAtomIndices: canvas2dState.showAtomIndices,
    highlightAtoms: highlightAtoms,
    highlightBonds: highlightBonds,
  });
  resetViewer3d();

  if (!result.ok) {
    current = null;
    if (els.canvasWrap) els.canvasWrap.classList.remove("has-mol");
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

  var target = els.canvasViewport || els.canvasWrap;
  target.innerHTML = result.svg;
  if (els.canvasWrap) els.canvasWrap.classList.add("has-mol");

  if (!preserveTransform) {
    resetCanvasTransform();
  }
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
  var fsp3 = pick(d, ["FractionCSP3", "fractionCSP3"]);
  var heavyAtoms = pick(d, ["NumHeavyAtoms", "numHeavyAtoms"]);
  var aromaticRings = pick(d, ["NumAromaticRings", "numAromaticRings"]);
  var aromaticRatio =
    heavyAtoms && heavyAtoms > 0 && aromaticRings !== null
      ? Math.min(1.0, (aromaticRings * 6) / heavyAtoms)
      : 0;

  var bioEval = evaluateBioavailability({
    mw: mw,
    logp: logp,
    tpsa: tpsa,
    rotb: rot,
    fsp3: fsp3,
    aromaticRatio: aromaticRatio,
  });

  els.mw.textContent = mw !== null ? roundOrDash(mw, 2) + " g/mol" : "—";
  els.logp.textContent = logp !== null ? roundOrDash(logp, 2) : "—";
  els.rings.textContent = rings !== null ? roundOrDash(rings, 0) : "—";
  els.hbd.textContent = hbd !== null ? roundOrDash(hbd, 0) : "—";
  els.hba.textContent = hba !== null ? roundOrDash(hba, 0) : "—";
  els.tpsa.textContent = tpsa !== null ? roundOrDash(tpsa, 1) + " Å²" : "—";
  els.rot.textContent = rot !== null ? roundOrDash(rot, 0) : "—";
  if (els.esol) {
    els.esol.textContent = bioEval && bioEval.logS !== null ? roundOrDash(bioEval.logS, 2) : "—";
  }
  if (els.fsp3) {
    els.fsp3.textContent = fsp3 !== null ? roundOrDash(fsp3, 2) : "—";
  }

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

  if (bioEval && els.radarChartWrap) {
    els.radarChartWrap.innerHTML = renderRadarSvg(bioEval, { width: 320, height: 260 });
    if (els.radarBadge) {
      if (bioEval.isFullyOptimal) {
        els.radarBadge.textContent = "Ótimo (6/6)";
        els.radarBadge.className = "radar-badge pass";
        els.radarBadge.title = "Todos os 6 parâmetros de biodisponibilidade oral dentro da faixa ideal";
      } else {
        els.radarBadge.textContent = bioEval.passedCount + "/6 ideais";
        els.radarBadge.className = "radar-badge warn";
        els.radarBadge.title = "Desvios: " + bioEval.deviations.join("; ");
      }
    }

    if (els.radarChips && els.radarDetails) {
      els.radarChips.innerHTML = "";
      bioEval.axes.forEach(function (ax) {
        var chip = document.createElement("div");
        chip.className = "radar-chip" + (!ax.isOptimal ? " is-warn" : "");
        chip.innerHTML =
          '<div class="radar-chip-top">' +
          '<span class="radar-chip-name">' + ax.axis.label + '</span>' +
          '<span class="radar-chip-val">' + ax.axis.format(ax.value) + '</span>' +
          '</div>' +
          '<span class="radar-chip-range">ideal: ' + ax.axis.format(ax.axis.optMin) + ' a ' + ax.axis.format(ax.axis.optMax) + '</span>';
        els.radarChips.appendChild(chip);
      });
      els.radarDetails.hidden = false;
    }
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

      viewer3dState = {
        sdf: sdf,
        smiles: smiles,
        viewer: null,
        isSpinning: false,
        currentStyle: "stick",
      };
      els.viewer3dContainer.hidden = false;
      viewer3dState.viewer = renderViewer(els.viewer3dContainer, sdf);

      if (els.viewer3dToolbar) {
        els.viewer3dToolbar.hidden = false;
      }
      updateSpinButton(false);
      setActiveStyleButton("stick");

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
    if (els.viewer3dToolbar) {
      els.viewer3dToolbar.hidden = nowHidden;
    }
    els.view3dBtn.textContent = nowHidden ? "Mostrar 3D" : "Ocultar 3D";
    if (nowHidden && viewer3dState.isSpinning) {
      setViewerSpin(viewer3dState.viewer, false);
      viewer3dState.isSpinning = false;
      updateSpinButton(false);
    }
    return;
  }

  // Ainda não carregado (ou a tentativa anterior falhou) — busca de novo.
  load3d(current.smiles);
}

function handle3dStyleClick(evt) {
  var btn = evt.target.closest("button[data-style]");
  if (!btn || !viewer3dState.viewer) return;
  var style = btn.getAttribute("data-style");
  viewer3dState.currentStyle = style;
  applyViewerStyle(viewer3dState.viewer, style);
  setActiveStyleButton(style);
}

function handle3dSpinClick() {
  if (!viewer3dState.viewer) return;
  var next = !viewer3dState.isSpinning;
  viewer3dState.isSpinning = next;
  setViewerSpin(viewer3dState.viewer, next);
  updateSpinButton(next);
}

function handle3dResetClick() {
  if (!viewer3dState.viewer) return;
  resetViewerCamera(viewer3dState.viewer);
}

// PWA: registro do Service Worker para cache e uso offline
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function (err) {
        console.warn("Falha ao registrar Service Worker:", err);
      });
    });
  }
}

// PWA: instalação via botão customizado no cabeçalho
var deferredInstallPrompt = null;

function setupPwaInstall() {
  if (!els.installBtn) return;

  window.addEventListener("beforeinstallprompt", function (evt) {
    evt.preventDefault();
    deferredInstallPrompt = evt;
    els.installBtn.hidden = false;
  });

  els.installBtn.addEventListener("click", function () {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(function () {
      deferredInstallPrompt = null;
      els.installBtn.hidden = true;
    });
  });

  window.addEventListener("appinstalled", function () {
    deferredInstallPrompt = null;
    els.installBtn.hidden = true;
  });
}

function init() {
  initThemeToggle(
    document.getElementById("theme-toggle"),
    document.getElementById("theme-toggle-label"),
    function (nextTheme) {
      if (viewer3dState.viewer) {
        setViewerTheme(viewer3dState.viewer, nextTheme);
      }
    }
  );

  registerServiceWorker();
  setupPwaInstall();

  els.drawBtn.disabled = true;
  setExportButtonsEnabled(false);
  setStatus("Carregando RDKit…");
  (els.canvasViewport || els.canvasWrap).innerHTML = SKELETON_SVG;
  setupCanvasInteractivity();
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

  if (els.viewer3dToolbar) {
    els.viewer3dToolbar.addEventListener("click", handle3dStyleClick);
  }
  if (els.viewer3dSpinBtn) {
    els.viewer3dSpinBtn.addEventListener("click", handle3dSpinClick);
  }
  if (els.viewer3dResetBtn) {
    els.viewer3dResetBtn.addEventListener("click", handle3dResetClick);
  }

  renderFunctionalGroupsChips();

  if (els.smartsBtn) {
    els.smartsBtn.addEventListener("click", function () {
      applySubstructureHighlight(els.smartsInput.value, "padrão SMARTS");
    });
  }

  if (els.smartsInput) {
    els.smartsInput.addEventListener("keydown", function (evt) {
      if (evt.key === "Enter") {
        applySubstructureHighlight(els.smartsInput.value, "padrão SMARTS");
      }
    });
  }

  if (els.substructClearBtn) {
    els.substructClearBtn.addEventListener("click", function () {
      clearSubstructureHighlight();
    });
  }

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

// Referências de elementos usadas pelo restante da aplicação. Centralizar
// aqui evita repetir document.getElementById em cada módulo.

export var els = {
  input: document.getElementById("smiles-input"),
  drawBtn: document.getElementById("draw-btn"),
  status: document.getElementById("status-line"),
  canvasWrap: document.getElementById("canvas-wrap"),
  placeholder: document.getElementById("canvas-placeholder"),
  formulaOut: document.getElementById("formula-out"),
  mw: document.getElementById("prop-mw"),
  logp: document.getElementById("prop-logp"),
  lipinski: document.getElementById("prop-lipinski"),
  rings: document.getElementById("prop-rings"),
  hbd: document.getElementById("prop-hbd"),
  hba: document.getElementById("prop-hba"),
  tpsa: document.getElementById("prop-tpsa"),
  rot: document.getElementById("prop-rot"),
  esol: document.getElementById("prop-esol"),
  fsp3: document.getElementById("prop-fsp3"),
  iupac: document.getElementById("prop-iupac"),
  inchikey: document.getElementById("prop-inchikey"),
  radarBadge: document.getElementById("radar-badge"),
  radarChartWrap: document.getElementById("radar-chart-wrap"),
  radarDetails: document.getElementById("radar-details"),
  radarChips: document.getElementById("radar-chips"),
  nameInput: document.getElementById("name-input"),
  searchBtn: document.getElementById("search-btn"),
  copySmilesBtn: document.getElementById("copy-smiles-btn"),
  shareBtn: document.getElementById("share-btn"),
  svgBtn: document.getElementById("svg-btn"),
  pngBtn: document.getElementById("png-btn"),
  molBtn: document.getElementById("mol-btn"),
  historyBlock: document.getElementById("history-block"),
  historyRow: document.getElementById("history-row"),
  view3dBtn: document.getElementById("view3d-btn"),
  viewer3dStatus: document.getElementById("viewer3d-status"),
  viewer3dContainer: document.getElementById("viewer3d-container"),
  viewer3dToolbar: document.getElementById("viewer3d-toolbar"),
  viewer3dSpinBtn: document.getElementById("viewer3d-spin-btn"),
  viewer3dResetBtn: document.getElementById("viewer3d-reset-btn"),
  zoomInBtn: document.getElementById("zoom-in-btn"),
  zoomOutBtn: document.getElementById("zoom-out-btn"),
  zoomResetBtn: document.getElementById("zoom-reset-btn"),
  atomIndicesBtn: document.getElementById("atom-indices-btn"),
  canvasFsBtn: document.getElementById("canvas-fs-btn"),
  canvasViewport: document.getElementById("canvas-viewport"),
  canvasToolbar: document.getElementById("canvas-toolbar"),
  substructBlock: document.getElementById("substruct-block"),
  substructChips: document.getElementById("substruct-chips"),
  substructClearBtn: document.getElementById("substruct-clear-btn"),
  smartsInput: document.getElementById("smarts-input"),
  smartsBtn: document.getElementById("smarts-btn"),
  substructStatus: document.getElementById("substruct-status"),
  installBtn: document.getElementById("install-btn"),
};

export var SKELETON_SVG =
  '<svg class="skeleton-mol" viewBox="0 0 200 160" role="img" aria-label="Carregando estrutura">' +
  '<line class="d1" x1="60" y1="40" x2="100" y2="70"/>' +
  '<line class="d2" x1="100" y1="70" x2="60" y2="110"/>' +
  '<line class="d3" x1="100" y1="70" x2="150" y2="55"/>' +
  '<circle class="d1" cx="60" cy="40" r="9"/>' +
  '<circle class="d2" cx="60" cy="110" r="9"/>' +
  '<circle class="d3" cx="150" cy="55" r="8"/>' +
  '<circle class="d4" cx="100" cy="70" r="7"/>' +
  "</svg>";

export function setStatus(message, state) {
  els.status.textContent = message || "";
  if (state) {
    els.status.setAttribute("data-state", state);
  } else {
    els.status.removeAttribute("data-state");
  }
}

export function resetProps() {
  els.mw.textContent = "—";
  els.logp.textContent = "—";
  els.lipinski.textContent = "—";
  els.lipinski.className = "";
  els.lipinski.removeAttribute("title");
  els.rings.textContent = "—";
  els.hbd.textContent = "—";
  els.hba.textContent = "—";
  els.tpsa.textContent = "—";
  els.rot.textContent = "—";
  if (els.esol) els.esol.textContent = "—";
  if (els.fsp3) els.fsp3.textContent = "—";
  els.formulaOut.textContent = "—";
  els.iupac.textContent = "—";
  els.inchikey.textContent = "—";
  if (els.radarBadge) {
    els.radarBadge.textContent = "—";
    els.radarBadge.className = "radar-badge";
    els.radarBadge.removeAttribute("title");
  }
  if (els.radarChartWrap) {
    els.radarChartWrap.innerHTML = '<p class="canvas-placeholder">Desenhe uma molécula para gerar o radar.</p>';
  }
  if (els.radarDetails) els.radarDetails.hidden = true;
  if (els.radarChips) els.radarChips.innerHTML = "";
  if (els.substructStatus) {
    els.substructStatus.textContent = "";
    els.substructStatus.removeAttribute("data-state");
  }
  if (els.substructClearBtn) els.substructClearBtn.hidden = true;
  if (els.substructChips) {
    els.substructChips.querySelectorAll(".chip").forEach(function (c) {
      c.classList.remove("active");
    });
  }
}

export function setPubchemFields(iupacName, inchikey) {
  els.iupac.textContent = iupacName || "—";
  els.inchikey.textContent = inchikey || "—";
}

export function setCanvasToolsEnabled(enabled) {
  if (els.zoomInBtn) els.zoomInBtn.disabled = !enabled;
  if (els.zoomOutBtn) els.zoomOutBtn.disabled = !enabled;
  if (els.zoomResetBtn) els.zoomResetBtn.disabled = !enabled;
  if (els.atomIndicesBtn) els.atomIndicesBtn.disabled = !enabled;
  if (els.canvasFsBtn) els.canvasFsBtn.disabled = !enabled;
}

export function setExportButtonsEnabled(enabled) {
  els.copySmilesBtn.disabled = !enabled;
  els.shareBtn.disabled = !enabled;
  els.svgBtn.disabled = !enabled;
  els.pngBtn.disabled = !enabled;
  els.molBtn.disabled = !enabled;
  els.view3dBtn.disabled = !enabled;
  if (els.smartsInput) els.smartsInput.disabled = !enabled;
  if (els.smartsBtn) els.smartsBtn.disabled = !enabled;
  if (els.substructChips) {
    els.substructChips.querySelectorAll("button").forEach(function (b) {
      b.disabled = !enabled;
    });
  }
  setCanvasToolsEnabled(enabled);
}

export function showErrorPlaceholder(message) {
  var target = els.canvasViewport || els.canvasWrap;
  target.innerHTML = "";
  els.placeholder.textContent = message;
  target.appendChild(els.placeholder);
  setCanvasToolsEnabled(false);
}


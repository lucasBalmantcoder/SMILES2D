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
  rings: document.getElementById("prop-rings"),
  hbd: document.getElementById("prop-hbd"),
  hba: document.getElementById("prop-hba"),
  tpsa: document.getElementById("prop-tpsa"),
  rot: document.getElementById("prop-rot"),
  iupac: document.getElementById("prop-iupac"),
  inchikey: document.getElementById("prop-inchikey"),
  nameInput: document.getElementById("name-input"),
  searchBtn: document.getElementById("search-btn"),
  copySmilesBtn: document.getElementById("copy-smiles-btn"),
  shareBtn: document.getElementById("share-btn"),
  svgBtn: document.getElementById("svg-btn"),
  pngBtn: document.getElementById("png-btn"),
  historyBlock: document.getElementById("history-block"),
  historyRow: document.getElementById("history-row"),
  view3dBtn: document.getElementById("view3d-btn"),
  viewer3dStatus: document.getElementById("viewer3d-status"),
  viewer3dContainer: document.getElementById("viewer3d-container"),
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
  els.rings.textContent = "—";
  els.hbd.textContent = "—";
  els.hba.textContent = "—";
  els.tpsa.textContent = "—";
  els.rot.textContent = "—";
  els.formulaOut.textContent = "—";
  els.iupac.textContent = "—";
  els.inchikey.textContent = "—";
}

export function setPubchemFields(iupacName, inchikey) {
  els.iupac.textContent = iupacName || "—";
  els.inchikey.textContent = inchikey || "—";
}

export function setExportButtonsEnabled(enabled) {
  els.copySmilesBtn.disabled = !enabled;
  els.shareBtn.disabled = !enabled;
  els.svgBtn.disabled = !enabled;
  els.pngBtn.disabled = !enabled;
  els.view3dBtn.disabled = !enabled;
}

export function showErrorPlaceholder(message) {
  els.canvasWrap.innerHTML = "";
  els.placeholder.textContent = message;
  els.canvasWrap.appendChild(els.placeholder);
}

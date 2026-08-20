(function () {
  "use strict";

  var RDKIT_CDN_BASE = "https://unpkg.com/@rdkit/rdkit/Code/MinimalLib/dist/";
  var DEFAULT_SMILES = "CN1C=NC2=C1C(=O)N(C(=O)N2C)C"; // cafeína
  var HISTORY_KEY = "leitorSmiles.history";
  var HISTORY_MAX = 8;
  var PUBCHEM_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/";

  var els = {
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
    nameInput: document.getElementById("name-input"),
    searchBtn: document.getElementById("search-btn"),
    copySmilesBtn: document.getElementById("copy-smiles-btn"),
    shareBtn: document.getElementById("share-btn"),
    svgBtn: document.getElementById("svg-btn"),
    pngBtn: document.getElementById("png-btn"),
    historyBlock: document.getElementById("history-block"),
    historyRow: document.getElementById("history-row"),
    iupac: document.getElementById("prop-iupac"),
    inchikey: document.getElementById("prop-inchikey"),
  };

  var RDKitModule = null;
  var current = null; // { smiles, formulaRaw, svg }

  function setStatus(message, state) {
    els.status.textContent = message || "";
    if (state) {
      els.status.setAttribute("data-state", state);
    } else {
      els.status.removeAttribute("data-state");
    }
  }

  function resetProps() {
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

  function setPubchemFields(iupacName, inchikey) {
    els.iupac.textContent = iupacName || "—";
    els.inchikey.textContent = inchikey || "—";
  }

  function setExportButtonsEnabled(enabled) {
    els.copySmilesBtn.disabled = !enabled;
    els.shareBtn.disabled = !enabled;
    els.svgBtn.disabled = !enabled;
    els.pngBtn.disabled = !enabled;
  }

  // Looks up the first present key from a list of candidate descriptor
  // names, since the exact key names have varied slightly across
  // RDKit.js releases.
  function pick(obj, candidates) {
    for (var i = 0; i < candidates.length; i++) {
      if (obj[candidates[i]] !== undefined && obj[candidates[i]] !== null) {
        return obj[candidates[i]];
      }
    }
    return null;
  }

  function formatFormula(raw) {
    if (!raw) return "n/d";
    var escaped = raw.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return escaped.replace(/(\d+)/g, "<sub>$1</sub>");
  }

  function roundOrDash(value, digits) {
    if (value === null || value === undefined || isNaN(value)) return "—";
    return Number(value).toFixed(digits === undefined ? 0 : digits);
  }

  // ---------- histórico (localStorage) ----------

  function loadHistory() {
    try {
      var raw = window.localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (e) {
      // localStorage indisponível (ex.: modo privado) — sem histórico persistente.
    }
  }

  function addToHistory(smiles, formulaRaw) {
    var list = loadHistory().filter(function (item) {
      return item.smiles !== smiles;
    });
    list.unshift({ smiles: smiles, formula: formulaRaw || "" });
    list = list.slice(0, HISTORY_MAX);
    saveHistory(list);
    renderHistory();
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
      btn.textContent = item.formula ? item.formula.replace(/\d+/g, "") + " · " + item.smiles.slice(0, 14) : item.smiles.slice(0, 18);
      btn.title = item.smiles;
      btn.addEventListener("click", function () {
        els.input.value = item.smiles;
        render(item.smiles, { addHistory: false });
      });
      els.historyRow.appendChild(btn);
    });
  }

  // ---------- renderização principal ----------

  function render(smiles, options) {
    options = options || {};
    var addHistory = options.addHistory !== false;

    if (!RDKitModule) {
      setStatus("RDKit ainda está carregando, aguarde…");
      return;
    }

    var trimmed = (smiles || "").trim();
    if (!trimmed) {
      setStatus("Digite uma notação SMILES.");
      return;
    }

    var mol = null;
    try {
      mol = RDKitModule.get_mol(trimmed);

      if (!mol || !mol.is_valid()) {
        setStatus("SMILES inválido — não foi possível interpretar a estrutura.");
        resetProps();
        els.canvasWrap.innerHTML = "";
        els.canvasWrap.appendChild(els.placeholder);
        els.placeholder.textContent = "Nenhuma estrutura válida para exibir.";
        current = null;
        setExportButtonsEnabled(false);
        return;
      }

      var svg = mol.get_svg(320, 260);
      els.canvasWrap.innerHTML = svg;

      setPubchemFields(null, null);

      var formula = "n/d";
      try {
        if (typeof mol.get_molformula === "function") {
          formula = mol.get_molformula();
        }
      } catch (e) {
        formula = "n/d";
      }
      els.formulaOut.innerHTML = formatFormula(formula);

      var descriptors = {};
      try {
        descriptors = JSON.parse(mol.get_descriptors());
      } catch (e) {
        descriptors = {};
      }

      var mw = pick(descriptors, ["amw", "AMW", "exactmw"]);
      var rings = pick(descriptors, ["NumRings", "ringCount", "NumAliphaticRings"]);
      var hbd = pick(descriptors, ["NumHBD", "lipinskiHBD", "NumHDonors"]);
      var hba = pick(descriptors, ["NumHBA", "lipinskiHBA", "NumHAcceptors"]);
      var tpsa = pick(descriptors, ["tpsa", "TPSA"]);
      var rot = pick(descriptors, ["NumRotatableBonds", "NumRotBonds"]);

      els.mw.textContent = mw !== null ? roundOrDash(mw, 2) + " g/mol" : "—";
      els.rings.textContent = rings !== null ? roundOrDash(rings, 0) : "—";
      els.hbd.textContent = hbd !== null ? roundOrDash(hbd, 0) : "—";
      els.hba.textContent = hba !== null ? roundOrDash(hba, 0) : "—";
      els.tpsa.textContent = tpsa !== null ? roundOrDash(tpsa, 1) + " Å²" : "—";
      els.rot.textContent = rot !== null ? roundOrDash(rot, 0) : "—";

      setStatus("Estrutura desenhada.", "ok");

      current = { smiles: trimmed, formulaRaw: formula, svg: svg };
      setExportButtonsEnabled(true);

      if (addHistory) {
        addToHistory(trimmed, formula);
      }
    } catch (err) {
      setStatus("Erro ao processar o SMILES: " + err.message);
      resetProps();
      current = null;
      setExportButtonsEnabled(false);
    } finally {
      if (mol && typeof mol.delete === "function") {
        mol.delete();
      }
    }
  }

  // ---------- busca por nome (PubChem) ----------

  function searchByName(name) {
    var trimmed = (name || "").trim();
    if (!trimmed) {
      setStatus("Digite um nome para buscar.");
      return;
    }

    els.searchBtn.disabled = true;
    setStatus("Buscando \"" + trimmed + "\" no PubChem…");

    var url =
      PUBCHEM_URL +
      encodeURIComponent(trimmed) +
      "/property/ConnectivitySMILES,CanonicalSMILES,IsomericSMILES,SMILES,IUPACName,InChIKey/JSON";

    fetch(url)
      .then(function (res) {
        if (!res.ok) {
          throw new Error("composto não encontrado (HTTP " + res.status + ")");
        }
        return res.json();
      })
      .then(function (data) {
        var props = data && data.PropertyTable && data.PropertyTable.Properties;
        var first = props && props[0];
        var smiles =
          first &&
          (first.ConnectivitySMILES || first.CanonicalSMILES || first.SMILES || first.IsomericSMILES);
        if (!smiles) {
          throw new Error("resposta do PubChem sem SMILES");
        }
        els.input.value = smiles;
        render(smiles);
        setPubchemFields(first.IUPACName, first.InChIKey);
      })
      .catch(function (err) {
        setStatus("Não foi possível encontrar \"" + trimmed + "\" no PubChem (" + err.message + ").");
      })
      .finally(function () {
        els.searchBtn.disabled = false;
      });
  }

  // ---------- compartilhar / exportar ----------

  function copySmilesToClipboard() {
    if (!current) return;
    var text = current.smiles;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          setStatus("SMILES copiado para a área de transferência.", "ok");
        })
        .catch(function () {
          window.prompt("Copie o SMILES:", text);
        });
    } else {
      window.prompt("Copie o SMILES:", text);
    }
  }

  function buildShareUrl(smiles) {
    var url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("smiles", smiles);
    return url.toString();
  }

  function copyShareLink() {
    if (!current) return;
    var url = buildShareUrl(current.smiles);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(function () {
          setStatus("Link copiado para a área de transferência.", "ok");
        })
        .catch(function () {
          window.prompt("Copie o link:", url);
        });
    } else {
      window.prompt("Copie o link:", url);
    }
  }

  function triggerDownload(href, filename) {
    var a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function downloadSvg() {
    if (!current) return;
    var blob = new Blob([current.svg], { type: "image/svg+xml" });
    var url = URL.createObjectURL(blob);
    triggerDownload(url, "molecula.svg");
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function downloadPng() {
    if (!current) return;
    var svgBlob = new Blob([current.svg], { type: "image/svg+xml" });
    var url = URL.createObjectURL(svgBlob);
    var img = new Image();

    img.onload = function () {
      var scale = 2; // exporta em resolução maior que a tela
      var canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      triggerDownload(canvas.toDataURL("image/png"), "molecula.png");
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      setStatus("Não foi possível gerar o PNG.");
    };

    img.src = url;
  }

  // ---------- inicialização ----------

  var SKELETON_SVG =
    '<svg class="skeleton-mol" viewBox="0 0 200 160" role="img" aria-label="Carregando estrutura">' +
    '<line class="d1" x1="60" y1="40" x2="100" y2="70"/>' +
    '<line class="d2" x1="100" y1="70" x2="60" y2="110"/>' +
    '<line class="d3" x1="100" y1="70" x2="150" y2="55"/>' +
    '<circle class="d1" cx="60" cy="40" r="9"/>' +
    '<circle class="d2" cx="60" cy="110" r="9"/>' +
    '<circle class="d3" cx="150" cy="55" r="8"/>' +
    '<circle class="d4" cx="100" cy="70" r="7"/>' +
    "</svg>";

  function init() {
    els.drawBtn.disabled = true;
    setExportButtonsEnabled(false);
    setStatus("Carregando RDKit…");
    els.canvasWrap.innerHTML = SKELETON_SVG;
    renderHistory();

    document.querySelectorAll(".chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        els.input.value = chip.getAttribute("data-smiles");
        render(els.input.value);
      });
    });

    els.drawBtn.addEventListener("click", function () {
      render(els.input.value);
    });

    els.input.addEventListener("keydown", function (evt) {
      if (evt.key === "Enter") render(els.input.value);
    });

    els.searchBtn.addEventListener("click", function () {
      searchByName(els.nameInput.value);
    });

    els.nameInput.addEventListener("keydown", function (evt) {
      if (evt.key === "Enter") searchByName(els.nameInput.value);
    });

    els.copySmilesBtn.addEventListener("click", copySmilesToClipboard);
    els.shareBtn.addEventListener("click", copyShareLink);
    els.svgBtn.addEventListener("click", downloadSvg);
    els.pngBtn.addEventListener("click", downloadPng);

    if (typeof window.initRDKitModule !== "function") {
      setStatus("Não foi possível carregar o RDKit.js (verifique a conexão).");
      els.canvasWrap.innerHTML = "";
      els.placeholder.textContent = "Não foi possível carregar o RDKit.js.";
      els.canvasWrap.appendChild(els.placeholder);
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
        render(initial, { addHistory: !!fromUrl });
      })
      .catch(function (err) {
        setStatus("Falha ao inicializar o RDKit: " + err.message);
        els.canvasWrap.innerHTML = "";
        els.placeholder.textContent = "Falha ao inicializar o RDKit.";
        els.canvasWrap.appendChild(els.placeholder);
      });
  }

  document.addEventListener("DOMContentLoaded", init);
})();

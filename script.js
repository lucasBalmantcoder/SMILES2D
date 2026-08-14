(function () {
  "use strict";

  var RDKIT_CDN_BASE = "https://unpkg.com/@rdkit/rdkit/Code/MinimalLib/dist/";
  var DEFAULT_SMILES = "CN1C=NC2=C1C(=O)N(C(=O)N2C)C"; // cafeína

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
  };

  var RDKitModule = null;

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
    // Wrap digit runs in <sub> for proper chemical notation (H2O -> H₂O).
    var escaped = raw.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return escaped.replace(/(\d+)/g, "<sub>$1</sub>");
  }

  function roundOrDash(value, digits) {
    if (value === null || value === undefined || isNaN(value)) return "—";
    return Number(value).toFixed(digits === undefined ? 0 : digits);
  }

  function render(smiles) {
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
        return;
      }

      var svg = mol.get_svg(320, 260);
      els.canvasWrap.innerHTML = svg;

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
    } catch (err) {
      setStatus("Erro ao processar o SMILES: " + err.message);
      resetProps();
    } finally {
      if (mol && typeof mol.delete === "function") {
        mol.delete();
      }
    }
  }

  function init() {
    els.drawBtn.disabled = true;
    setStatus("Carregando RDKit…");

    var chips = document.querySelectorAll(".chip");
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        els.input.value = chip.getAttribute("data-smiles");
        render(els.input.value);
      });
    });

    els.drawBtn.addEventListener("click", function () {
      render(els.input.value);
    });

    els.input.addEventListener("keydown", function (evt) {
      if (evt.key === "Enter") {
        render(els.input.value);
      }
    });

    if (typeof window.initRDKitModule !== "function") {
      setStatus("Não foi possível carregar o RDKit.js (verifique a conexão).");
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
        els.input.value = DEFAULT_SMILES;
        render(DEFAULT_SMILES);
      })
      .catch(function (err) {
        setStatus("Falha ao inicializar o RDKit: " + err.message);
      });
  }

  document.addEventListener("DOMContentLoaded", init);
})();

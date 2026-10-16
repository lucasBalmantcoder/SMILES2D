// Interação com o RDKit.js isolada do DOM: recebe o módulo já carregado e
// um SMILES, devolve um objeto simples com o resultado. Quem chama decide
// o que fazer com ele (atualizar a tela, salvar no histórico, etc.).

var PERIODIC_TABLE = {
  1: "H", 2: "He", 3: "Li", 4: "Be", 5: "B", 6: "C", 7: "N", 8: "O", 9: "F", 10: "Ne",
  11: "Na", 12: "Mg", 13: "Al", 14: "Si", 15: "P", 16: "S", 17: "Cl", 18: "Ar",
  19: "K", 20: "Ca", 35: "Br", 53: "I"
};

function extractFormula(mol) {
  try {
    if (typeof mol.get_molformula === "function") {
      var f = mol.get_molformula();
      if (f) return f;
    }
  } catch (e) {}

  try {
    if (typeof mol.get_json === "function") {
      var data = JSON.parse(mol.get_json());
      var atoms = data && data.molecules && data.molecules[0] && data.molecules[0].atoms;
      if (!atoms || !atoms.length) return "n/d";
      var defaultZ = (data.defaults && data.defaults.atom && data.defaults.atom.z) || 6;
      var counts = {};
      for (var i = 0; i < atoms.length; i++) {
        var atom = atoms[i];
        var z = atom.z !== undefined ? atom.z : defaultZ;
        var sym = PERIODIC_TABLE[z] || ("X" + z);
        counts[sym] = (counts[sym] || 0) + 1;
        var impHs = atom.impHs || 0;
        if (impHs > 0) {
          counts["H"] = (counts["H"] || 0) + impHs;
        }
      }
      var res = "";
      if (counts["C"]) {
        res += "C" + (counts["C"] > 1 ? counts["C"] : "");
        delete counts["C"];
        if (counts["H"]) {
          res += "H" + (counts["H"] > 1 ? counts["H"] : "");
          delete counts["H"];
        }
      }
      var remaining = Object.keys(counts).sort();
      for (var j = 0; j < remaining.length; j++) {
        var s = remaining[j];
        res += s + (counts[s] > 1 ? counts[s] : "");
      }
      return res || "n/d";
    }
  } catch (e) {}

  return "n/d";
}

export function renderMolecule(RDKitModule, smiles, options) {
  options = options || {};
  var trimmed = (smiles || "").trim();
  if (!trimmed) {
    return { ok: false, reason: "empty" };
  }

  var mol = null;
  try {
    mol = RDKitModule.get_mol(trimmed);

    if (!mol || !mol.is_valid()) {
      return { ok: false, reason: "invalid" };
    }

    var svg = "";
    if (options.addAtomIndices && typeof mol.get_svg_with_highlights === "function") {
      try {
        svg = mol.get_svg_with_highlights(
          JSON.stringify({ width: 320, height: 260, addAtomIndices: true })
        );
      } catch (e) {
        svg = mol.get_svg(320, 260);
      }
    } else {
      svg = mol.get_svg(320, 260);
    }
    var formula = extractFormula(mol);

    var molfile = "";
    try {
      if (typeof mol.get_molblock === "function") {
        molfile = mol.get_molblock();
      } else if (typeof mol.get_v2Kmolblock === "function") {
        molfile = mol.get_v2Kmolblock();
      } else if (typeof mol.get_molfile === "function") {
        molfile = mol.get_molfile();
      }
    } catch (e) {
      molfile = "";
    }

    var descriptors = {};
    try {
      descriptors = JSON.parse(mol.get_descriptors());
    } catch (e) {
      descriptors = {};
    }

    return {
      ok: true,
      smiles: trimmed,
      svg: svg,
      formula: formula,
      molfile: molfile,
      descriptors: descriptors,
    };
  } catch (err) {
    return { ok: false, reason: "exception", message: err.message };
  } finally {
    if (mol && typeof mol.delete === "function") {
      mol.delete();
    }
  }
}

// Módulo de pesquisa e correspondência de subestruturas e grupos funcionais (SMARTS)
// Utiliza get_qmol e get_substruct_matches do RDKit.js para identificar átomos e ligações.

export var FUNCTIONAL_GROUPS = [
  { name: "Álcool", smarts: "[OX2H]", desc: "Hidroxila / Álcool (-OH)" },
  { name: "Carboxila", smarts: "[CX3](=O)[OX2H1]", desc: "Ácido carboxílico (-COOH)" },
  { name: "Amina", smarts: "[NX3;H2,H1;!$(NC=O)]", desc: "Amina primária ou secundária" },
  { name: "Amida", smarts: "[NX3][CX3](=[OX1])[#6]", desc: "Amida (-CONH-)" },
  { name: "Éster", smarts: "[#6][CX3](=O)[OX2H0][#6]", desc: "Éster (-COO-)" },
  { name: "Carbonila", smarts: "[CX3]=[OX1]", desc: "Cetona ou Aldeído (C=O)" },
  { name: "Aromático", smarts: "c1ccccc1", desc: "Anel fenila / benzeno" },
  { name: "Halogênio", smarts: "[F,Cl,Br,I]", desc: "Haleto (F, Cl, Br, I)" },
  { name: "Éter", smarts: "[OD2]([#6])[#6]", desc: "Éter (R-O-R)" },
  { name: "Nitro", smarts: "[$([NX3](=O)=O),$([NX3+](=O)[O-])]", desc: "Grupo nitro (-NO₂)" },
];

export function findSubstructure(RDKitModule, smiles, smarts) {
  var trimmedSmiles = (smiles || "").trim();
  var trimmedSmarts = (smarts || "").trim();

  if (!trimmedSmiles || !trimmedSmarts) {
    return { ok: false, reason: "empty", atoms: [], bonds: [], matchCount: 0 };
  }

  if (!RDKitModule) {
    return { ok: false, reason: "no_module", atoms: [], bonds: [], matchCount: 0 };
  }

  var mol = null;
  var qmol = null;

  try {
    mol = RDKitModule.get_mol(trimmedSmiles);
    if (!mol || (typeof mol.is_valid === "function" && !mol.is_valid())) {
      return { ok: false, reason: "invalid_mol", atoms: [], bonds: [], matchCount: 0 };
    }

    if (typeof RDKitModule.get_qmol !== "function") {
      return { ok: false, reason: "unsupported", atoms: [], bonds: [], matchCount: 0 };
    }

    qmol = RDKitModule.get_qmol(trimmedSmarts);
    if (!qmol || (typeof qmol.is_valid === "function" && !qmol.is_valid())) {
      return { ok: false, reason: "invalid_smarts", atoms: [], bonds: [], matchCount: 0 };
    }

    if (typeof mol.get_substruct_matches !== "function") {
      return { ok: false, reason: "unsupported", atoms: [], bonds: [], matchCount: 0 };
    }

    var matchesRaw = mol.get_substruct_matches(qmol);
    var matches = [];
    try {
      matches = JSON.parse(matchesRaw);
    } catch (e) {
      matches = [];
    }

    if (!Array.isArray(matches) || matches.length === 0) {
      return { ok: true, atoms: [], bonds: [], matchCount: 0 };
    }

    var atomSet = new Set();
    var bondSet = new Set();

    for (var i = 0; i < matches.length; i++) {
      var m = matches[i];
      if (m && Array.isArray(m.atoms)) {
        for (var a = 0; a < m.atoms.length; a++) atomSet.add(m.atoms[a]);
      }
      if (m && Array.isArray(m.bonds)) {
        for (var b = 0; b < m.bonds.length; b++) bondSet.add(m.bonds[b]);
      }
    }

    return {
      ok: true,
      atoms: Array.from(atomSet),
      bonds: Array.from(bondSet),
      matchCount: matches.length,
    };
  } catch (err) {
    return { ok: false, reason: "exception", message: err.message, atoms: [], bonds: [], matchCount: 0 };
  } finally {
    if (mol && typeof mol.delete === "function") {
      mol.delete();
    }
    if (qmol && typeof qmol.delete === "function") {
      qmol.delete();
    }
  }
}


// Interação com o RDKit.js isolada do DOM: recebe o módulo já carregado e
// um SMILES, devolve um objeto simples com o resultado. Quem chama decide
// o que fazer com ele (atualizar a tela, salvar no histórico, etc.).

export function renderMolecule(RDKitModule, smiles) {
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

    var svg = mol.get_svg(320, 260);

    var formula = "n/d";
    try {
      if (typeof mol.get_molformula === "function") {
        formula = mol.get_molformula();
      }
    } catch (e) {
      formula = "n/d";
    }

    var descriptors = {};
    try {
      descriptors = JSON.parse(mol.get_descriptors());
    } catch (e) {
      descriptors = {};
    }

    return { ok: true, smiles: trimmed, svg: svg, formula: formula, descriptors: descriptors };
  } catch (err) {
    return { ok: false, reason: "exception", message: err.message };
  } finally {
    if (mol && typeof mol.delete === "function") {
      mol.delete();
    }
  }
}

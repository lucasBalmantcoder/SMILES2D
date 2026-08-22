import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMolecule } from "../js/molecule.js";

// Módulo RDKit falso: implementa só o que renderMolecule usa, o suficiente
// para testar a lógica sem carregar o WASM real do RDKit.js.
function makeFakeRDKit({ valid = true, throwOnParse = false } = {}) {
  var deleted = false;

  return {
    deleted: () => deleted,
    get_mol: function (_smiles) {
      if (throwOnParse) throw new Error("falha simulada de parsing");
      if (!valid) return { is_valid: () => false, delete: () => (deleted = true) };
      return {
        is_valid: () => true,
        get_svg: () => "<svg>mock</svg>",
        get_molformula: () => "C8H10N4O2",
        get_descriptors: () => JSON.stringify({ amw: 194.19, NumRings: 2, NumHBD: 0, NumHBA: 3 }),
        delete: () => (deleted = true),
      };
    },
  };
}

test("renderMolecule: SMILES vazio retorna ok:false, reason:'empty'", () => {
  var result = renderMolecule(makeFakeRDKit(), "   ");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "empty");
});

test("renderMolecule: molécula inválida retorna ok:false, reason:'invalid'", () => {
  var result = renderMolecule(makeFakeRDKit({ valid: false }), "not a smiles");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid");
});

test("renderMolecule: exceção do RDKit é capturada como reason:'exception'", () => {
  var result = renderMolecule(makeFakeRDKit({ throwOnParse: true }), "C");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "exception");
  assert.ok(result.message.includes("falha simulada"));
});

test("renderMolecule: caso válido retorna svg, fórmula e descritores", () => {
  var result = renderMolecule(makeFakeRDKit(), "CN1C=NC2=C1C(=O)N(C(=O)N2C)C");
  assert.equal(result.ok, true);
  assert.equal(result.svg, "<svg>mock</svg>");
  assert.equal(result.formula, "C8H10N4O2");
  assert.equal(result.descriptors.amw, 194.19);
  assert.equal(result.descriptors.NumRings, 2);
});

test("renderMolecule: sempre libera a memória do mol (chama delete)", () => {
  var rdkit = makeFakeRDKit();
  renderMolecule(rdkit, "CCO");
  assert.equal(rdkit.deleted(), true);
});

test("renderMolecule: libera a memória mesmo quando a molécula é inválida", () => {
  var rdkit = makeFakeRDKit({ valid: false });
  renderMolecule(rdkit, "xyz");
  assert.equal(rdkit.deleted(), true);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { findSubstructure, FUNCTIONAL_GROUPS } from "../js/substructure.js";
import { renderMolecule } from "../js/molecule.js";

function makeFakeRDKitSubstruct({
  validMol = true,
  validQmol = true,
  matches = [{ atoms: [0, 1], bonds: [0] }],
} = {}) {
  var deletedMol = false;
  var deletedQmol = false;

  return {
    deletedMol: () => deletedMol,
    deletedQmol: () => deletedQmol,
    get_mol: function (_smiles) {
      if (!validMol) return { is_valid: () => false, delete: () => (deletedMol = true) };
      return {
        is_valid: () => true,
        get_svg: () => "<svg>normal</svg>",
        get_svg_with_highlights: (details) => "<svg>highlighted:" + details + "</svg>",
        get_molformula: () => "C2H6O",
        get_descriptors: () => "{}",
        get_substruct_matches: (_qmol) => JSON.stringify(matches),
        delete: () => (deletedMol = true),
      };
    },
    get_qmol: function (_smarts) {
      if (!validQmol) return { is_valid: () => false, delete: () => (deletedQmol = true) };
      return {
        is_valid: () => true,
        delete: () => (deletedQmol = true),
      };
    },
  };
}

test("FUNCTIONAL_GROUPS: possui lista de grupos com nome e smarts", () => {
  assert.ok(Array.isArray(FUNCTIONAL_GROUPS));
  assert.ok(FUNCTIONAL_GROUPS.length >= 8);
  var alcool = FUNCTIONAL_GROUPS.find((g) => g.name === "Álcool");
  assert.ok(alcool);
  assert.equal(alcool.smarts, "[OX2H]");
});

test("findSubstructure: retorna empty para smiles ou smarts vazios", () => {
  var fake = makeFakeRDKitSubstruct();
  var r1 = findSubstructure(fake, "", "[OX2H]");
  assert.equal(r1.ok, false);
  assert.equal(r1.reason, "empty");

  var r2 = findSubstructure(fake, "CCO", "");
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, "empty");
});

test("findSubstructure: captura matches e agrega átomos e ligações únicos", () => {
  var fake = makeFakeRDKitSubstruct({
    matches: [
      { atoms: [0, 1], bonds: [0] },
      { atoms: [1, 2], bonds: [1] },
    ],
  });

  var result = findSubstructure(fake, "CCO", "[OX2H]");
  assert.equal(result.ok, true);
  assert.equal(result.matchCount, 2);
  assert.deepEqual(result.atoms.sort(), [0, 1, 2]);
  assert.deepEqual(result.bonds.sort(), [0, 1]);
  assert.equal(fake.deletedMol(), true);
  assert.equal(fake.deletedQmol(), true);
});

test("findSubstructure: retorna matchCount 0 quando não encontra correspondência", () => {
  var fake = makeFakeRDKitSubstruct({ matches: [] });
  var result = findSubstructure(fake, "C", "[OX2H]");
  assert.equal(result.ok, true);
  assert.equal(result.matchCount, 0);
  assert.deepEqual(result.atoms, []);
  assert.deepEqual(result.bonds, []);
});

test("findSubstructure: detecta smarts inválido", () => {
  var fake = makeFakeRDKitSubstruct({ validQmol: false });
  var result = findSubstructure(fake, "CCO", "[[[invalido");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_smarts");
});

test("renderMolecule: renderiza com highlightAtoms e highlightBonds", () => {
  var fake = makeFakeRDKitSubstruct();
  var result = renderMolecule(fake, "CCO", {
    highlightAtoms: [0, 1],
    highlightBonds: [0],
  });
  assert.equal(result.ok, true);
  assert.ok(result.svg.includes("highlighted:"));
  assert.ok(result.svg.includes('"atoms":[0,1]'));
  assert.ok(result.svg.includes('"bonds":[0]'));
});

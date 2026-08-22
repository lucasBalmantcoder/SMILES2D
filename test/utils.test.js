import { test } from "node:test";
import assert from "node:assert/strict";
import { pick, formatFormula, roundOrDash } from "../js/utils.js";

test("pick: retorna o valor da primeira chave presente", () => {
  assert.equal(pick({ b: 2 }, ["a", "b", "c"]), 2);
});

test("pick: ignora chaves ausentes ou nulas", () => {
  assert.equal(pick({ a: null, b: undefined, c: 5 }, ["a", "b", "c"]), 5);
});

test("pick: retorna null quando nenhuma chave existe", () => {
  assert.equal(pick({ x: 1 }, ["a", "b"]), null);
});

test("pick: aceita valor 0 como presente (não confunde com ausente)", () => {
  assert.equal(pick({ a: 0 }, ["a", "b"]), 0);
});

test("formatFormula: envolve dígitos em <sub>", () => {
  assert.equal(formatFormula("C8H10N4O2"), "C<sub>8</sub>H<sub>10</sub>N<sub>4</sub>O<sub>2</sub>");
});

test("formatFormula: escapa < e > antes de formatar", () => {
  assert.equal(formatFormula("<script>2"), "&lt;script&gt;<sub>2</sub>");
});

test("formatFormula: retorna 'n/d' para valor vazio ou nulo", () => {
  assert.equal(formatFormula(""), "n/d");
  assert.equal(formatFormula(null), "n/d");
});

test("roundOrDash: arredonda para o número de casas pedido", () => {
  assert.equal(roundOrDash(180.1559, 2), "180.16");
  assert.equal(roundOrDash(4, 0), "4");
});

test("roundOrDash: usa 0 casas quando digits não é informado", () => {
  assert.equal(roundOrDash(4.7), "5");
});

test("roundOrDash: retorna travessão para valores inválidos", () => {
  assert.equal(roundOrDash(null), "—");
  assert.equal(roundOrDash(undefined), "—");
  assert.equal(roundOrDash(NaN), "—");
});

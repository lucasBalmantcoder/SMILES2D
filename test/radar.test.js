import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateEsolLogS,
  normalizeAxisValue,
  evaluateBioavailability,
  renderRadarSvg,
  RADAR_AXES,
} from "../js/radar.js";

test("calculateEsolLogS: calcula solubilidade aquosa pelo modelo Delaney", () => {
  // Exemplo cafeína aproximado: LogP=-0.07, MW=194.19, rotb=0, aromaticRatio=0.5
  var logs = calculateEsolLogS({
    logp: -0.07,
    mw: 194.19,
    rotb: 0,
    aromaticRatio: 0.5,
  });
  // 0.16 - 0.63*(-0.07) - 0.0062*194.19 + 0.066*0 - 0.74*0.5 = 0.16 + 0.0441 - 1.2039 - 0.37 = -1.37
  assert.ok(typeof logs === "number");
  assert.ok(logs < 0 && logs > -3);
});

test("calculateEsolLogS: retorna null para parâmetros inválidos ou ausentes", () => {
  assert.equal(calculateEsolLogS(null), null);
  assert.equal(calculateEsolLogS({ logp: NaN, mw: 200 }), null);
  assert.equal(calculateEsolLogS({ logp: 1.0, mw: NaN }), null);
});

test("normalizeAxisValue: restringe e normaliza valores no intervalo [0, 1]", () => {
  var sizeAxis = RADAR_AXES.find((a) => a.key === "size"); // min: 50, max: 800
  assert.equal(normalizeAxisValue(50, sizeAxis), 0);
  assert.equal(normalizeAxisValue(800, sizeAxis), 1);
  assert.equal(normalizeAxisValue(425, sizeAxis), 0.5);
  // Clamping
  assert.equal(normalizeAxisValue(10, sizeAxis), 0);
  assert.equal(normalizeAxisValue(1000, sizeAxis), 1);
  // Indefinido retorna 0.5
  assert.equal(normalizeAxisValue(null, sizeAxis), 0.5);
});

test("evaluateBioavailability: avalia os 6 eixos corretamente (caso ótimo: cafeína)", () => {
  var result = evaluateBioavailability({
    mw: 194.19,
    logp: -0.07,
    tpsa: 61.82,
    rotb: 0,
    fsp3: 0.38,
    aromaticRatio: 0.5,
  });

  assert.ok(result);
  assert.equal(result.totalAxes, 6);
  assert.equal(result.passedCount, 6);
  assert.equal(result.isFullyOptimal, true);
  assert.deepEqual(result.deviations, []);
  assert.ok(typeof result.logS === "number");
});

test("evaluateBioavailability: detecta desvios de biodisponibilidade", () => {
  var result = evaluateBioavailability({
    mw: 950, // acima de 500
    logp: 7.2, // acima de 5.0
    tpsa: 210, // acima de 130
    rotb: 14, // acima de 9
    fsp3: 0.1, // abaixo de 0.25
    logS: -8.5, // abaixo de -6.0
  });

  assert.ok(result);
  assert.equal(result.passedCount, 0);
  assert.equal(result.isFullyOptimal, false);
  assert.equal(result.deviations.length, 6);
});

test("renderRadarSvg: gera SVG estruturado com eixos e polígonos", () => {
  var evalResult = evaluateBioavailability({
    mw: 194.19,
    logp: -0.07,
    tpsa: 61.82,
    rotb: 0,
    fsp3: 0.38,
    aromaticRatio: 0.5,
  });

  var svg = renderRadarSvg(evalResult, { width: 320, height: 280 });
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.endsWith("</svg>"));
  assert.ok(svg.includes("radar-opt-zone-max"));
  assert.ok(svg.includes("radar-mol-poly"));
  assert.ok(svg.includes("LIPO"));
  assert.ok(svg.includes("SIZE"));
  assert.ok(svg.includes("POLAR"));
  assert.ok(svg.includes("INSOLU"));
  assert.ok(svg.includes("INSATU"));
  assert.ok(svg.includes("FLEX"));
});

test("renderRadarSvg: gera fallback gracioso quando dados são nulos ou vazios", () => {
  var svg = renderRadarSvg(null);
  assert.ok(svg.includes("Sem dados suficientes"));
});


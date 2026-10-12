// Utilitários puros de formatação — sem acesso ao DOM ou a APIs externas.

// Procura a primeira chave presente numa lista de candidatas, já que o
// nome exato de alguns descritores mudou entre versões do RDKit.js.
export function pick(obj, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    if (obj[candidates[i]] !== undefined && obj[candidates[i]] !== null) {
      return obj[candidates[i]];
    }
  }
  return null;
}

// Envolve sequências de dígitos em <sub> para notação química (H2O -> H₂O).
export function formatFormula(raw) {
  if (!raw) return "n/d";
  var escaped = raw.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(/(\d+)/g, "<sub>$1</sub>");
}

export function roundOrDash(value, digits) {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return Number(value).toFixed(digits === undefined ? 0 : digits);
}

// Avalia a conformidade com a Regra dos 5 de Lipinski (drug-likeness):
// - Massa molar <= 500 Da
// - LogP (Crippen) <= 5
// - Doadores de hidrogênio (HBD) <= 5
// - Aceptores de hidrogênio (HBA) <= 10
// Pela regra clássica, até 1 violação ainda é aceitável para compostos orais.
export function calculateLipinski(params) {
  if (!params) return null;
  var mw = params.mw;
  var logp = params.logp;
  var hbd = params.hbd;
  var hba = params.hba;

  if (
    mw === null || mw === undefined || isNaN(mw) ||
    logp === null || logp === undefined || isNaN(logp) ||
    hbd === null || hbd === undefined || isNaN(hbd) ||
    hba === null || hba === undefined || isNaN(hba)
  ) {
    return null;
  }

  var violations = [];
  if (Number(mw) > 500) violations.push("Massa > 500 Da");
  if (Number(logp) > 5) violations.push("LogP > 5");
  if (Number(hbd) > 5) violations.push("Doadores H > 5");
  if (Number(hba) > 10) violations.push("Aceptores H > 10");

  return {
    violationsCount: violations.length,
    violations: violations,
    pass: violations.length <= 1,
  };
}


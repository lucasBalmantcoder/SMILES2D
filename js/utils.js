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

// Histórico das últimas moléculas consultadas, persistido em localStorage.

var HISTORY_KEY = "leitorSmiles.history";
var HISTORY_MAX = 8;

export function loadHistory() {
  try {
    var raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveHistory(list) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch (e) {
    // localStorage indisponível (ex.: modo privado) — sem histórico persistente.
  }
}

export function addToHistory(smiles, formulaRaw) {
  var list = loadHistory().filter(function (item) {
    return item.smiles !== smiles;
  });
  list.unshift({ smiles: smiles, formula: formulaRaw || "" });
  list = list.slice(0, HISTORY_MAX);
  saveHistory(list);
  return list;
}

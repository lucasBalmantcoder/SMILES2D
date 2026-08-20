// Busca de compostos por nome comum via API pública do PubChem (PUG REST).
// A API espera nomes em inglês / sinônimos químicos formais.

var PUBCHEM_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/";
var PROPERTIES = "ConnectivitySMILES,CanonicalSMILES,IsomericSMILES,SMILES,IUPACName,InChIKey";

export function fetchByName(name) {
  var trimmed = (name || "").trim();
  if (!trimmed) {
    return Promise.reject(new Error("Digite um nome para buscar."));
  }

  var url = PUBCHEM_URL + encodeURIComponent(trimmed) + "/property/" + PROPERTIES + "/JSON";

  return fetch(url)
    .then(function (res) {
      if (!res.ok) {
        throw new Error("composto não encontrado (HTTP " + res.status + ")");
      }
      return res.json();
    })
    .then(function (data) {
      var props = data && data.PropertyTable && data.PropertyTable.Properties;
      var first = props && props[0];
      var smiles =
        first &&
        (first.ConnectivitySMILES || first.CanonicalSMILES || first.SMILES || first.IsomericSMILES);

      if (!smiles) {
        throw new Error("resposta do PubChem sem SMILES");
      }

      return { smiles: smiles, iupacName: first.IUPACName, inchikey: first.InChIKey };
    });
}

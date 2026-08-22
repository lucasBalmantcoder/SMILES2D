// Visualização 3D. O RDKit.js (build "minimal") não gera conformações 3D,
// então a estrutura tridimensional vem do PubChem: primeiro resolvemos o
// SMILES para um CID, depois buscamos o SDF 3D desse composto e renderizamos
// com 3Dmol.js. Isso significa que só funciona para compostos já catalogados
// no PubChem — não para SMILES arbitrários sem correspondência lá.

var PUBCHEM_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/";

function findCidBySmiles(smiles) {
  return fetch(PUBCHEM_BASE + "smiles/cids/JSON", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "smiles=" + encodeURIComponent(smiles),
  })
    .then(function (res) {
      if (!res.ok) {
        throw new Error("composto não encontrado no PubChem (HTTP " + res.status + ")");
      }
      return res.json();
    })
    .then(function (data) {
      var cid = data && data.IdentifierList && data.IdentifierList.CID && data.IdentifierList.CID[0];
      if (!cid) {
        throw new Error("CID não encontrado para este SMILES");
      }
      return cid;
    });
}

function fetchSdf3d(cid) {
  return fetch(PUBCHEM_BASE + "cid/" + cid + "/SDF?record_type=3d").then(function (res) {
    if (!res.ok) {
      throw new Error("estrutura 3D indisponível para este composto");
    }
    return res.text();
  });
}

export function fetchSdf3dBySmiles(smiles) {
  return findCidBySmiles(smiles).then(fetchSdf3d);
}

// Renderiza o SDF num container já visível na página. Requer que a
// biblioteca 3Dmol.js (global $3Dmol) já esteja carregada.
export function renderViewer(containerEl, sdfText) {
  containerEl.innerHTML = "";

  if (typeof window.$3Dmol === "undefined") {
    throw new Error("biblioteca 3Dmol.js não carregada");
  }

  var viewer = window.$3Dmol.createViewer(containerEl, { backgroundColor: "0xE8EDEA" });
  viewer.addModel(sdfText, "sdf");
  viewer.setStyle({}, { stick: { radius: 0.15 }, sphere: { scale: 0.25 } });
  viewer.zoomTo();
  viewer.render();
  return viewer;
}

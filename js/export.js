// Compartilhamento (link/SMILES) e exportação da estrutura como arquivo.

export function buildShareUrl(smiles) {
  var url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("smiles", smiles);
  return url.toString();
}

export function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error("clipboard indisponível"));
}

function triggerDownload(href, filename) {
  var a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function downloadSvg(svgString, filename) {
  var blob = new Blob([svgString], { type: "image/svg+xml" });
  var url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);
}

// Converte o SVG em PNG via <canvas>, numa resolução maior que a tela.
export function downloadPng(svgString, filename, scale) {
  return new Promise(function (resolve, reject) {
    var svgBlob = new Blob([svgString], { type: "image/svg+xml" });
    var url = URL.createObjectURL(svgBlob);
    var img = new Image();

    img.onload = function () {
      var factor = scale || 2;
      var canvas = document.createElement("canvas");
      canvas.width = img.width * factor;
      canvas.height = img.height * factor;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      triggerDownload(canvas.toDataURL("image/png"), filename);
      resolve();
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível gerar o PNG."));
    };

    img.src = url;
  });
}

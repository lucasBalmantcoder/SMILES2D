// Módulo de cálculo e renderização do Radar de Biodisponibilidade (SwissADME)
// Avalia 6 propriedades físico-químicas determinantes para absorção oral:
// LIPO (Lipofilicidade), SIZE (Tamanho), POLAR (Polaridade),
// INSOLU (Insolubilidade ESOL), INSATU (Insaturação/Fsp3) e FLEX (Flexibilidade).

export var RADAR_AXES = [
  {
    key: "lipo",
    label: "LIPO",
    fullName: "Lipofilicidade",
    unit: "LogP",
    min: -2.0,
    max: 6.5,
    optMin: -0.7,
    optMax: 5.0,
    format: function (v) {
      return v !== null ? v.toFixed(2) : "—";
    },
  },
  {
    key: "size",
    label: "SIZE",
    fullName: "Tamanho",
    unit: "g/mol",
    min: 50,
    max: 800,
    optMin: 150,
    optMax: 500,
    format: function (v) {
      return v !== null ? v.toFixed(1) + " g/mol" : "—";
    },
  },
  {
    key: "polar",
    label: "POLAR",
    fullName: "Polaridade",
    unit: "Å²",
    min: 0,
    max: 180,
    optMin: 20,
    optMax: 130,
    format: function (v) {
      return v !== null ? v.toFixed(1) + " Å²" : "—";
    },
  },
  {
    key: "insolu",
    label: "INSOLU",
    fullName: "Insolubilidade (ESOL)",
    unit: "Log S",
    min: -10.0,
    max: 1.0,
    // -6.0 a 0.0 é a faixa de solubilidade favorável para absorção oral
    optMin: -6.0,
    optMax: 0.0,
    format: function (v) {
      return v !== null ? v.toFixed(2) : "—";
    },
  },
  {
    key: "insatu",
    label: "INSATU",
    fullName: "Insaturação (Fsp3)",
    unit: "",
    min: 0.0,
    max: 1.0,
    optMin: 0.25,
    optMax: 1.0,
    format: function (v) {
      return v !== null ? v.toFixed(2) : "—";
    },
  },
  {
    key: "flex",
    label: "FLEX",
    fullName: "Flexibilidade",
    unit: "ligações",
    min: 0,
    max: 15,
    optMin: 0,
    optMax: 9,
    format: function (v) {
      return v !== null ? String(Math.round(v)) : "—";
    },
  },
];

// Estima a solubilidade aquosa (LogS) pelo modelo ESOL (Delaney, 2004)
// LogS = 0.16 - 0.63 * ClogP - 0.0062 * MW + 0.066 * RotBonds - 0.74 * AromaticProportion
export function calculateEsolLogS(params) {
  if (!params) return null;
  var logp = Number(params.logp);
  var mw = Number(params.mw);
  var rotb = Number(params.rotb !== undefined ? params.rotb : 0);
  var aromaticRatio = Number(params.aromaticRatio !== undefined ? params.aromaticRatio : 0);

  if (isNaN(logp) || isNaN(mw)) return null;

  var logs = 0.16 - 0.63 * logp - 0.0062 * mw + 0.066 * rotb - 0.74 * aromaticRatio;
  return Number(logs.toFixed(2));
}

// Normaliza um valor dentro dos limites do eixo [min, max] para uma fração [0, 1]
export function normalizeAxisValue(value, axis) {
  if (value === null || value === undefined || isNaN(value)) {
    return 0.5; // centro padrão quando desconhecido
  }
  var clamped = Math.max(axis.min, Math.min(axis.max, Number(value)));
  return (clamped - axis.min) / (axis.max - axis.min);
}

// Avalia todos os 6 parâmetros e retorna dados prontos para o gráfico e relatório
export function evaluateBioavailability(data) {
  if (!data) return null;

  var logp = data.logp !== null && data.logp !== undefined ? Number(data.logp) : null;
  var mw = data.mw !== null && data.mw !== undefined ? Number(data.mw) : null;
  var tpsa = data.tpsa !== null && data.tpsa !== undefined ? Number(data.tpsa) : null;
  var rotb = data.rotb !== null && data.rotb !== undefined ? Number(data.rotb) : null;
  var fsp3 = data.fsp3 !== null && data.fsp3 !== undefined ? Number(data.fsp3) : 0;
  var aromaticRatio = data.aromaticRatio !== null && data.aromaticRatio !== undefined ? Number(data.aromaticRatio) : 0;

  var logS =
    data.logS !== undefined && data.logS !== null
      ? Number(data.logS)
      : calculateEsolLogS({ logp: logp, mw: mw, rotb: rotb, aromaticRatio: aromaticRatio });

  var valuesMap = {
    lipo: logp,
    size: mw,
    polar: tpsa,
    insolu: logS,
    insatu: fsp3,
    flex: rotb,
  };

  var axesResults = [];
  var passedCount = 0;
  var deviations = [];

  for (var i = 0; i < RADAR_AXES.length; i++) {
    var axis = RADAR_AXES[i];
    var val = valuesMap[axis.key];
    var hasValue = val !== null && val !== undefined && !isNaN(val);
    var isOptimal = false;

    if (hasValue) {
      isOptimal = val >= axis.optMin && val <= axis.optMax;
    }

    if (isOptimal) {
      passedCount++;
    } else if (hasValue) {
      var reason = val < axis.optMin ? "abaixo do ideal" : "acima do ideal";
      deviations.push(axis.label + " (" + reason + ")");
    }

    var normVal = normalizeAxisValue(val, axis);
    var normOptMin = normalizeAxisValue(axis.optMin, axis);
    var normOptMax = normalizeAxisValue(axis.optMax, axis);

    axesResults.push({
      axis: axis,
      value: val,
      hasValue: hasValue,
      isOptimal: isOptimal,
      normVal: normVal,
      normOptMin: normOptMin,
      normOptMax: normOptMax,
    });
  }

  var isFullyOptimal = passedCount === RADAR_AXES.length;

  return {
    axes: axesResults,
    passedCount: passedCount,
    totalAxes: RADAR_AXES.length,
    isFullyOptimal: isFullyOptimal,
    deviations: deviations,
    logS: logS,
  };
}

// Converte coordenadas polares (raio normalizado, índice de eixo) em coordenadas (x, y) no SVG
function polarToCartesian(cx, cy, radius, index, total) {
  // O primeiro eixo (índice 0, LIPO) aponta para cima (-PI/2)
  var angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

// Gera a string SVG do gráfico radar
export function renderRadarSvg(evalResult, options) {
  options = options || {};
  var width = options.width || 300;
  var height = options.height || 260;
  var cx = width / 2;
  var cy = height / 2;
  var maxRadius = Math.min(cx, cy) - 34; // margem para rótulos

  if (!evalResult || !evalResult.axes || !evalResult.axes.length) {
    return (
      '<svg class="radar-svg" viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="Radar de biodisponibilidade">' +
      '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" class="radar-empty-text">Sem dados suficientes</text>' +
      "</svg>"
    );
  }

  var axes = evalResult.axes;
  var total = axes.length;

  // Grade de fundo concêntrica (3 níveis: 33%, 66%, 100%)
  var gridPolygons = "";
  var gridLevels = [0.33, 0.66, 1.0];
  for (var gl = 0; gl < gridLevels.length; gl++) {
    var pts = [];
    var lvlRadius = maxRadius * gridLevels[gl];
    for (var i = 0; i < total; i++) {
      var p = polarToCartesian(cx, cy, lvlRadius, i, total);
      pts.push(p.x.toFixed(1) + "," + p.y.toFixed(1));
    }
    gridPolygons += '<polygon points="' + pts.join(" ") + '" class="radar-grid-poly"/>';
  }

  // Raios e rótulos
  var axesLines = "";
  var labels = "";
  for (var j = 0; j < total; j++) {
    var item = axes[j];
    var endPoint = polarToCartesian(cx, cy, maxRadius, j, total);
    axesLines += '<line x1="' + cx + '" y1="' + cy + '" x2="' + endPoint.x.toFixed(1) + '" y2="' + endPoint.y.toFixed(1) + '" class="radar-axis-line"/>';

    // Rótulo posicionado um pouco além do raio máximo
    var labelRadius = maxRadius + 18;
    var lp = polarToCartesian(cx, cy, labelRadius, j, total);

    var textAnchor = "middle";
    if (lp.x < cx - 10) textAnchor = "end";
    else if (lp.x > cx + 10) textAnchor = "start";

    var labelClass = "radar-label" + (!item.isOptimal ? " radar-label-warn" : "");
    var formattedVal = item.axis.format(item.value);
    labels +=
      '<text x="' + lp.x.toFixed(1) + '" y="' + (lp.y + 4).toFixed(1) + '" text-anchor="' + textAnchor + '" class="' + labelClass + '">' +
      item.axis.label +
      '<tspan class="radar-label-sub" dy="1.1em" x="' + lp.x.toFixed(1) + '">' + formattedVal + "</tspan>" +
      "</text>";
  }

  // Polígono da ZONA ÓTIMA (Optimal Area)
  // Como a faixa ideal é [optMin, optMax], desenhamos a faixa entre o polígono min e max
  // Para clareza gráfica impecável, desenhamos o polígono da faixa ideal externa e interna
  var optMaxPts = [];
  var optMinPts = [];
  for (var k = 0; k < total; k++) {
    var a = axes[k];
    var rMax = maxRadius * a.normOptMax;
    var rMin = maxRadius * a.normOptMin;
    var pMax = polarToCartesian(cx, cy, rMax, k, total);
    var pMin = polarToCartesian(cx, cy, rMin, k, total);
    optMaxPts.push(pMax.x.toFixed(1) + "," + pMax.y.toFixed(1));
    optMinPts.push(pMin.x.toFixed(1) + "," + pMin.y.toFixed(1));
  }

  // Polígono da molécula
  var molPts = [];
  var vertexCircles = "";
  for (var m = 0; m < total; m++) {
    var ax = axes[m];
    var molR = maxRadius * ax.normVal;
    var mp = polarToCartesian(cx, cy, molR, m, total);
    molPts.push(mp.x.toFixed(1) + "," + mp.y.toFixed(1));

    var circleClass = ax.isOptimal ? "radar-point" : "radar-point radar-point-warn";
    var titleText = ax.axis.fullName + ": " + ax.axis.format(ax.value) + " (Ideal: " + ax.axis.format(ax.axis.optMin) + " a " + ax.axis.format(ax.axis.optMax) + ")";
    vertexCircles +=
      '<circle cx="' + mp.x.toFixed(1) + '" cy="' + mp.y.toFixed(1) + '" r="4" class="' + circleClass + '">' +
      "<title>" + titleText + "</title>" +
      "</circle>";
  }

  return (
    '<svg class="radar-svg" viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="Gráfico de radar de biodisponibilidade oral">' +
    // Grade de fundo
    '<g class="radar-grid">' + gridPolygons + axesLines + "</g>" +
    // Zona ótima
    '<polygon points="' + optMaxPts.join(" ") + '" class="radar-opt-zone-max"/>' +
    '<polygon points="' + optMinPts.join(" ") + '" class="radar-opt-zone-min"/>' +
    // Polígono da molécula
    '<polygon points="' + molPts.join(" ") + '" class="radar-mol-poly"/>' +
    // Pontos e rótulos
    '<g class="radar-points">' + vertexCircles + "</g>" +
    '<g class="radar-labels">' + labels + "</g>" +
    "</svg>"
  );
}


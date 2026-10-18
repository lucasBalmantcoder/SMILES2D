// Service Worker — Leitor de SMILES (PWA Offline)
var CACHE_NAME = "smiles2d-v4";

var PRECACHE_URLS = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./js/app.js",
  "./js/dom.js",
  "./js/export.js",
  "./js/history.js",
  "./js/molecule.js",
  "./js/pubchem.js",
  "./js/radar.js",
  "./js/substructure.js",
  "./js/theme.js",
  "./js/utils.js",
  "./js/viewer3d.js",
];

// Instalação: baixa os arquivos estáticos essenciais
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(PRECACHE_URLS);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

// Ativação: remove versões antigas do cache
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames.map(function (cacheName) {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

// Interceptação de requisições:
// - Para navegação: busca na rede com fallback para o index em cache
// - Para CDN (RDKit, WASM, 3Dmol, Fontes) e arquivos locais: cache-first com preenchimento dinâmico
// - Para chamadas da API PubChem: rede apenas (requer internet para buscar novos compostos)
self.addEventListener("fetch", function (event) {
  var request = event.request;

  // Apenas métodos GET podem ser armazenados em cache
  if (request.method !== "GET") {
    return;
  }

  var url = new URL(request.url);

  // APIs externas que não devem ser cacheadas (PubChem)
  if (url.hostname.includes("pubchem.ncbi.nlm.nih.gov")) {
    return;
  }

  // Requisições de navegação (HTML principal)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(function (networkResponse) {
          return caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(function () {
          return caches.match("./index.html");
        })
    );
    return;
  }

  // Recursos estáticos e bibliotecas do CDN (RDKit WASM, 3Dmol, Fontes)
  event.respondWith(
    caches.match(request).then(function (cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then(function (networkResponse) {
        // Armazena no cache se for uma resposta válida (status 200 ou opaque)
        if (
          networkResponse &&
          (networkResponse.status === 200 || networkResponse.type === "opaque")
        ) {
          var responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});


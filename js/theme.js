// Alternância entre tema claro/escuro. A escolha inicial (localStorage ou
// prefers-color-scheme) já é aplicada por um script inline no <head>, antes
// do CSS carregar, para evitar o "flash" do tema errado. Este módulo cuida
// apenas do botão e de persistir mudanças feitas pelo usuário.

var THEME_KEY = "leitorSmiles.theme";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function initThemeToggle(buttonEl, labelEl) {
  function updateLabel(theme) {
    buttonEl.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    labelEl.textContent = theme === "dark" ? "Modo claro" : "Modo escuro";
  }

  updateLabel(currentTheme());

  buttonEl.addEventListener("click", function () {
    var next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    updateLabel(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch (e) {
      // localStorage indisponível — a preferência simplesmente não persiste.
    }
  });
}

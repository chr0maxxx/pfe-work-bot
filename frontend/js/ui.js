// ===== UI COMPONENTS =====

// Helpers
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function formatMoney(n) {
  return n.toLocaleString("ru-RU") + "₽";
}

function formatDate(d) {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isOverdue(d) {
  if (!d) return false;
  return new Date(d) < new Date();
}

// Notifications
function notify(message, type = "success") {
  const container = $("#notifications");
  if (!container) return;

  const el = document.createElement("div");
  el.className = `notification ${type}`;
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => {
    el.style.animation = "slideOut 0.3s forwards";
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// Modal
function openModal(content) {
  const modal = $("#modal");
  const overlay = $("#modalOverlay");
  if (!modal || !overlay) return;

  modal.innerHTML = content;
  overlay.classList.add("open");
}

function closeModal() {
  const overlay = $("#modalOverlay");
  if (overlay) overlay.classList.remove("open");
}

// Particles
function createParticles() {
  const container = $("#particles");
  if (!container) return;

  const count = window.innerWidth < 768 ? 15 : 30;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    p.style.left = Math.random() * 100 + "%";
    p.style.animationDuration = 15 + Math.random() * 20 + "s";
    p.style.animationDelay = Math.random() * 20 + "s";
    p.style.width = p.style.height = 2 + Math.random() * 4 + "px";
    container.appendChild(p);
  }
}

// Theme
async function setTheme(theme) {
  // ← добавили async
  state.currentTheme = theme;
  document.body.dataset.theme = theme;
  localStorage.setItem("theme", theme);
  await render();
  notify("Тема изменена");
}

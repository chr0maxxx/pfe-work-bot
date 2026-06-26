// Экран настроек - заглушка
async function loadSettingsScreen() {
  console.log("Settings screen loading...");
  const content = document.getElementById("screen-settings");
  content.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">⚙️</div>
            <div>Экран настроек в разработке</div>
        </div>
    `;
}

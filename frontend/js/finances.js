// Экран финансов - заглушка
async function loadFinancesScreen() {
  console.log("Finances screen loading...");
  const content = document.getElementById("screen-finances");
  content.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">💰</div>
            <div>Экран финансов в разработке</div>
        </div>
    `;
}

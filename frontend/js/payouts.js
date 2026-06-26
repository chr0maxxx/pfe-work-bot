// Экран выплат (для менеджера)

async function loadPayoutsScreen() {
  console.log("Loading payouts screen...");

  const content = document.getElementById("screen-payouts");

  content.innerHTML = `
        <div class="payouts-container">
            <h2>💳 Выплаты</h2>
            
            <!-- Группа: Максим -->
            <div class="payouts-group">
                <h3>👤 Максим</h3>
                <div class="payouts-list">
                    <div class="placeholder-message">
                        Проект 1: 18 000₽<br>
                        Проект 2: 9 000₽<br>
                        <strong>Итого: 27 000₽</strong>
                    </div>
                </div>
            </div>
            
            <!-- Группа: Андрей -->
            <div class="payouts-group">
                <h3>👤 Андрей</h3>
                <div class="payouts-list">
                    <div class="placeholder-message">
                        Проект 2: 8 000₽<br>
                        <strong>Итого: 8 000₽</strong>
                    </div>
                </div>
            </div>
        </div>
    `;
}

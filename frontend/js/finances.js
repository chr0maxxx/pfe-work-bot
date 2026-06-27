// ===== FINANCE SCREEN =====

function renderFinance() {
  return `
        <div class="screen-title">
            <span>💰 Финансы</span>
            <button class="btn btn-secondary btn-sm" onclick="openRequisitesModal()">👥 Реквизиты</button>
        </div>
        <div class="empty-state">
            <div class="empty-state-icon">💰</div>
            <div>Финансы (в разработке)</div>
        </div>
    `;
}

function openRequisitesModal() {
  notify("Реквизиты в разработке");
}

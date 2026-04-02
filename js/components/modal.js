// ============================================
// SOLO LEVELING SYSTEM — Modal Component
// ============================================

let currentModal = null;

export function showModal({ title, body, confirmText = 'Confirm', cancelText = 'Cancel', confirmClass = 'btn-primary', onConfirm, onCancel }) {
  closeModal(); // close existing

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <h3 class="modal-title">${title}</h3>
      <div class="modal-body">${body}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="modal-cancel">${cancelText}</button>
        <button class="btn ${confirmClass}" id="modal-confirm">${confirmText}</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  currentModal = backdrop;

  // Close on backdrop click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal(onCancel);
  });

  backdrop.querySelector('#modal-cancel').addEventListener('click', () => closeModal(onCancel));
  backdrop.querySelector('#modal-confirm').addEventListener('click', () => {
    closeModal();
    if (onConfirm) onConfirm();
  });

  // ESC key
  const escHandler = (e) => {
    if (e.key === 'Escape') { closeModal(onCancel); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);
}

export function closeModal(callback) {
  if (currentModal) {
    currentModal.remove();
    currentModal = null;
  }
  if (callback) callback();
}

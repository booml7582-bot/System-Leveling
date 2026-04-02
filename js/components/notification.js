// ============================================
// SOLO LEVELING SYSTEM — Notification Component
// ============================================

let containerEl = null;

function ensureContainer() {
  if (containerEl && document.body.contains(containerEl)) return containerEl;
  containerEl = document.createElement('div');
  containerEl.className = 'notification-container';
  containerEl.id = 'notifications';
  document.body.appendChild(containerEl);
  return containerEl;
}

const LABELS = {
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
  system: 'System',
  info: 'Info',
};

export function showNotification(message, type = 'system', duration = 4000) {
  const container = ensureContainer();
  const el = document.createElement('div');
  el.className = `notification ${type}`;
  el.innerHTML = `
    <div class="notification-content">
      <div class="notification-title">${LABELS[type] || LABELS.info}</div>
      <div class="notification-text">${message}</div>
    </div>
    <button class="notification-close">x</button>
  `;
  container.appendChild(el);
  el.querySelector('.notification-close').addEventListener('click', () => dismiss(el));
  if (duration > 0) {
    setTimeout(() => dismiss(el), duration);
  }
  return el;
}

function dismiss(el) {
  el.classList.add('closing');
  setTimeout(() => el.remove(), 300);
}

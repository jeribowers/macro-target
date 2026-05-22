export function initAlertDismiss(root = document) {
  root.querySelectorAll('.alert__dismiss').forEach((button) => {
    if (button.dataset.alertInit === 'true') return;
    button.dataset.alertInit = 'true';

    if (!button.hasAttribute('aria-label')) {
      button.setAttribute('aria-label', 'Dismiss alert');
    }

    button.addEventListener('click', () => {
      const alert = button.closest('.alert');
      if (alert) alert.hidden = true;
    });
  });
}

const TOAST_ELEMENT_ID = 'app-update-toast';
const PROGRESS_ANIMATION_NAME = 'app-update-toast-progress';
const TOAST_DURATION_MS = 20000;

type UpdateToastOptions = {
  message: string;
  actionLabel: string;
  onAction: () => void;
};

export const showUpdateToast = ({ message, actionLabel, onAction }: UpdateToastOptions): void => {
  document.getElementById(TOAST_ELEMENT_ID)?.remove();

  const toast = document.createElement('div');
  toast.id = TOAST_ELEMENT_ID;
  Object.assign(toast.style, {
    position: 'fixed',
    top: '4.5rem',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '9999',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '0.75rem',
    background: '#1a1a1a',
    color: '#fff',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    minWidth: '24rem',
    maxWidth: 'calc(100vw - 2rem)',
  });

  const content = document.createElement('div');
  Object.assign(content.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  });

  const style = document.createElement('style');
  style.textContent = `@keyframes ${PROGRESS_ANIMATION_NAME} { from { width: 100%; } to { width: 0%; } }`;
  toast.appendChild(style);

  const progressBar = document.createElement('div');
  Object.assign(progressBar.style, {
    height: '3px',
    background: '#3b82f6',
    animation: `${PROGRESS_ANIMATION_NAME} ${TOAST_DURATION_MS}ms linear forwards`,
  });

  const messageText = document.createElement('span');
  messageText.textContent = message;
  messageText.style.flexGrow = '1';
  messageText.style.padding = '0.75rem 0 0.75rem 1.25rem';

  const actionButton = document.createElement('button');
  actionButton.textContent = actionLabel;
  Object.assign(actionButton.style, {
    padding: '0.375rem 0.75rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: '#3b82f6',
    color: '#fff',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
  });
  actionButton.addEventListener('click', () => {
    onAction();
    toast.remove();
  });

  const dismissButton = document.createElement('button');
  dismissButton.textContent = '×';
  Object.assign(dismissButton.style, {
    background: 'none',
    border: 'none',
    borderLeft: '1px solid #333',
    color: '#999',
    fontSize: '1.25rem',
    cursor: 'pointer',
    padding: '0.75rem 1.25rem',
    lineHeight: '1',
  });
  dismissButton.addEventListener('click', () => toast.remove());

  content.append(messageText, actionButton, dismissButton);
  toast.append(content, progressBar);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), TOAST_DURATION_MS);
};

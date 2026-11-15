export function showToast(message, type = 'error') {
  const rawMessage = typeof message === 'string' ? message : message?.message || message?.detail;
  const readableMessage = Array.isArray(rawMessage)
    ? rawMessage.map((item) => typeof item === 'string' ? item : item?.msg || item?.message || '').filter(Boolean).join(' ')
    : typeof rawMessage === 'string' ? rawMessage : 'Something went wrong. Please try again.';
  window.dispatchEvent(new CustomEvent('finverse:toast', {
    detail: { message: readableMessage, type },
  }));
}

export default function preventNegativeNumberInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'number' || input.dataset.allowNegative === 'true') {
    return;
  }

  const min = input.min === '' ? 0 : Number(input.min);
  if (input.min === '') input.min = '0';
  // Do not clamp to `min` while the user is typing: values such as "1" may
  // be the first keystroke of an age like 18 or 19. Only reject negatives.
  if (input.value !== '' && Number(input.value) < 0) {
    input.value = '0';
  }
}

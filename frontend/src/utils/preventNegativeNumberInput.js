export default function preventNegativeNumberInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'number' || input.dataset.allowNegative === 'true') {
    return;
  }

  const min = input.min === '' ? 0 : Number(input.min);
  if (input.min === '') input.min = '0';
  if (input.value !== '' && Number(input.value) < min) {
    input.value = String(min);
  }
}

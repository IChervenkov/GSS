export function createCodeInputController({ digitInputs, hiddenCodeInput, codeStatus }) {
  const getCode = () => digitInputs.map((input) => input.value).join('');

  const sync = () => {
    const value = getCode();
    hiddenCodeInput.value = value;
    if (codeStatus)
      codeStatus.textContent = value.length === 6 ? 'Code complete' : `${value.length}/6 digits`;
  };

  const focusDigit = (index) => {
    if (!digitInputs[index]) return;
    digitInputs[index].focus();
    digitInputs[index].select();
  };

  digitInputs.forEach((input, index) => {
    input.addEventListener('input', (event) => {
      const value = event.target.value.replace(/\D/g, '').slice(0, 1);
      event.target.value = value;
      sync();
      if (value && index < digitInputs.length - 1) focusDigit(index + 1);
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !input.value && index > 0) focusDigit(index - 1);
      if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault();
        focusDigit(index - 1);
      }
      if (event.key === 'ArrowRight' && index < digitInputs.length - 1) {
        event.preventDefault();
        focusDigit(index + 1);
      }
    });

    input.addEventListener('paste', (event) => {
      event.preventDefault();
      const text = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (!text) return;
      digitInputs.forEach((digit, i) => {
        digit.value = text[i] || '';
      });
      sync();
      focusDigit(Math.min(text.length, 5));
    });
  });

  sync();
  return {
    getCode,
    sync,
    focusDigit,
    clear() {
      digitInputs.forEach((input) => {
        input.value = '';
      });
      sync();
    },
  };
}

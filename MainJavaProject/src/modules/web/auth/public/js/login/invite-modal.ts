// @ts-nocheck
import { createRequestClient, createRequestScope } from '/assets/shared/js/core/request-client.ts';
import { createModalController } from '/assets/shared/js/ui/modal.ts';

export function initInviteModal() {
  const inviteModal = document.getElementById('invite-modal');
  const inviteDialog = inviteModal?.querySelector('.invite-modal__dialog');
  const openInviteBtn = document.getElementById('open-invite-modal');
  const closeInviteBtn = document.getElementById('close-invite-modal');
  const cancelInviteBtn = document.getElementById('cancel-invite-modal');
  const inviteForm = document.getElementById('invite-form');
  const invitePreviewText = document.getElementById('invite-preview-text');
  const inviteConfirm = document.getElementById('invite-confirm');
  const sendInviteBtn = document.getElementById('send-invite-request');
  const accessSearchInput = document.getElementById('invite-role-search');
  const accessValueInput = document.getElementById('invite-role');
  const accessMenu = document.getElementById('invite-role-options');
  const accessCombobox = document.querySelector('[data-invite-access-combobox]');
  const inviteFields = inviteForm
    ? Array.from(inviteForm.querySelectorAll('input:not([type="hidden"]), textarea'))
    : [];

  if (!inviteModal || !inviteDialog || !inviteForm) return;

  const modal = createModalController({
    root: inviteModal,
    dialog: inviteDialog,
    closeSelectors: ['[data-close-invite="true"]'],
    onAfterClose: () => clearInviteForm(),
  });
  if (!modal) return;

  const client = createRequestClient();
  const scope = createRequestScope();
  let isConfirming = false;

  const accessOptions = [
    { id: 'operations', label: 'Operations workspace' },
    { id: 'inventory', label: 'Inventory management' },
    { id: 'accommodation', label: 'Accommodation management' },
    { id: 'laundry', label: 'Laundry management' },
    { id: 'admin', label: 'Administrative access' },
  ];
  const accessLabels = Object.fromEntries(accessOptions.map((option) => [option.id, option.label]));

  const getPayload = () => ({
    name: inviteForm.name?.value.trim() || '',
    email: inviteForm.email?.value.trim() || '',
    team: inviteForm.team?.value.trim() || '',
    access: accessValueInput?.value || '',
    reason: inviteForm.reason?.value.trim() || '',
  });

  const showConfirm = (message, variant = 'info') => {
    if (!inviteConfirm) return;
    inviteConfirm.hidden = false;
    inviteConfirm.dataset.variant = variant;
    inviteConfirm.textContent = message;
  };

  const hideConfirm = () => {
    if (!inviteConfirm) return;
    inviteConfirm.hidden = true;
    inviteConfirm.textContent = '';
    delete inviteConfirm.dataset.variant;
  };

  const clearInviteForm = () => {
    inviteForm.reset();
    if (accessValueInput) accessValueInput.value = '';
    setAccessMenuOpen(false);
    isConfirming = false;
    hideConfirm();
    syncPreview();
  };

  const setSubmitting = (isSubmitting) => {
    inviteFields.forEach((field) => {
      field.disabled = isSubmitting;
    });
    if (sendInviteBtn) {
      sendInviteBtn.disabled = isSubmitting;
      sendInviteBtn.textContent = isSubmitting ? 'Sending...' : 'Send request';
    }
  };

  const validatePayload = ({ name, email, access, reason }) => {
    if (!name || !email || !access || !reason) {
      return 'Complete the required fields before sending the request.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Enter a valid work email before sending the request.';
    }
    if (reason.length < 10) {
      return 'Add at least 10 characters for the access reason.';
    }
    return '';
  };

  const getInviteSummary = () => {
    const { name, email, team, access, reason } = getPayload();
    const chunks = [];
    if (name) chunks.push(name);
    if (email) chunks.push(`(${email})`);
    if (team) chunks.push(`from ${team}`);
    if (access) chunks.push(`requesting ${accessLabels[access] || access}`);
    if (reason) chunks.push(`because ${reason.length > 90 ? `${reason.slice(0, 87)}...` : reason}`);
    return chunks.length
      ? chunks.join(' ')
      : 'Add your details to build a clear request before continuing.';
  };

  const syncPreview = () => {
    if (invitePreviewText) invitePreviewText.textContent = getInviteSummary();
  };

  const setAccessMenuOpen = (isOpen) => {
    if (!accessMenu || !accessSearchInput || !accessCombobox) return;
    accessMenu.hidden = !isOpen;
    accessSearchInput.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    accessCombobox.classList.toggle('is-open', isOpen);
  };

  const selectAccessOption = (option) => {
    if (!option || !accessSearchInput || !accessValueInput) return;
    accessSearchInput.value = option.label;
    accessValueInput.value = option.id;
    setAccessMenuOpen(false);
    isConfirming = false;
    hideConfirm();
    syncPreview();
  };

  const renderAccessOptions = () => {
    if (!accessMenu) return;
    const query = String(accessSearchInput?.value || '').trim().toLowerCase();
    const filtered = accessOptions.filter((option) =>
      option.label.toLowerCase().includes(query),
    );

    if (!filtered.length) {
      accessMenu.innerHTML =
        '<div class="lookup-option lookup-option--status" aria-disabled="true">No access needs found.</div>';
      return;
    }

    accessMenu.innerHTML = filtered
      .map(
        (option, index) => `
          <button class="lookup-option" type="button" role="option" data-access-value="${option.id}" ${index === 0 ? 'data-active-option="true"' : ''}>
            <span class="lookup-option__title">${option.label}</span>
          </button>
        `,
      )
      .join('');
  };

  const openAccessMenu = () => {
    renderAccessOptions();
    setAccessMenuOpen(true);
  };

  openInviteBtn?.addEventListener('click', () => {
    isConfirming = false;
    hideConfirm();
    modal.open();
    syncPreview();
  });
  closeInviteBtn?.addEventListener('click', modal.close);
  cancelInviteBtn?.addEventListener('click', modal.close);

  inviteFields.forEach((field) =>
    field.addEventListener('input', () => {
      isConfirming = false;
      hideConfirm();
      syncPreview();
    }),
  );

  accessSearchInput?.addEventListener('input', () => {
    if (accessValueInput) accessValueInput.value = '';
    openAccessMenu();
    isConfirming = false;
    hideConfirm();
    syncPreview();
  });

  accessSearchInput?.addEventListener('focus', openAccessMenu);

  accessSearchInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    if (accessMenu?.hidden) return;
    const firstOption = accessMenu?.querySelector('[data-access-value]');
    if (!firstOption) return;
    event.preventDefault();
    selectAccessOption(accessOptions.find((option) => option.id === firstOption.dataset.accessValue));
  });

  accessMenu?.addEventListener('click', (event) => {
    const optionButton = event.target?.closest?.('[data-access-value]');
    if (!optionButton) return;
    selectAccessOption(accessOptions.find((option) => option.id === optionButton.dataset.accessValue));
  });

  document.addEventListener('click', (event) => {
    if (!accessCombobox || accessCombobox.contains(event.target)) return;
    setAccessMenuOpen(false);
  });

  inviteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    syncPreview();

    const payload = getPayload();
    const validationMessage = validatePayload(payload);
    if (validationMessage) {
      isConfirming = false;
      showConfirm(validationMessage, 'danger');
      return;
    }

    if (!isConfirming) {
      isConfirming = true;
      showConfirm('Review the summary, then press Send request again to submit it.');
      return;
    }

    const csrfToken = inviteForm.querySelector('[name="_csrf"]')?.value || '';
    const { token, signal } = scope.next();
    setSubmitting(true);
    showConfirm('Sending access request...');

    try {
      const result = await client.postJson('/web/request-access', {
        csrfToken,
        signal,
        body: payload,
      });
      if (!scope.isCurrent(token)) return;
      if (!result.ok) {
        isConfirming = false;
        showConfirm(result.message || 'The access request could not be sent.', 'danger');
        return;
      }

      showConfirm(result.data?.message || 'Access request sent.', 'success');
      inviteForm.reset();
      if (accessValueInput) accessValueInput.value = '';
      setAccessMenuOpen(false);
      syncPreview();
      isConfirming = false;
      window.setTimeout(() => modal.close(), 900);
    } catch (error) {
      isConfirming = false;
      showConfirm(error?.message || 'The access request could not be sent.', 'danger');
    } finally {
      if (scope.isCurrent(token)) setSubmitting(false);
    }
  });
}

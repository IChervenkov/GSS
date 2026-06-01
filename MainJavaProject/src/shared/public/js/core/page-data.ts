export function readPageData() {
  const template = document.querySelector('[data-page-data]');
  if (!(template instanceof HTMLTemplateElement)) return {};

  try {
    const raw = template.innerHTML?.trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

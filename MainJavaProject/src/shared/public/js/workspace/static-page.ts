import { bootstrapPage } from '/assets/shared/js/app/bootstrap-page.ts';
import { readPageData } from '/assets/shared/js/core/page-data.ts';
import { initWorkspacePermissionAccessRefresh } from '/assets/shared/js/workspace/permission-access.ts';
import { initWorkspacePage, syncTabPanels } from '/assets/shared/js/workspace/page-shell.ts';

function initStaticTabs() {
  const tabButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-tab-trigger]'));
  const tabPanels = Array.from(document.querySelectorAll<HTMLElement>('[data-tab-panel]'));
  if (!tabButtons.length || !tabPanels.length) return;

  const setActiveTab = (nextTab?: string) => {
    const activeTab =
      nextTab && tabPanels.some((panel) => panel.dataset.tabPanel === nextTab)
        ? nextTab
        : tabButtons.find((button) => button.classList.contains('is-active'))?.dataset.tabTrigger ||
          tabButtons[0]?.dataset.tabTrigger;

    syncTabPanels({ activeTab, tabButtons, tabPanels });
  };

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tabTrigger));
  });

  setActiveTab();
}

bootstrapPage(() => {
  const pageData = readPageData();
  initWorkspacePage();
  initStaticTabs();
  initWorkspacePermissionAccessRefresh({ pageData });
});

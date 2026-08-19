'use strict';

/**
 * Settings DOM view. Wired to SettingsController (QC-61). Since the
 * controller's data comes from async storage, mountSettings itself is
 * async — it awaits the initial fetch before the DOM exists at all, so
 * there's no flash-of-empty-state to design around.
 *
 * Same testability approach as toolbarView.js: real createElement calls,
 * no innerHTML string building from data (avoids ever interpolating a
 * workspace name into a template string unescaped).
 */

function renderWorkspaceRow(doc, summary, onLeave) {
  const row = doc.createElement('li');
  row.className = 'qc-settings-row';
  row.dataset.workspaceId = summary.id;

  const info = doc.createElement('div');
  info.className = 'qc-settings-row-info';

  const name = doc.createElement('span');
  name.className = 'qc-settings-row-name';
  name.textContent = summary.name;

  const scope = doc.createElement('span');
  scope.className = 'qc-settings-row-scope';
  scope.textContent = summary.scopeLabel;

  info.appendChild(name);
  info.appendChild(scope);

  const badge = doc.createElement('span');
  badge.className = summary.hasKey ? 'qc-settings-badge qc-settings-badge-ok' : 'qc-settings-badge qc-settings-badge-warn';
  badge.textContent = summary.hasKey ? 'Unlocked' : 'No key';
  badge.setAttribute('title', summary.hasKey ? 'This device can read this workspace' : 'This device has no key for this workspace and cannot read its content');

  const leaveButton = doc.createElement('button');
  leaveButton.type = 'button';
  leaveButton.className = 'qc-settings-leave';
  leaveButton.textContent = 'Leave';
  leaveButton.setAttribute('aria-label', `Leave workspace ${summary.name}`);
  leaveButton.addEventListener('click', () => onLeave(summary.id));

  row.appendChild(info);
  row.appendChild(badge);
  row.appendChild(leaveButton);
  return row;
}

async function mountSettings(container, settingsController) {
  const doc = container.ownerDocument;

  const root = doc.createElement('div');
  root.className = 'qc-settings';

  const heading = doc.createElement('h2');
  heading.className = 'qc-settings-heading';
  heading.textContent = 'Your workspaces';
  root.appendChild(heading);

  const list = doc.createElement('ul');
  list.className = 'qc-settings-list';
  root.appendChild(list);

  const emptyState = doc.createElement('p');
  emptyState.className = 'qc-settings-empty';
  emptyState.textContent = "You haven't joined any workspaces yet.";

  async function render() {
    list.innerHTML = ''; // safe here: clearing, not inserting untrusted data
    const summaries = await settingsController.getWorkspaceSummaries();
    if (summaries.length === 0) {
      list.appendChild(emptyState);
      return;
    }
    for (const summary of summaries) {
      list.appendChild(renderWorkspaceRow(doc, summary, handleLeave));
    }
  }

  async function handleLeave(workspaceId) {
    await settingsController.removeWorkspaceLocally(workspaceId);
    await render();
  }

  await render();
  container.appendChild(root);

  return function dispose() {
    root.remove();
  };
}

module.exports = { mountSettings };

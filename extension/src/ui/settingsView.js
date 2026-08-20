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

  const workspaceSection = doc.createElement('section');
  workspaceSection.className = 'qc-settings-workspace-create';
  const createHeading = doc.createElement('h3');
  createHeading.textContent = 'Create a workspace';
  workspaceSection.appendChild(createHeading);
  const nameInput = doc.createElement('input');
  nameInput.type = 'text'; nameInput.placeholder = 'Workspace name'; nameInput.setAttribute('aria-label', 'Workspace name');
  const scopeSelect = doc.createElement('select');
  scopeSelect.setAttribute('aria-label', 'Workspace scope');
  for (const [value, label] of [['urlList', 'Just this page'], ['domain', 'This whole domain']]) {
    const option = doc.createElement('option'); option.value = value; option.textContent = label; scopeSelect.appendChild(option);
  }
  const createButton = doc.createElement('button');
  createButton.type = 'button'; createButton.textContent = 'Create invite';
  const createStatus = doc.createElement('p'); createStatus.className = 'qc-settings-create-status'; createStatus.setAttribute('role', 'status');
  createButton.addEventListener('click', async () => {
    try {
      const result = await settingsController.createWorkspaceForPage({ name: nameInput.value, scopeType: scopeSelect.value });
      createStatus.textContent = result.inviteLink;
      await render();
    } catch (error) { createStatus.textContent = error.message; }
  });
  workspaceSection.append(nameInput, scopeSelect, createButton, createStatus);
  root.appendChild(workspaceSection);

  const joinSection = doc.createElement('section');
  joinSection.className = 'qc-settings-workspace-join';
  const joinHeading = doc.createElement('h3');
  joinHeading.textContent = 'Join a workspace';
  const inviteInput = doc.createElement('input');
  inviteInput.type = 'url'; inviteInput.placeholder = 'Paste an invite link'; inviteInput.setAttribute('aria-label', 'Workspace invite link');
  const joinButton = doc.createElement('button');
  joinButton.type = 'button'; joinButton.textContent = 'Join';
  const joinStatus = doc.createElement('p');
  joinStatus.className = 'qc-settings-join-status'; joinStatus.setAttribute('role', 'status');
  joinButton.addEventListener('click', async () => {
    try {
      const workspace = await settingsController.acceptInvite(inviteInput.value);
      joinStatus.textContent = `Joined “${workspace.name}”.`;
      inviteInput.value = '';
      await render();
    } catch (error) { joinStatus.textContent = error.message; }
  });
  joinSection.append(joinHeading, inviteInput, joinButton, joinStatus);
  root.appendChild(joinSection);

  const relaySection = doc.createElement('section');
  relaySection.className = 'qc-settings-relay';
  const relayHeading = doc.createElement('h3'); relayHeading.textContent = 'Encrypted relay';
  const relayInput = doc.createElement('input');
  relayInput.type = 'url'; relayInput.placeholder = 'wss://relay.example.com'; relayInput.setAttribute('aria-label', 'Encrypted relay URL');
  relayInput.value = await settingsController.getRelayUrl();
  const relayButton = doc.createElement('button'); relayButton.type = 'button'; relayButton.textContent = 'Save relay';
  const relayStatus = doc.createElement('p'); relayStatus.className = 'qc-settings-relay-status'; relayStatus.setAttribute('role', 'status');
  relayButton.addEventListener('click', async () => {
    try { await settingsController.setRelayUrl(relayInput.value); relayStatus.textContent = 'Relay URL saved. Reload the page to reconnect.'; }
    catch (error) { relayStatus.textContent = error.message; }
  });
  relaySection.append(relayHeading, relayInput, relayButton, relayStatus);
  const tokenInput = doc.createElement('input');
  tokenInput.type = 'password'; tokenInput.placeholder = 'Optional relay token'; tokenInput.setAttribute('aria-label', 'Relay authentication token');
  tokenInput.value = await settingsController.getRelayAuthToken();
  const tokenButton = doc.createElement('button'); tokenButton.type = 'button'; tokenButton.textContent = 'Save token';
  const tokenStatus = doc.createElement('p'); tokenStatus.className = 'qc-settings-relay-status'; tokenStatus.setAttribute('role', 'status');
  tokenButton.addEventListener('click', async () => {
    try { await settingsController.setRelayAuthToken(tokenInput.value); tokenStatus.textContent = 'Relay token saved. Reload the page to reconnect.'; }
    catch (error) { tokenStatus.textContent = error.message; }
  });
  relaySection.append(tokenInput, tokenButton, tokenStatus);
  root.appendChild(relaySection);

  const backupSection = doc.createElement('section');
  backupSection.className = 'qc-settings-backup';
  const backupHeading = doc.createElement('h3'); backupHeading.textContent = 'Key backup';
  const backupWarning = doc.createElement('p'); backupWarning.textContent = 'This backup can decrypt the listed workspaces. Store it like a password.';
  const backupPassword = doc.createElement('input');
  backupPassword.type = 'password'; backupPassword.placeholder = 'Backup password (8+ characters)'; backupPassword.setAttribute('aria-label', 'Key backup password');
  const backupButton = doc.createElement('button'); backupButton.type = 'button'; backupButton.textContent = 'Export backup';
  const restoreInput = doc.createElement('input'); restoreInput.type = 'file'; restoreInput.accept = '.json,application/json'; restoreInput.setAttribute('aria-label', 'Key backup file');
  const restoreButton = doc.createElement('button'); restoreButton.type = 'button'; restoreButton.textContent = 'Import backup';
  const backupStatus = doc.createElement('p'); backupStatus.className = 'qc-settings-backup-status'; backupStatus.setAttribute('role', 'status');
  backupButton.addEventListener('click', async () => {
    try {
      const json = await settingsController.exportKeyBackup(backupPassword.value);
      const link = doc.createElement('a'); link.href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`; link.download = 'quillcrypt-key-backup.json'; link.click();
      backupStatus.textContent = 'Encrypted backup ready.';
    } catch (error) { backupStatus.textContent = error.message; }
  });
  restoreButton.addEventListener('click', async () => {
    try {
      const file = restoreInput.files?.[0];
      if (!file) throw new Error('Choose a backup file first');
      const imported = await settingsController.importKeyBackup(await file.text(), backupPassword.value);
      backupStatus.textContent = `Imported ${imported} workspace(s). Reload the page to activate them.`;
      await render();
    } catch (error) { backupStatus.textContent = error.message; }
  });
  backupSection.append(backupHeading, backupWarning, backupPassword, backupButton, restoreInput, restoreButton, backupStatus);
  root.appendChild(backupSection);

  const memberController = settingsController.getMemberController?.();
  if (memberController) {
    const { mountMemberManagement } = require('./memberManagementView');
    const memberHost = doc.createElement('div');
    root.appendChild(memberHost);
    await mountMemberManagement(memberHost, memberController);
  }

  const list = doc.createElement('ul');
  list.className = 'qc-settings-list';
  root.appendChild(list);

  const exportSection = doc.createElement('section');
  exportSection.className = 'qc-settings-export';
  const exportHeading = doc.createElement('h3');
  exportHeading.textContent = 'Export this page';
  exportSection.appendChild(exportHeading);
  const exportStatus = doc.createElement('p');
  exportStatus.className = 'qc-settings-export-status';
  exportStatus.setAttribute('role', 'status');
  const download = (format, content) => {
    const extension = format === 'json' ? 'json' : 'md';
    const link = doc.createElement('a');
    link.href = `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`;
    link.download = `quillcrypt-annotations.${extension}`;
    link.click();
  };
  for (const [format, label] of [['json', 'Download JSON'], ['markdown', 'Download Markdown']]) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'qc-settings-export-button';
    button.textContent = label;
    button.addEventListener('click', async () => {
      try {
        download(format, await settingsController.exportCurrentPage(format));
        exportStatus.textContent = `${label} ready.`;
      } catch (error) {
        exportStatus.textContent = 'Export is unavailable right now.';
      }
    });
    exportSection.appendChild(button);
  }
  exportSection.appendChild(exportStatus);
  root.appendChild(exportSection);

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

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

function renderWorkspaceRow(doc, summary, { onLeave, onAddPage }) {
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
  leaveButton.addEventListener('click', () => onLeave(summary));

  row.appendChild(info);
  row.appendChild(badge);
  if (summary.scopeType === 'urlList' && !summary.coversCurrentPage) {
    const addPageButton = doc.createElement('button');
    addPageButton.type = 'button';
    addPageButton.className = 'qc-settings-add-page';
    addPageButton.textContent = 'Add this page';
    addPageButton.setAttribute('aria-label', `Add this page to workspace ${summary.name}`);
    addPageButton.addEventListener('click', () => onAddPage(summary.id));
    row.appendChild(addPageButton);
  }
  row.appendChild(leaveButton);
  return row;
}

async function mountSettings(container, settingsController, { onClose } = {}) {
  const doc = container.ownerDocument;

  const root = doc.createElement('div');
  root.className = 'qc-settings';

  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'qc-settings-close';
  close.setAttribute('aria-label', 'Close settings');
  close.title = 'Close settings';
  close.textContent = '×';
  close.addEventListener('click', () => onClose?.());
  root.appendChild(close);

  const heading = doc.createElement('h2');
  heading.className = 'qc-settings-heading';
  heading.textContent = 'Your workspaces';
  root.appendChild(heading);

  const privacyLink = doc.createElement('a');
  privacyLink.className = 'qc-settings-privacy-link';
  privacyLink.href = settingsController.privacyPolicyUrl || 'https://quillcrypt.dev/privacy.html';
  privacyLink.target = '_blank';
  privacyLink.rel = 'noopener noreferrer';
  privacyLink.textContent = 'Privacy policy';
  root.appendChild(privacyLink);

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
      backupStatus.textContent = `Imported ${imported} workspace(s). Matching pages are now unlocked.`;
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
      list.appendChild(renderWorkspaceRow(doc, summary, { onLeave: handleLeave, onAddPage: handleAddPage }));
    }
  }

  async function handleAddPage(workspaceId) {
    try {
      await settingsController.addCurrentPageToWorkspace(workspaceId);
      await render();
    } catch (error) {
      const status = doc.createElement('p');
      status.className = 'qc-settings-scope-status';
      status.setAttribute('role', 'status');
      status.textContent = error.message;
      root.appendChild(status);
    }
  }

  async function handleLeave(workspaceId) {
    const summary = typeof workspaceId === 'object'
      ? workspaceId
      : (await settingsController.getWorkspaceSummaries()).find((item) => item.id === workspaceId);
    if (settingsController.confirmLeave && !(await settingsController.confirmLeave(summary))) return;
    await settingsController.removeWorkspaceLocally(summary.id);
    await render();
  }

  await render();
  container.appendChild(root);

  return function dispose() {
    root.remove();
  };
}

module.exports = { mountSettings };

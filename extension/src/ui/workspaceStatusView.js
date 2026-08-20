'use strict';

function mountWorkspaceStatus(container, { lockedWorkspaces = [], onOpenSettings }) {
  const doc = container.ownerDocument;
  let root = null;

  function render(workspaces) {
    root?.remove();
    root = null;
    if (!workspaces.length) return;
    root = doc.createElement('aside');
    root.className = 'qc-workspace-status';
    root.setAttribute('role', 'status');
    const message = doc.createElement('p');
    const names = workspaces.map((workspace) => `“${workspace.name}”`).join(', ');
    message.textContent = `${names} ${workspaces.length === 1 ? 'is' : 'are'} locked on this device. Import a key backup or join a fresh invite to unlock ${workspaces.length === 1 ? 'it' : 'them'}.`;
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'qc-workspace-status-settings';
    button.textContent = 'Open Settings';
    button.addEventListener('click', () => onOpenSettings?.());
    root.append(message, button);
    container.appendChild(root);
  }

  render(lockedWorkspaces);
  return {
    update: render,
    clear: () => render([]),
    dispose: () => root?.remove(),
  };
}

module.exports = { mountWorkspaceStatus };

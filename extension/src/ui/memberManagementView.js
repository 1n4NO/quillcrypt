'use strict';

/** Render member fingerprints with an explicit two-step removal action. */
async function mountMemberManagement(container, memberController) {
  const doc = container.ownerDocument;
  const root = doc.createElement('section');
  root.className = 'qc-settings-members';
  const heading = doc.createElement('h3'); heading.textContent = 'Workspace members';
  const list = doc.createElement('ul'); list.className = 'qc-settings-member-list';
  const status = doc.createElement('p'); status.className = 'qc-settings-member-status'; status.setAttribute('role', 'status');
  root.append(heading, list, status);

  const pendingRemoval = new Set();
  async function render() {
    list.replaceChildren();
    const members = await memberController.listMembersForDisplay();
    if (members.length === 0) {
      const empty = doc.createElement('li'); empty.textContent = 'No members are registered.'; list.appendChild(empty); return;
    }
    for (const member of members) {
      const row = doc.createElement('li'); row.className = 'qc-settings-member-row'; row.dataset.memberId = member.memberId;
      const identity = doc.createElement('span'); identity.className = 'qc-settings-member-identity';
      identity.textContent = `${member.displayName} · ${member.publicKeyFingerprint}`;
      const remove = doc.createElement('button'); remove.type = 'button'; remove.className = 'qc-settings-member-remove';
      const confirming = pendingRemoval.has(member.memberId);
      remove.textContent = confirming ? 'Confirm removal' : 'Remove';
      remove.setAttribute('aria-label', `${confirming ? 'Confirm removal of' : 'Remove'} member ${member.displayName}`);
      remove.addEventListener('click', async () => {
        if (!pendingRemoval.has(member.memberId)) { pendingRemoval.add(member.memberId); await render(); return; }
        try {
          const result = await memberController.removeMemberAndRotate(member.memberId);
          pendingRemoval.delete(member.memberId);
          status.textContent = `Removed ${member.displayName}; the workspace key was rotated for remaining members.`;
          await render();
          return result;
        } catch (error) { status.textContent = error.message; }
      });
      row.append(identity, remove); list.appendChild(row);
    }
  }
  await render();
  container.appendChild(root);
  return () => root.remove();
}

module.exports = { mountMemberManagement };

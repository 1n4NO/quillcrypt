'use strict';

const { buildSidebarItems, filterSidebarItems } = require('./sidebar');
const { locateAsRange } = require('../content/anchoring/rangeAnchoring');

function mountSidebar(container, annotations = [], { onClose, onClearAll, onEdit, onSelect, onRetry, orphanedIds = [] } = {}) {
  const doc = container.ownerDocument;
  const root = doc.createElement('aside');
  root.className = 'qc-sidebar';
  root.setAttribute('aria-label', 'Annotations');
  root.setAttribute('tabindex', '-1');
  const previousFocus = doc.activeElement;

  const header = doc.createElement('div');
  header.className = 'qc-sidebar-header';
  const title = doc.createElement('h2');
  title.textContent = 'Annotations';
  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'qc-sidebar-close';
  close.setAttribute('aria-label', 'Close annotations');
  close.textContent = '×';
  close.addEventListener('click', () => onClose?.());
  const actions = doc.createElement('div');
  actions.className = 'qc-sidebar-header-actions';
  const clear = doc.createElement('button');
  clear.type = 'button';
  clear.className = 'qc-sidebar-clear';
  clear.textContent = 'Clear all';
  clear.title = 'Delete all annotations on this page';
  clear.addEventListener('click', async () => {
    clear.disabled = true;
    try { await onClearAll?.(); } finally { clear.disabled = false; }
  });
  actions.append(clear, close);
  header.append(title, actions);

  const search = doc.createElement('input');
  search.type = 'search';
  search.className = 'qc-sidebar-search';
  search.placeholder = 'Filter annotations';
  search.setAttribute('aria-label', 'Filter annotations');
  const list = doc.createElement('ul');
  list.className = 'qc-sidebar-list';
  const empty = doc.createElement('p');
  empty.className = 'qc-sidebar-empty';
  empty.textContent = 'No annotations on this page.';
  const status = doc.createElement('p');
  status.className = 'qc-sidebar-status';
  status.setAttribute('role', 'status');
  root.append(header, search, list, empty, status);
  container.appendChild(root);
  search.focus?.();

  let current = annotations.slice();
  let orphaned = new Set(orphanedIds);
  function render() {
    clear.disabled = current.length === 0;
    list.replaceChildren();
    const items = filterSidebarItems(buildSidebarItems(current).map((item) => ({ ...item, orphaned: orphaned.has(item.id) })), search.value);
    empty.hidden = items.length !== 0;
    for (const item of items) {
      const row = doc.createElement('li');
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'qc-sidebar-item';
      button.dataset.annotationId = item.id;
      button.classList.toggle('qc-sidebar-item-orphaned', item.orphaned);
      button.textContent = item.orphaned ? `Anchor not found · ${item.excerpt}` : item.excerpt;
      button.title = item.orphaned ? 'This annotation could not be located in the current page. Retry after the page finishes loading.' : item.excerpt;
      button.setAttribute('aria-label', item.orphaned ? `Orphaned annotation: ${item.excerpt}` : item.excerpt);
      button.addEventListener('click', () => {
        if (item.orphaned) {
          status.textContent = 'This anchor is not currently in the page. Retry after loading more content or changing the page view.';
          return;
        }
        const annotation = current.find((candidate) => candidate.id === item.id);
        onSelect?.(annotation);
        if (!onSelect && annotation?.anchor) {
          const range = locateAsRange(doc.body, annotation.anchor);
          range?.startContainer?.parentElement?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        }
      });
      row.appendChild(button);
      const editor = doc.createElement('div');
      editor.className = 'qc-sidebar-item-editor';
      const titleInput = doc.createElement('input');
      titleInput.type = 'text'; titleInput.className = 'qc-sidebar-title'; titleInput.placeholder = 'Title';
      titleInput.value = item.title;
      const descriptionInput = doc.createElement('textarea');
      descriptionInput.className = 'qc-sidebar-description'; descriptionInput.placeholder = 'Description';
      descriptionInput.value = item.description;
      const save = doc.createElement('button');
      save.type = 'button'; save.className = 'qc-sidebar-save'; save.textContent = 'Save';
      save.addEventListener('click', async (event) => {
        event.stopPropagation();
        await onEdit?.(item.id, { title: titleInput.value.trim(), description: descriptionInput.value.trim() });
        status.textContent = 'Annotation details saved.';
      });
      editor.append(titleInput, descriptionInput, save);
      row.appendChild(editor);
      if (item.orphaned) {
        const retry = doc.createElement('button');
        retry.type = 'button'; retry.className = 'qc-sidebar-retry'; retry.textContent = 'Retry';
        retry.setAttribute('aria-label', `Retry anchor for ${item.excerpt}`);
        retry.addEventListener('click', () => { status.textContent = 'Retrying anchor…'; onRetry?.(item.id); });
        row.appendChild(retry);
      }
      list.appendChild(row);
    }
  }
  search.addEventListener('input', render);
  render();

  return {
    update(nextAnnotations, nextOrphanedIds = orphaned) { current = nextAnnotations.slice(); orphaned = new Set(nextOrphanedIds); render(); },
    dispose() {
      root.remove();
      if (previousFocus?.isConnected) previousFocus.focus?.();
    },
  };
}

module.exports = { mountSidebar };

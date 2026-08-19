'use strict';

const { buildSidebarItems, filterSidebarItems } = require('./sidebar');
const { locateAsRange } = require('../content/anchoring/rangeAnchoring');

function mountSidebar(container, annotations = [], { onClose } = {}) {
  const doc = container.ownerDocument;
  const root = doc.createElement('aside');
  root.className = 'qc-sidebar';
  root.setAttribute('aria-label', 'Annotations');

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
  header.append(title, close);

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
  root.append(header, search, list, empty);
  container.appendChild(root);

  let current = annotations.slice();
  function render() {
    list.replaceChildren();
    const items = filterSidebarItems(buildSidebarItems(current), search.value);
    empty.hidden = items.length !== 0;
    for (const item of items) {
      const row = doc.createElement('li');
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'qc-sidebar-item';
      button.dataset.annotationId = item.id;
      button.textContent = item.excerpt;
      button.title = item.excerpt;
      button.addEventListener('click', () => {
        const annotation = current.find((candidate) => candidate.id === item.id);
        if (!annotation?.anchor) return;
        const range = locateAsRange(doc.body, annotation.anchor);
        range?.startContainer?.parentElement?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      });
      row.appendChild(button);
      list.appendChild(row);
    }
  }
  search.addEventListener('input', render);
  render();

  return {
    update(nextAnnotations) { current = nextAnnotations.slice(); render(); },
    dispose() { root.remove(); },
  };
}

module.exports = { mountSidebar };

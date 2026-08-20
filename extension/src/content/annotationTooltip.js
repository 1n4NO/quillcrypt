'use strict';

function mountAnnotationTooltip(doc) {
  const tooltip = doc.createElement('div');
  tooltip.className = 'qc-annotation-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  doc.body.appendChild(tooltip);

  let activeTarget = null;

  function targetFor(node) {
    return node?.closest?.('[data-quillcrypt-tooltip]') || null;
  }

  function hide() {
    activeTarget = null;
    tooltip.classList.remove('qc-annotation-tooltip-visible');
    tooltip.hidden = true;
  }

  function show(target) {
    const text = target.dataset.quillcryptTooltip;
    if (!text) return;
    activeTarget = target;
    tooltip.textContent = text;
    tooltip.hidden = false;
    const rect = target.getBoundingClientRect();
    const viewportWidth = doc.defaultView?.innerWidth || 1200;
    const viewportHeight = doc.defaultView?.innerHeight || 800;
    const width = tooltip.offsetWidth || Math.min(260, Math.max(80, text.length * 7));
    const height = tooltip.offsetHeight || 28;
    const left = Math.max(8, Math.min(viewportWidth - width - 8, rect.left + (rect.width - width) / 2));
    const top = rect.top >= height + 10 ? rect.top - height - 8 : Math.min(viewportHeight - height - 8, rect.bottom + 8);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;
    // Force the visible class in the same event turn: the tooltip should feel
    // immediate, while CSS supplies only a very short fade.
    tooltip.classList.add('qc-annotation-tooltip-visible');
  }

  function onPointerOver(event) {
    const target = targetFor(event.target);
    if (target && target !== activeTarget) show(target);
  }

  function onPointerOut(event) {
    if (!activeTarget) return;
    const next = targetFor(event.relatedTarget);
    if (next !== activeTarget) hide();
  }

  doc.addEventListener('pointerover', onPointerOver, true);
  doc.addEventListener('pointerout', onPointerOut, true);

  return function dispose() {
    doc.removeEventListener('pointerover', onPointerOver, true);
    doc.removeEventListener('pointerout', onPointerOut, true);
    tooltip.remove();
  };
}

module.exports = { mountAnnotationTooltip };

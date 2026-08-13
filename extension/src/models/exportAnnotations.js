'use strict';

/**
 * Annotation export (QC-53).
 *
 * DELIBERATE CONTRAST with QC-50/51/52: those integrations must never see
 * decrypted content — this is the opposite case. Export is local-only,
 * user-initiated, and never transmitted anywhere by this code (the user
 * decides what to do with the downloaded file afterward). So export
 * includes FULL annotation content by design — there is no metadata-only
 * restriction here, because the client already has the decrypted data
 * (that's the entire point of E2EE: the client can read it, the relay
 * cannot) and the user is explicitly asking to see it.
 */

const EXPORT_FORMAT_VERSION = 1;

function exportToJson(annotations, { url } = {}) {
  const payload = {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    url: url || null,
    annotationCount: annotations.length,
    annotations,
  };
  return JSON.stringify(payload, null, 2);
}

function importFromJson(jsonString) {
  const parsed = JSON.parse(jsonString);
  if (parsed.formatVersion !== EXPORT_FORMAT_VERSION) {
    throw new Error(`Unsupported export format version: ${parsed.formatVersion}`);
  }
  return parsed.annotations;
}

const TYPE_LABELS = {
  highlight: 'Highlight',
  underline: 'Underline',
  note: 'Note',
  draw: 'Drawing',
  arrow: 'Arrow',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
};

function exportToMarkdown(annotations, { url, pageTitle } = {}) {
  const lines = [];
  lines.push(`# Annotations${pageTitle ? `: ${pageTitle}` : ''}`);
  if (url) lines.push(`\n_${url}_`);
  lines.push(`\nExported ${new Date().toLocaleDateString()} — ${annotations.length} annotation(s)\n`);

  for (const annotation of annotations) {
    const label = TYPE_LABELS[annotation.type] || annotation.type;
    lines.push(`## ${label}`);
    if (annotation.anchor?.exact) {
      lines.push(`> ${annotation.anchor.exact}`);
    }
    if (annotation.type === 'note' && annotation.content) {
      lines.push(annotation.content);
    }
    lines.push(''); // blank line between entries
  }

  return lines.join('\n');
}

module.exports = { exportToJson, importFromJson, exportToMarkdown, EXPORT_FORMAT_VERSION };

'use strict';
const crypto = require('crypto');

/**
 * Annotation data model.
 *
 * schemaVersion is stored on every record from day one specifically so that
 * Phase 3 (E2EE) can introduce an encrypted-field variant of this schema
 * without a breaking migration for anyone who already has v1 data — old
 * records upgrade in place via runMigrations() rather than needing a
 * one-time destructive conversion.
 */

const CURRENT_SCHEMA_VERSION = 1;

const TEXT_ANCHORED_TYPES = ['highlight', 'underline', 'note'];
const SHAPE_TYPES = ['draw', 'arrow', 'rect', 'ellipse'];
const ALL_TYPES = [...TEXT_ANCHORED_TYPES, ...SHAPE_TYPES];

function createAnnotation({ type, anchor = null, geometry = null, style = {}, content = null }) {
  if (!ALL_TYPES.includes(type)) {
    throw new Error(`Unknown annotation type: ${type}`);
  }
  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    type,
    createdAt: now,
    updatedAt: now,
    style: { color: '#F5C542', strokeWidth: 2, opacity: 1, ...style },
    anchor,
    geometry,
    content,
  };
  const errors = validateAnnotation(record);
  if (errors.length > 0) {
    throw new Error(`Invalid annotation: ${errors.join('; ')}`);
  }
  return record;
}

/** Returns an array of validation error strings; empty array = valid. */
function validateAnnotation(record) {
  const errors = [];
  if (!record.id) errors.push('missing id');
  if (!ALL_TYPES.includes(record.type)) errors.push(`unknown type: ${record.type}`);
  if (typeof record.schemaVersion !== 'number') errors.push('missing schemaVersion');

  if (TEXT_ANCHORED_TYPES.includes(record.type) && !record.anchor) {
    errors.push(`type "${record.type}" requires an anchor`);
  }
  if (SHAPE_TYPES.includes(record.type) && !record.geometry) {
    errors.push(`type "${record.type}" requires geometry`);
  }
  if (record.type === 'note' && typeof record.content !== 'string') {
    errors.push('type "note" requires string content');
  }
  return errors;
}

/**
 * Generic migration chain runner: applies each migration step in order from
 * record.schemaVersion up to targetVersion. `migrations` is a map of
 * `fromVersion -> (record) => record` (the function that upgrades a record
 * FROM that version TO the next one).
 */
function runMigrations(record, migrations, targetVersion) {
  let current = record;
  while (current.schemaVersion < targetVersion) {
    const step = migrations[current.schemaVersion];
    if (!step) {
      throw new Error(`No migration path from schema version ${current.schemaVersion}`);
    }
    current = step(current);
  }
  return current;
}

// Real migration table — empty today because v1 is the only version that has
// ever existed. Future migrations get added here, e.g. `{ 1: upgradeV1ToV2 }`.
const MIGRATIONS = {};

function migrate(record) {
  return runMigrations(record, MIGRATIONS, CURRENT_SCHEMA_VERSION);
}

module.exports = {
  CURRENT_SCHEMA_VERSION,
  TEXT_ANCHORED_TYPES,
  SHAPE_TYPES,
  createAnnotation,
  validateAnnotation,
  runMigrations,
  migrate,
};

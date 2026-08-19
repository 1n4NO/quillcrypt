'use strict';

const MESSAGE_TYPES = Object.freeze({
  PING: 'QC_PING',
  GET_STATUS: 'QC_GET_STATUS',
  GET_RELAY_URL: 'QC_GET_RELAY_URL',
  OPEN_SETTINGS: 'QC_OPEN_SETTINGS',
});

function isMessage(value) {
  return Boolean(value && typeof value === 'object' && typeof value.type === 'string');
}

function validateMessage(value) {
  if (!isMessage(value) || !Object.values(MESSAGE_TYPES).includes(value.type)) {
    return { ok: false, error: 'Unknown or malformed message' };
  }
  return { ok: true, message: value };
}

function createBackgroundController({ browserApi, storageArea, getStatus }) {
  if (!browserApi?.runtime?.onMessage?.addListener) {
    throw new Error('runtime messaging is not available');
  }

  async function handleMessage(rawMessage, sender) {
    const validation = validateMessage(rawMessage);
    if (!validation.ok) return validation;
    const { type } = validation.message;

    if (type === MESSAGE_TYPES.PING) return { ok: true, type: MESSAGE_TYPES.PING };
    if (type === MESSAGE_TYPES.GET_RELAY_URL) {
      const result = await storageArea.get('config:relay-url');
      return { ok: true, relayConfigured: typeof result['config:relay-url'] === 'string' };
    }
    if (type === MESSAGE_TYPES.GET_STATUS) {
      const tabUrl = sender?.tab?.url || null;
      return { ok: true, status: await getStatus(tabUrl) };
    }
    if (type === MESSAGE_TYPES.OPEN_SETTINGS) {
      return { ok: true, accepted: Boolean(sender?.tab?.id) };
    }
    return { ok: false, error: 'Unhandled message' };
  }

  browserApi.runtime.onMessage.addListener(handleMessage);
  return { handleMessage };
}

module.exports = { MESSAGE_TYPES, validateMessage, createBackgroundController };

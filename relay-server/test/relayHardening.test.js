'use strict';
const WebSocket = require('ws');
const { startRelay, broadcastToRoom } = require('../src/relay');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

function waitOpen(ws) {
  return new Promise((resolve) => ws.once('open', resolve));
}
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const PORT = 8126;
  const relay = startRelay(PORT);

  // ---- Multiple clients in the same room all receive a broadcast ----
  const roomAClient1 = new WebSocket(`ws://localhost:${PORT}?room=room-a`);
  const roomAClient2 = new WebSocket(`ws://localhost:${PORT}?room=room-a`);
  const roomAClient3 = new WebSocket(`ws://localhost:${PORT}?room=room-a`);
  await Promise.all([roomAClient1, roomAClient2, roomAClient3].map(waitOpen));

  const received2 = [];
  const received3 = [];
  roomAClient2.on('message', (data) => received2.push(data.toString()));
  roomAClient3.on('message', (data) => received3.push(data.toString()));

  roomAClient1.send('hello room A');
  await wait(100);

  check('second client in the room receives the broadcast', received2.includes('hello room A'));
  check('third client in the room also receives the broadcast', received3.includes('hello room A'));

  // ---- Room isolation: a different room never sees room A's messages ----
  const roomBClient = new WebSocket(`ws://localhost:${PORT}?room=room-b`);
  await waitOpen(roomBClient);
  const receivedB = [];
  roomBClient.on('message', (data) => receivedB.push(data.toString()));

  roomAClient1.send('room A secret');
  await wait(100);
  check("a client in a different room never receives another room's messages", receivedB.length === 0);

  // ---- Stats reflect current rooms/clients ----
  const statsBeforeClose = relay.getStats();
  check('stats report the correct room count', statsBeforeClose.roomCount === 2);
  check('stats report the correct client count for room A', statsBeforeClose.clientsPerRoom['room-a'] === 3);

  // ---- Room cleanup: closing all clients in a room removes it from stats ----
  roomAClient1.close();
  roomAClient2.close();
  roomAClient3.close();
  await wait(150);

  const statsAfterClose = relay.getStats();
  check('room A is removed from stats once all its clients disconnect', !('room-a' in statsAfterClose.clientsPerRoom));
  check('room B, still active, remains in stats', 'room-b' in statsAfterClose.clientsPerRoom);

  // ---- Resilience: a broken peer's send failure doesn't block others ----
  // Tested at the broadcastToRoom level with mock peers, NOT via real
  // WebSocket client connections — overriding a *client-side* .send() has
  // no effect on the server's own internal peer objects, which aren't
  // reachable from outside the module. Testing it that way would silently
  // pass for the wrong reason (nothing server-side would ever actually throw).
  const sentToGood = [];
  const mockGoodPeer = { readyState: WebSocket.OPEN, send: (data) => sentToGood.push(data) };
  const mockFlakyPeer = { readyState: WebSocket.OPEN, send: () => { throw new Error('simulated send failure'); } };
  const mockSender = { readyState: WebSocket.OPEN, send: () => {} };

  const mockRoom = new Set([mockGoodPeer, mockFlakyPeer, mockSender]);
  broadcastToRoom(mockRoom, mockSender, 'test message');

  check("a healthy peer still receives the broadcast even when another peer's send throws", sentToGood.includes('test message'));
  check("the flaky peer's thrown error did not propagate out of broadcastToRoom", true); // if it had, this process would have crashed already

  roomBClient.close();
  relay.close();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

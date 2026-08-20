'use strict';
const { JSDOM } = require('jsdom');
const { mountMemberManagement } = require('../src/ui/memberManagementView');

let pass = 0, fail = 0;
function check(label, condition) { console.log((condition ? 'PASS' : 'FAIL') + ' — ' + label); condition ? pass++ : fail++; }

async function main() {
  const dom = new JSDOM('<body></body>');
  let removed = 0;
  const controller = {
    async listMembersForDisplay() { return removed ? [] : [{ memberId: 'bob', displayName: 'Bob', publicKeyFingerprint: 'a1b2 c3d4' }]; },
    async removeMemberAndRotate(id) { if (id === 'bob') removed++; },
  };
  const host = dom.window.document.createElement('div');
  await mountMemberManagement(host, controller);
  check('member view renders a fingerprinted member', host.querySelector('.qc-settings-member-identity').textContent.includes('a1b2 c3d4'));
  const remove = host.querySelector('.qc-settings-member-remove');
  remove.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  check('member removal requires explicit confirmation', host.querySelector('.qc-settings-member-remove').textContent === 'Confirm removal');
  host.querySelector('.qc-settings-member-remove').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  check('confirmed removal triggers rotation and removes the member', host.querySelector('.qc-settings-member-row') === null && host.querySelector('.qc-settings-member-status').textContent.includes('rotated'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((error) => { console.error(error); process.exit(1); });

'use strict';
const { JSDOM } = require('jsdom');
const { mountWorkspaceStatus } = require('../src/ui/workspaceStatusView');

let pass = 0, fail = 0;
function check(label, condition) {
  console.log((condition ? 'PASS' : 'FAIL') + ' — ' + label);
  condition ? pass++ : fail++;
}

const dom = new JSDOM('<body></body>');
const host = dom.window.document.createElement('div');
let opened = 0;
const status = mountWorkspaceStatus(host, {
  lockedWorkspaces: [{ name: 'Shared review' }],
  onOpenSettings: () => { opened += 1; },
});
check('locked workspace notice explains the recovery path', host.querySelector('.qc-workspace-status')?.textContent.includes('Shared review') && host.textContent.includes('key backup'));
host.querySelector('.qc-workspace-status-settings').click();
check('locked workspace notice opens settings', opened === 1);
status.clear();
check('clearing the notice removes it from the page', host.querySelector('.qc-workspace-status') === null);
status.update([{ name: 'One' }, { name: 'Two' }]);
check('notice handles multiple locked workspaces', host.textContent.includes('are locked') && host.textContent.includes('One') && host.textContent.includes('Two'));
status.dispose();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

const fs = require('fs');
const file = 'C:/Users/pauly/Documents/VisibleShelf/retail-visibility-platform/prompts/api-admin-marketing-ops-prompts-templates.md';
const c = fs.readFileSync(file, 'utf8');
const data = JSON.parse(c);

for (const id of ['mpt-j9bbem3l', 'mpt-6oeuiizo', 'mpt-je6m7ru6']) {
  const t = data.data.find(x => x.id === id);
  if (!t) { console.log(id, 'NOT FOUND'); continue; }
  const body = t.body;
  console.log('===', id, '===');
  console.log('Body length:', body.length);

  // Show context around each placeholder
  const matches = [...body.matchAll(/\{\{(\w+)\}\}/g)];
  for (const m of matches) {
    const start = Math.max(0, m.index - 200);
    const end = Math.min(body.length, m.index + m[0].length + 100);
    console.log('\n--- {{' + m[1] + '}} at offset', m.index, '---');
    console.log(JSON.stringify(body.substring(start, end)));
  }

  // Show requested_business block
  const rbIdx = body.indexOf('requested_business');
  if (rbIdx >= 0) {
    console.log('\n--- requested_business block ---');
    console.log(JSON.stringify(body.substring(rbIdx, rbIdx + 400)));
  }
  console.log('\n');
}

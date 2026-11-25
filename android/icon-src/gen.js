const { chromium } = require('/workspace/fruit-test/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/icon.html');
  const save = (name, d) => fs.writeFileSync(path.join(__dirname, name), Buffer.from(d.split(',')[1], 'base64'));
  save('icon-512.png', await p.evaluate(() => render(512, true, 0.12)));
  save('foreground-432.png', await p.evaluate(() => render(432, false, 0.22)));
  console.log('errors', errs);
  await b.close();
})();

import fs from 'fs';
import highs from 'highs';

async function run() {
  let lp = fs.readFileSync('lp.txt', 'utf8');
  lp = lp.split('General')[0] + 'End\n';
  const h = await highs();
  const start = Date.now();
  const result = h.solve(lp);
  console.log(result.Status, Date.now() - start, "ms");
  let sum = 0;
  for (const k in result.Columns) {
    if (k.startsWith('x_')) sum += Math.round(result.Columns[k].Primal);
  }
  console.log("Total rounded x:", sum);
}
run();

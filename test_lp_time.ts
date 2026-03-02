import fs from 'fs';
import highs from 'highs';

async function run() {
  const lp = fs.readFileSync('lp.txt', 'utf8');
  const h = await highs();
  const start = Date.now();
  const result = h.solve(lp, { time_limit: 2.0 });
  console.log(result.Status, Date.now() - start, "ms");
  console.log(Object.keys(result.Columns).length);
  if (Object.keys(result.Columns).length > 0) {
    const k = Object.keys(result.Columns)[0];
    console.log(result.Columns[k]);
  }
}
run();

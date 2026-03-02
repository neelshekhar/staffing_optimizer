import fs from 'fs';
import highs from 'highs';

async function run() {
  const lp = fs.readFileSync('lp.txt', 'utf8');
  const h = await highs();
  try {
    const result = h.solve(lp);
    console.log(result.Status);
  } catch (e) {
    console.error(e);
  }
}
run();

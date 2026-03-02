import highs from 'highs';

async function run() {
  const h = await highs();
  const lp = `Minimize
 obj:
 40 x_0
 + 1000 u_0
Subject To
 c_0:
 1 x_0
 + 1 u_0
 - 1 o_0
 = 1.25
 mix_pt:
 - 0.3 x_0
 <= 0
Bounds
 0 <= x_0
 0 <= u_0
 0 <= o_0
General
 x_0
End
`;
  const result = h.solve(lp);
  console.log(result.Status);
}
run();

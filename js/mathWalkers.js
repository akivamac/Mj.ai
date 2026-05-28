// Mj.ai math step-walkers (v55). Pure functions that take user-extracted
// numbers and emit human-readable step lists. Each returns
//   { answer, steps: [ { label, calc, result } ] }
// so the formatter renders all walkers uniformly. Called from the WORKED
// dispatcher path and from TEACH tutorials that declare a `walker` field.

const MathWalkers = (() => {

  // ── helpers ───────────────────────────────────────────────
  const _gcd = (a, b) => { a = Math.abs(a|0); b = Math.abs(b|0); while (b) [a,b]=[b,a%b]; return a; };
  const _lcm = (a, b) => (!a || !b) ? 0 : Math.abs(a*b) / _gcd(a, b);
  const _fmt = n => (typeof MathEngine !== 'undefined' && MathEngine.formatNumber)
    ? MathEngine.formatNumber(n) : String(n);

  // ── walkers ───────────────────────────────────────────────

  // walkArithmetic: order-of-operations trace for simple a + b, a × b, etc.
  // Falls back to "(a OP b)" when we don't know the op. Mostly used by
  // tutorials that show "47 + 28 = 75" with carrying.
  function walkArithmetic(nums, op) {
    if (!nums || nums.length < 2) return null;
    const a = nums[0], b = nums[1];
    op = op || '+';
    const ans = op === '+' ? a + b : op === '-' ? a - b
              : op === '*' || op === '×' ? a * b
              : op === '/' || op === '÷' ? a / b : null;
    return {
      answer: ans,
      steps: [
        { label: 'Operation', calc: `${a} ${op} ${b}`, result: _fmt(ans) }
      ]
    };
  }

  // walkPercent: "25% of 80" → 20, with conversion + multiply.
  function walkPercent(nums) {
    if (!nums || nums.length < 2) return null;
    const pct = nums[0], of = nums[1];
    const dec = pct / 100;
    const ans = dec * of;
    return {
      answer: ans,
      steps: [
        { label: 'Convert percent',  calc: `${pct}% = ${pct}/100 = ${_fmt(dec)}` },
        { label: 'Multiply',         calc: `${_fmt(dec)} × ${of}`, result: _fmt(ans) }
      ]
    };
  }

  // walkLinearEq: solve ax + b = c. Pass numbers in that order.
  function walkLinearEq(nums) {
    if (!nums || nums.length < 3) return null;
    const a = nums[0], b = nums[1], c = nums[2];
    const rhs = c - b;
    const x = rhs / a;
    return {
      answer: x,
      steps: [
        { label: 'Start',           calc: `${a}x + ${b} = ${c}` },
        { label: 'Subtract',        calc: `${a}x = ${c} - ${b} = ${_fmt(rhs)}` },
        { label: 'Divide',          calc: `x = ${_fmt(rhs)} / ${a} = ${_fmt(x)}` }
      ]
    };
  }

  // walkQuadratic: solve ax² + bx + c = 0 via discriminant.
  function walkQuadratic(nums) {
    if (!nums || nums.length < 3) return null;
    const a = nums[0], b = nums[1], c = nums[2];
    const d = b*b - 4*a*c;
    const steps = [
      { label: 'Start',         calc: `${a}x² + ${b}x + ${c} = 0` },
      { label: 'Discriminant',  calc: `b² - 4ac = ${b*b} - ${4*a*c} = ${_fmt(d)}` }
    ];
    if (d < 0) {
      steps.push({ label: 'No real roots', calc: 'discriminant < 0' });
      return { answer: null, steps };
    }
    const sd = Math.sqrt(d);
    const x1 = (-b + sd) / (2*a);
    const x2 = (-b - sd) / (2*a);
    steps.push({ label: 'Apply formula', calc: `x = (-${b} ± √${_fmt(d)}) / ${2*a}` });
    steps.push({ label: 'Two roots',     calc: `x = ${_fmt(x1)} or x = ${_fmt(x2)}` });
    return { answer: [x1, x2], steps };
  }

  // walkFractionOp: a/b op c/d.  op ∈ {+, -, *, /}
  function walkFractionOp(nums, op) {
    if (!nums || nums.length < 4) return null;
    const [a, b, c, d] = nums;
    op = op || '+';
    let nNum, nDen;
    let steps = [];
    if (op === '+' || op === '-') {
      const lcd = _lcm(b, d);
      const aN = a * (lcd / b);
      const cN = c * (lcd / d);
      nNum = op === '+' ? aN + cN : aN - cN;
      nDen = lcd;
      steps.push({ label: 'Find LCD',  calc: `lcm(${b}, ${d}) = ${lcd}` });
      steps.push({ label: 'Rewrite',   calc: `${a}/${b} = ${aN}/${lcd},  ${c}/${d} = ${cN}/${lcd}` });
      steps.push({ label: op === '+' ? 'Add' : 'Subtract',
                   calc: `(${aN} ${op} ${cN}) / ${lcd} = ${nNum}/${nDen}` });
    } else if (op === '*' || op === '×') {
      nNum = a * c; nDen = b * d;
      steps.push({ label: 'Multiply tops', calc: `${a} × ${c} = ${nNum}` });
      steps.push({ label: 'Multiply bots', calc: `${b} × ${d} = ${nDen}` });
    } else {
      // divide: flip second and multiply
      nNum = a * d; nDen = b * c;
      steps.push({ label: 'Flip second', calc: `${c}/${d} → ${d}/${c}` });
      steps.push({ label: 'Multiply',   calc: `${a}/${b} × ${d}/${c} = ${nNum}/${nDen}` });
    }
    const g = _gcd(Math.abs(nNum), Math.abs(nDen)) || 1;
    if (g > 1) {
      steps.push({ label: 'Simplify',  calc: `${nNum}/${nDen} ÷ ${g}/${g} = ${nNum/g}/${nDen/g}` });
      nNum /= g; nDen /= g;
    }
    return { answer: `${nNum}/${nDen}`, steps };
  }

  // walkPrimeFactor: trial divide n into primes.
  function walkPrimeFactor(nums) {
    if (!nums || !nums.length) return null;
    let n = Math.abs(nums[0]|0);
    if (n < 2) return { answer: '(none)', steps: [{ label: 'Too small', calc: `${nums[0]} has no prime factors` }] };
    const factors = [];
    const steps = [{ label: 'Start', calc: `n = ${n}` }];
    let p = 2;
    while (p * p <= n) {
      while (n % p === 0) {
        steps.push({ label: `÷ ${p}`, calc: `${n} / ${p} = ${n/p}` });
        n = n / p;
        factors.push(p);
      }
      p++;
    }
    if (n > 1) { factors.push(n); steps.push({ label: 'Remaining', calc: `${n} is prime` }); }
    return { answer: factors.join(' × '), steps };
  }

  // walkLongDivision: schoolbook scaffold for dividend ÷ divisor.
  function walkLongDivision(nums) {
    if (!nums || nums.length < 2) return null;
    let [dividend, divisor] = nums;
    dividend = Math.abs(dividend|0); divisor = Math.abs(divisor|0);
    if (divisor === 0) return null;
    const q = Math.floor(dividend / divisor);
    const r = dividend - q * divisor;
    const steps = [
      { label: 'Quotient',  calc: `${dividend} ÷ ${divisor} = ${q}` }
    ];
    if (r !== 0) steps.push({ label: 'Remainder', calc: `${q} × ${divisor} = ${q*divisor}, ${dividend} - ${q*divisor} = ${r}` });
    return { answer: r === 0 ? String(q) : `${q} remainder ${r}`, steps };
  }

  // walkUnitConvert: show the multiplication + cancellation.
  function walkUnitConvert(nums, fromUnit, toUnit, factor) {
    if (!nums || !nums.length) return null;
    const v = nums[0];
    const ans = v * (factor || 1);
    return {
      answer: ans,
      steps: [
        { label: 'Conversion factor', calc: `1 ${fromUnit} = ${factor} ${toUnit}` },
        { label: 'Multiply',          calc: `${v} ${fromUnit} × ${factor} = ${_fmt(ans)} ${toUnit}` }
      ]
    };
  }

  // walkPolyDerivative: power rule term-by-term. Takes a polynomial string.
  function walkPolyDerivative(polyStr) {
    if (typeof MathEngine === 'undefined' || !MathEngine.polyDerivative) return null;
    const d = MathEngine.polyDerivative(polyStr);
    if (!d) return null;
    const origCoefs = d.original;
    const steps = [{ label: 'Start', calc: `d/dx [ ${d.originalText} ]` }];
    for (const p of Object.keys(origCoefs).map(Number).sort((a,b)=>b-a)) {
      const c = origCoefs[p];
      if (c === 0) continue;
      if (p === 0) { steps.push({ label: 'Constant', calc: `d/dx[${c}] = 0` }); continue; }
      const nc = c * p, np = p - 1;
      const term = p === 1 ? `${c}x` : `${c}x^${p}`;
      const dterm = np === 0 ? `${nc}` : np === 1 ? `${nc}x` : `${nc}x^${np}`;
      steps.push({ label: 'Power rule', calc: `d/dx[${term}] = ${dterm}` });
    }
    steps.push({ label: 'Result', calc: d.text });
    return { answer: d.text, steps };
  }

  // walkPolyIntegral: reverse power rule, optionally definite [a, b].
  function walkPolyIntegral(polyStr, a, b) {
    if (typeof MathEngine === 'undefined' || !MathEngine.polyIntegral) return null;
    const d = MathEngine.polyIntegral(polyStr, a, b);
    if (!d) return null;
    const origCoefs = d.original;
    const steps = [{ label: 'Start', calc: `∫ ${d.originalText} dx` }];
    for (const p of Object.keys(origCoefs).map(Number).sort((a2,b2)=>b2-a2)) {
      const c = origCoefs[p];
      const nc = c / (p + 1), np = p + 1;
      const term = p === 0 ? `${c}` : p === 1 ? `${c}x` : `${c}x^${p}`;
      const iterm = np === 1 ? `${nc}x` : `${nc}x^${np}`;
      steps.push({ label: 'Reverse power', calc: `∫ ${term} dx = ${iterm}` });
    }
    steps.push({ label: 'Result', calc: d.text });
    if (d.definite != null) {
      steps.push({ label: 'Evaluate', calc: `F(${b}) - F(${a}) = ${_fmt(d.definite)}` });
      return { answer: _fmt(d.definite), steps };
    }
    return { answer: d.text, steps };
  }

  // walkMatrix2x2: op in {det, inv, mul}. A is required, B for mul.
  function walkMatrix2x2(op, A, B) {
    if (!A) return null;
    const fmt = M => `[[${M[0][0]}, ${M[0][1]}], [${M[1][0]}, ${M[1][1]}]]`;
    if (op === 'det') {
      const d = A[0][0]*A[1][1] - A[0][1]*A[1][0];
      return {
        answer: d,
        steps: [
          { label: 'Matrix',      calc: fmt(A) },
          { label: 'Determinant', calc: `ad - bc = (${A[0][0]})(${A[1][1]}) - (${A[0][1]})(${A[1][0]}) = ${d}` }
        ]
      };
    }
    if (op === 'inv') {
      const d = A[0][0]*A[1][1] - A[0][1]*A[1][0];
      if (Math.abs(d) < 1e-12) return { answer: null, steps: [{ label: 'Singular', calc: 'det = 0; no inverse' }] };
      const inv = [
        [ A[1][1]/d, -A[0][1]/d],
        [-A[1][0]/d,  A[0][0]/d]
      ];
      return {
        answer: inv,
        steps: [
          { label: 'Matrix',      calc: fmt(A) },
          { label: 'Determinant', calc: `${d}` },
          { label: 'Swap + sign', calc: `(1/${d}) × [[${A[1][1]}, ${-A[0][1]}], [${-A[1][0]}, ${A[0][0]}]]` },
          { label: 'Inverse',     calc: fmt(inv) }
        ]
      };
    }
    if (op === 'mul') {
      if (!B) return null;
      const C = [
        [A[0][0]*B[0][0] + A[0][1]*B[1][0], A[0][0]*B[0][1] + A[0][1]*B[1][1]],
        [A[1][0]*B[0][0] + A[1][1]*B[1][0], A[1][0]*B[0][1] + A[1][1]*B[1][1]]
      ];
      return {
        answer: C,
        steps: [
          { label: 'A', calc: fmt(A) },
          { label: 'B', calc: fmt(B) },
          { label: 'Product (rows·cols)', calc: fmt(C) }
        ]
      };
    }
    return null;
  }

  // walkLinearSystem2: substitution method for { a1x+b1y=c1; a2x+b2y=c2 }.
  function walkLinearSystem2(nums) {
    if (!nums || nums.length < 6) return null;
    const [a1, b1, c1, a2, b2, c2] = nums;
    const det = a1*b2 - a2*b1;
    if (Math.abs(det) < 1e-12) {
      return { answer: null, steps: [{ label: 'Parallel lines', calc: 'det = 0; no unique solution' }] };
    }
    const x = (c1*b2 - c2*b1) / det;
    const y = (a1*c2 - a2*c1) / det;
    return {
      answer: { x, y },
      steps: [
        { label: 'System',       calc: `${a1}x + ${b1}y = ${c1};  ${a2}x + ${b2}y = ${c2}` },
        { label: "Cramer's det", calc: `det = a1·b2 - a2·b1 = ${a1*b2} - ${a2*b1} = ${det}` },
        { label: 'x',            calc: `(c1·b2 - c2·b1) / det = ${_fmt(x)}` },
        { label: 'y',            calc: `(a1·c2 - a2·c1) / det = ${_fmt(y)}` }
      ]
    };
  }

  // Format a walker's output into a printable string.
  function formatSteps(walked) {
    if (!walked) return null;
    const lines = walked.steps.map(s => s.result != null
      ? `  ${s.label}: ${s.calc} = ${s.result}`
      : `  ${s.label}: ${s.calc}`);
    const ans = walked.answer != null
      ? (typeof walked.answer === 'object' ? JSON.stringify(walked.answer) : walked.answer)
      : '(see steps)';
    return `Answer: ${ans}\n\nWork:\n${lines.join('\n')}`;
  }

  // Generic by-name dispatch used by tutorials that name a walker.
  function run(name, nums, extra) {
    const fn = WALKERS[name];
    if (!fn) return null;
    return fn(nums, ...(extra || []));
  }

  const WALKERS = {
    walkArithmetic, walkPercent, walkLinearEq, walkQuadratic,
    walkFractionOp, walkPrimeFactor, walkLongDivision, walkUnitConvert,
    walkPolyDerivative, walkPolyIntegral, walkMatrix2x2, walkLinearSystem2
  };

  return Object.assign({}, WALKERS, { formatSteps, run });
})();

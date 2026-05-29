// Mj.ai math engine (v52). Two capabilities:
//
//  1. evaluateExpression(input) — safe arithmetic evaluator. Recursive
//     descent parser, no eval. Handles +-*/%^, parens, percentages,
//     natural language ("plus"/"times"/"of"), and common functions
//     (sqrt, abs, sin, cos, tan, log, ln, floor, ceil, round, factorial).
//     Trig takes degrees by default — kids and most casual use expects
//     "sin(90) = 1", not the radian answer.
//
//  2. convertUnit(input) — unit conversion. "5 feet to meters",
//     "100F to C", "30 minutes in seconds". Length, weight, temperature,
//     time, volume, speed, data.

const MathEngine = (() => {

  // ── Expression evaluator ────────────────────────────────

  function preprocess(s) {
    let t = s.toLowerCase();
    // unicode math operators → ASCII (×, ÷, ⋅, •, ·, ∗, minus-sign)
    t = t.replace(/[×⋅∗•·]/g, '*').replace(/÷/g, '/').replace(/[−–—]/g, '-');
    // "300 x 7" / "6x4" — ascii x between two numbers means multiply
    t = t.replace(/(\d)\s*x\s*(?=\d)/g, '$1*');
    // strip thousands separators inside numbers ("6,000" → "6000"). Only a
    // comma followed by exactly 3 digits, so stats lists ("1,2,3") and small
    // function args ("max(3,5)") are left alone. Looped for "1,000,000".
    let _pc;
    do { _pc = t; t = t.replace(/(\d),(\d{3})(?=\D|$)/g, '$1$2'); } while (t !== _pc);
    // word ops → symbols
    t = t.replace(/\bdivided by\b/g, '/');
    t = t.replace(/\bmultiplied by\b/g, '*');
    t = t.replace(/\btimes\b/g, '*');
    t = t.replace(/\bplus\b/g, '+');
    t = t.replace(/\bminus\b/g, '-');
    t = t.replace(/\bover\b/g, '/');
    t = t.replace(/\bmod(ulo)?\b/g, '%');
    t = t.replace(/\bto the power of\b/g, '^');
    t = t.replace(/\bsquared\b/g, '^2');
    t = t.replace(/\bcubed\b/g, '^3');
    // "square root of N" / "cube root of N" → sqrt(N) / N^(1/3)
    t = t.replace(/\b(?:the\s+)?square\s+root\s+of\s+(\d+(?:\.\d+)?)/g, 'sqrt($1)');
    t = t.replace(/\b(?:the\s+)?cube\s+root\s+of\s+(\d+(?:\.\d+)?)/g, '($1)^(1/3)');
    // "X% of Y" → "(X/100)*Y"
    t = t.replace(/(\d+(?:\.\d+)?)\s*%\s*of\s+/g, '($1/100)*');
    // standalone "X%" → "(X/100)"
    t = t.replace(/(\d+(?:\.\d+)?)\s*%(?!\s*\d)/g, '($1/100)');
    // strip common request wrappers
    t = t.replace(/^(what\s+is|what'?s|whats|what about|how about|and what(?:'?s| is| about)?|calculate|compute|evaluate|work out|solve|how much is|how much)\s+/i, '');
    t = t.replace(/[?.]+$/, '').trim();
    // natural-language binary ops: "(the) sum of A and B", "product of 3 and 4",
    // "difference between 10 and 3", "quotient of 20 and 4". Operands get
    // wrapped in parens so each is evaluated whole.
    t = t.replace(/^(?:the\s+)?sum\s+of\s+(.+?)\s+and\s+(.+)$/, '($1)+($2)');
    t = t.replace(/^(?:the\s+)?product\s+of\s+(.+?)\s+and\s+(.+)$/, '($1)*($2)');
    t = t.replace(/^(?:the\s+)?difference\s+(?:of|between)\s+(.+?)\s+and\s+(.+)$/, '($1)-($2)');
    t = t.replace(/^(?:the\s+)?quotient\s+of\s+(.+?)\s+and\s+(.+)$/, '($1)/($2)');
    // "(the) sum/total of 2+3" — lead-in on an expression that already has an
    // operator. The lookahead requires an operator before any comma, so stats
    // lists ("sum of 2,3,4") fall through to the summarize path untouched.
    t = t.replace(/^(?:the\s+)?(?:sum|total)\s+of\s+(?=[^,]*[-+*/^])/, '');
    // π and e
    t = t.replace(/\bpi\b/g, '(' + Math.PI + ')');
    t = t.replace(/\beuler('s)?\s+number\b/g, '(' + Math.E + ')');
    return t;
  }

  // True if the input is mostly numbers/operators with optional supported
  // identifiers — what we'll treat as "math intent". The dispatcher uses
  // this to decide whether to even try evaluating.
  function looksLikeMath(input) {
    const t = preprocess(input);
    if (!t) return false;
    if (!/\d/.test(t)) return false;
    // Must contain at least one operator OR be a function call.
    if (!/[+\-*/%^()]|sqrt|abs|sin|cos|tan|asin|acos|atan|log|ln|floor|ceil|round|factorial|exp/.test(t)) return false;
    // Reject anything with letters that aren't supported identifiers.
    // Strip supported tokens first, then check what's left.
    const stripped = t
      .replace(/sqrt|abs|sinh|cosh|tanh|asin|acos|atan|sin|cos|tan|log10|log|ln|floor|ceil|round|factorial|exp|min|max/g, '')
      .replace(/[\d.\s+\-*/%^()!,]/g, '');
    return stripped.length === 0;
  }

  function tokenize(s) {
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/\d/.test(c) || (c === '.' && /\d/.test(s[i+1]))) {
        let j = i;
        while (j < s.length && /[\d.]/.test(s[j])) j++;
        tokens.push({ type: 'num', value: parseFloat(s.slice(i, j)) });
        i = j;
        continue;
      }
      if (/[a-z]/i.test(c)) {
        let j = i;
        while (j < s.length && /[a-z0-9]/i.test(s[j])) j++;
        tokens.push({ type: 'ident', value: s.slice(i, j).toLowerCase() });
        i = j;
        continue;
      }
      if ('+-*/%^()!,'.includes(c)) {
        tokens.push({ type: 'op', value: c });
        i++;
        continue;
      }
      // unknown char — let the parser complain
      throw new Error('unexpected character: ' + c);
    }
    return tokens;
  }

  // Recursive-descent parser. Pratt-style precedence:
  //   + - (lowest)
  //   * / %
  //   ^ (right-assoc, higher than unary minus)
  //   unary - +
  //   ! (postfix factorial)
  //   atom: number, paren, function call, identifier
  function parse(tokens) {
    let pos = 0;
    const peek = () => tokens[pos];
    const eat = (type, value) => {
      const t = tokens[pos];
      if (!t) throw new Error('unexpected end of expression');
      if (t.type !== type || (value != null && t.value !== value)) {
        throw new Error(`expected ${value || type}, got ${t.value}`);
      }
      pos++;
      return t;
    };

    const FUNCS = {
      sqrt: Math.sqrt,
      abs:  Math.abs,
      sin:  x => Math.sin(x * Math.PI / 180),    // degree-aware
      cos:  x => Math.cos(x * Math.PI / 180),
      tan:  x => Math.tan(x * Math.PI / 180),
      asin: x => Math.asin(x) * 180 / Math.PI,
      acos: x => Math.acos(x) * 180 / Math.PI,
      atan: x => Math.atan(x) * 180 / Math.PI,
      sinh: Math.sinh,
      cosh: Math.cosh,
      tanh: Math.tanh,
      log10: x => Math.log10(x),
      log:  x => Math.log10(x),  // user-friendly default
      ln:   Math.log,
      floor: Math.floor,
      ceil:  Math.ceil,
      round: x => Math.round(x),
      exp:   Math.exp,
      factorial: function fact(n) {
        if (n < 0 || n !== Math.floor(n)) throw new Error('factorial needs a non-negative integer');
        if (n > 170) throw new Error('factorial of n>170 overflows JS numbers');
        let r = 1;
        for (let k = 2; k <= n; k++) r *= k;
        return r;
      },
      min: Math.min,
      max: Math.max
    };

    function parseExpr() { return parseAddSub(); }

    function parseAddSub() {
      let left = parseMulDiv();
      while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
        const op = eat('op').value;
        const right = parseMulDiv();
        left = op === '+' ? left + right : left - right;
      }
      return left;
    }

    function parseMulDiv() {
      let left = parsePower();
      while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/' || peek().value === '%')) {
        const op = eat('op').value;
        const right = parsePower();
        if (op === '*') left = left * right;
        else if (op === '/') {
          if (right === 0) throw new Error('division by zero');
          left = left / right;
        }
        else left = left % right;
      }
      return left;
    }

    function parsePower() {
      const base = parseUnary();
      if (peek() && peek().type === 'op' && peek().value === '^') {
        eat('op');
        const exp = parsePower(); // right-associative
        return Math.pow(base, exp);
      }
      return base;
    }

    function parseUnary() {
      if (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
        const op = eat('op').value;
        const v = parseUnary();
        return op === '+' ? v : -v;
      }
      return parsePostfix();
    }

    function parsePostfix() {
      let v = parseAtom();
      // factorial: 5!
      while (peek() && peek().type === 'op' && peek().value === '!') {
        eat('op');
        v = FUNCS.factorial(v);
      }
      return v;
    }

    function parseAtom() {
      const t = peek();
      if (!t) throw new Error('unexpected end of expression');
      if (t.type === 'num') { eat('num'); return t.value; }
      if (t.type === 'op' && t.value === '(') {
        eat('op', '(');
        const v = parseExpr();
        eat('op', ')');
        return v;
      }
      if (t.type === 'ident') {
        eat('ident');
        const name = t.value;
        if (peek() && peek().type === 'op' && peek().value === '(') {
          if (!FUNCS[name]) throw new Error(`unknown function: ${name}`);
          eat('op', '(');
          const args = [parseExpr()];
          while (peek() && peek().type === 'op' && peek().value === ',') {
            eat('op', ',');
            args.push(parseExpr());
          }
          eat('op', ')');
          return FUNCS[name].apply(null, args);
        }
        if (name === 'pi') return Math.PI;
        if (name === 'e') return Math.E;
        throw new Error(`unknown identifier: ${name}`);
      }
      throw new Error('unexpected token: ' + JSON.stringify(t));
    }

    const result = parseExpr();
    if (pos < tokens.length) {
      throw new Error('trailing tokens after expression');
    }
    return result;
  }

  // Format a number for human display: trim trailing zeros but cap precision.
  function formatNumber(n) {
    if (!isFinite(n)) return String(n);
    if (Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-4 && n !== 0)) {
      return n.toExponential(6).replace(/\.?0+e/, 'e');
    }
    const rounded = Math.round(n * 1e10) / 1e10;
    return Number.isInteger(rounded) ? rounded.toString() : rounded.toString();
  }

  function evaluateExpression(input) {
    try {
      const cleaned = preprocess(input);
      if (!cleaned) return null;
      const tokens = tokenize(cleaned);
      if (!tokens.length) return null;
      const value = parse(tokens);
      return { value, cleaned };
    } catch(e) {
      return { error: e.message };
    }
  }

  // ── Unit conversion ─────────────────────────────────────

  // Conversion approach: every unit has a factor relative to a base unit
  // of its category, plus an optional offset (for temperature). To convert
  // from A → B in the same category:
  //    base = (A_value + A.offset) * A.factor
  //    B_value = base / B.factor - B.offset
  // Aliases map common synonyms to canonical unit IDs.

  const UNITS = {
    // length (base: meter)
    length: {
      m:  { factor: 1 },
      cm: { factor: 0.01 },
      mm: { factor: 0.001 },
      km: { factor: 1000 },
      in: { factor: 0.0254 },
      ft: { factor: 0.3048 },
      yd: { factor: 0.9144 },
      mi: { factor: 1609.344 },
      nm: { factor: 1852 },          // nautical mile, NOT nanometer here
      ly: { factor: 9.461e15 }
    },
    // weight / mass (base: gram)
    weight: {
      g:  { factor: 1 },
      mg: { factor: 0.001 },
      kg: { factor: 1000 },
      lb: { factor: 453.592 },
      oz: { factor: 28.3495 },
      ton: { factor: 1000000 }       // metric ton
    },
    // temperature (base: kelvin; offset means "add before factor")
    temperature: {
      k: { factor: 1, offset: 0 },
      c: { factor: 1, offset: 273.15 },
      f: { factor: 5/9, offset: 459.67 }
    },
    // time (base: second)
    time: {
      s:    { factor: 1 },
      ms:   { factor: 0.001 },
      us:   { factor: 1e-6 },
      ns:   { factor: 1e-9 },
      min:  { factor: 60 },
      hr:   { factor: 3600 },
      day:  { factor: 86400 },
      week: { factor: 604800 },
      year: { factor: 31557600 }     // Julian year
    },
    // volume (base: liter)
    volume: {
      l:    { factor: 1 },
      ml:   { factor: 0.001 },
      gal:  { factor: 3.78541 },     // US gallon
      qt:   { factor: 0.946353 },
      pt:   { factor: 0.473176 },
      cup:  { factor: 0.24 },
      tbsp: { factor: 0.0147868 },
      tsp:  { factor: 0.00492892 },
      'floz': { factor: 0.0295735 },
      'm3': { factor: 1000 },
      'ft3': { factor: 28.3168 }
    },
    // speed (base: m/s)
    speed: {
      'mps':  { factor: 1 },
      'kph':  { factor: 0.277778 },
      'mph':  { factor: 0.44704 },
      'knot': { factor: 0.514444 }
    },
    // data (base: byte)
    data: {
      b:   { factor: 1 },
      kb:  { factor: 1000 },
      mb:  { factor: 1e6 },
      gb:  { factor: 1e9 },
      tb:  { factor: 1e12 },
      kib: { factor: 1024 },
      mib: { factor: 1024 * 1024 },
      gib: { factor: 1024 * 1024 * 1024 },
      tib: { factor: 1024 ** 4 }
    }
  };

  // Aliases → canonical { category, unit } pair.
  const UNIT_ALIASES = {
    // length
    'meter': ['length','m'], 'meters': ['length','m'], 'metre': ['length','m'], 'metres': ['length','m'], 'm': ['length','m'],
    'centimeter': ['length','cm'], 'centimeters': ['length','cm'], 'cm': ['length','cm'],
    'millimeter': ['length','mm'], 'millimeters': ['length','mm'], 'mm': ['length','mm'],
    'kilometer': ['length','km'], 'kilometers': ['length','km'], 'km': ['length','km'],
    'inch': ['length','in'], 'inches': ['length','in'], 'in': ['length','in'], '"': ['length','in'],
    'foot': ['length','ft'], 'feet': ['length','ft'], 'ft': ['length','ft'], "'": ['length','ft'],
    'yard': ['length','yd'], 'yards': ['length','yd'], 'yd': ['length','yd'],
    'mile': ['length','mi'], 'miles': ['length','mi'], 'mi': ['length','mi'],
    'nauticalmile': ['length','nm'],
    'lightyear': ['length','ly'], 'lightyears': ['length','ly'], 'ly': ['length','ly'],

    // weight
    'gram': ['weight','g'], 'grams': ['weight','g'], 'g': ['weight','g'],
    'milligram': ['weight','mg'], 'milligrams': ['weight','mg'], 'mg': ['weight','mg'],
    'kilogram': ['weight','kg'], 'kilograms': ['weight','kg'], 'kg': ['weight','kg'], 'kilo': ['weight','kg'], 'kilos': ['weight','kg'],
    'pound': ['weight','lb'], 'pounds': ['weight','lb'], 'lb': ['weight','lb'], 'lbs': ['weight','lb'],
    'ounce': ['weight','oz'], 'ounces': ['weight','oz'], 'oz': ['weight','oz'],
    'ton': ['weight','ton'], 'tons': ['weight','ton'], 'tonne': ['weight','ton'], 'tonnes': ['weight','ton'],

    // temperature
    'celsius': ['temperature','c'], 'c': ['temperature','c'], '°c': ['temperature','c'], 'centigrade': ['temperature','c'],
    'fahrenheit': ['temperature','f'], 'f': ['temperature','f'], '°f': ['temperature','f'],
    'kelvin': ['temperature','k'], 'k': ['temperature','k'],

    // time
    'second': ['time','s'], 'seconds': ['time','s'], 's': ['time','s'], 'sec': ['time','s'], 'secs': ['time','s'],
    'millisecond': ['time','ms'], 'milliseconds': ['time','ms'], 'ms': ['time','ms'],
    'microsecond': ['time','us'], 'microseconds': ['time','us'], 'us': ['time','us'],
    'nanosecond': ['time','ns'], 'nanoseconds': ['time','ns'], 'ns': ['time','ns'],
    'minute': ['time','min'], 'minutes': ['time','min'], 'min': ['time','min'], 'mins': ['time','min'],
    'hour': ['time','hr'], 'hours': ['time','hr'], 'hr': ['time','hr'], 'hrs': ['time','hr'], 'h': ['time','hr'],
    'day': ['time','day'], 'days': ['time','day'], 'd': ['time','day'],
    'week': ['time','week'], 'weeks': ['time','week'], 'wk': ['time','week'],
    'year': ['time','year'], 'years': ['time','year'], 'yr': ['time','year'], 'yrs': ['time','year'],

    // volume
    'liter': ['volume','l'], 'liters': ['volume','l'], 'litre': ['volume','l'], 'litres': ['volume','l'], 'l': ['volume','l'],
    'milliliter': ['volume','ml'], 'milliliters': ['volume','ml'], 'millilitre': ['volume','ml'], 'ml': ['volume','ml'],
    'gallon': ['volume','gal'], 'gallons': ['volume','gal'], 'gal': ['volume','gal'],
    'quart': ['volume','qt'], 'quarts': ['volume','qt'], 'qt': ['volume','qt'],
    'pint': ['volume','pt'], 'pints': ['volume','pt'], 'pt': ['volume','pt'],
    'cup': ['volume','cup'], 'cups': ['volume','cup'],
    'tablespoon': ['volume','tbsp'], 'tablespoons': ['volume','tbsp'], 'tbsp': ['volume','tbsp'],
    'teaspoon': ['volume','tsp'], 'teaspoons': ['volume','tsp'], 'tsp': ['volume','tsp'],
    'flounce': ['volume','floz'], 'flounces': ['volume','floz'], 'floz': ['volume','floz'], 'fluidounce': ['volume','floz'],
    'cubicmeter': ['volume','m3'], 'm3': ['volume','m3'], 'm³': ['volume','m3'],
    'cubicfoot': ['volume','ft3'], 'ft3': ['volume','ft3'], 'ft³': ['volume','ft3'],

    // speed
    'mps': ['speed','mps'],
    'kph': ['speed','kph'], 'kmh': ['speed','kph'], 'kmph': ['speed','kph'],
    'mph': ['speed','mph'],
    'knot': ['speed','knot'], 'knots': ['speed','knot'], 'kt': ['speed','knot'], 'kts': ['speed','knot'],

    // data
    'byte': ['data','b'], 'bytes': ['data','b'], 'b': ['data','b'],
    'kilobyte': ['data','kb'], 'kilobytes': ['data','kb'], 'kb': ['data','kb'],
    'megabyte': ['data','mb'], 'megabytes': ['data','mb'], 'mb': ['data','mb'],
    'gigabyte': ['data','gb'], 'gigabytes': ['data','gb'], 'gb': ['data','gb'],
    'terabyte': ['data','tb'], 'terabytes': ['data','tb'], 'tb': ['data','tb'],
    'kibibyte': ['data','kib'], 'kib': ['data','kib'],
    'mebibyte': ['data','mib'], 'mib': ['data','mib'],
    'gibibyte': ['data','gib'], 'gib': ['data','gib']
  };

  function normalizeUnit(raw) {
    if (!raw) return null;
    let t = raw.toLowerCase().replace(/[\s.]/g, '').replace(/[\/]/g, 'p').replace(/-/g, '');
    if (t === '°c') t = 'c';
    if (t === '°f') t = 'f';
    return UNIT_ALIASES[t] || null;
  }

  // Parse "X UNIT to|in|into UNIT". Returns { value, from, to } or null.
  function parseConversion(input) {
    const t = input.trim();
    const re = /^(?:convert\s+|how\s+(?:much|many)\s+is\s+)?(-?\d+(?:\.\d+)?)\s*([a-z°"'³]+(?:\s+[a-z]+)?)\s+(?:to|in|into)\s+([a-z°"'³]+(?:\s+[a-z]+)?)[\s?.!]*$/i;
    const m = t.match(re);
    if (!m) return null;
    const value = parseFloat(m[1]);
    // Sometimes the unit names are multi-word like "nautical mile" — try them too.
    const from = normalizeUnit(m[2].replace(/\s+/g, ''));
    const to   = normalizeUnit(m[3].replace(/\s+/g, ''));
    if (!from || !to) return null;
    if (from[0] !== to[0]) return null;  // different categories
    return { value, from, to };
  }

  function convertUnit(input) {
    const p = parseConversion(input);
    if (!p) return null;
    const cat  = p.from[0];
    const fromU = UNITS[cat][p.from[1]];
    const toU   = UNITS[cat][p.to[1]];
    let base;
    if (cat === 'temperature') {
      base = (p.value + (fromU.offset || 0)) * fromU.factor;
      const out = base / toU.factor - (toU.offset || 0);
      return { value: out, from: p.from[1], to: p.to[1], category: cat, input: p.value };
    }
    base = p.value * fromU.factor;
    const out = base / toU.factor;
    return { value: out, from: p.from[1], to: p.to[1], category: cat, input: p.value };
  }

  // ── Algebra (v55) ────────────────────────────────────────
  //
  // Equation solver for linear and quadratic equations in a single
  // variable `x`. Approach: evaluate the equation as f(x) = LHS - RHS
  // at three sample points (0, 1, -1) and back out the coefficients
  // (a, b, c) for ax² + bx + c = 0. Then dispatch by whether a == 0
  // (linear) or not (quadratic). Reuses the existing evaluator by
  // string-substituting numeric values for `x`.

  function _evalAtX(exprStr, xValue) {
    // Insert implicit * between number and variable: "2x" → "2*x"
    let s = exprStr.replace(/(\d)(?=[a-zA-Z])/g, '$1*');
    // Replace standalone x with the numeric value, parenthesized.
    s = s.replace(/\bx\b/g, '(' + xValue + ')');
    const r = evaluateExpression(s);
    return r && !r.error ? r.value : NaN;
  }

  function solveEquation(input) {
    let s = String(input || '').toLowerCase().trim();
    s = s.replace(/^(solve|find x|find the value of x|find x in|for x[:,]?)\s+/i, '');
    s = s.replace(/[?.!]+$/, '').trim();
    if (!s.includes('=')) return null;
    const parts = s.split('=');
    if (parts.length !== 2) return null;
    const lhs = parts[0].trim(), rhs = parts[1].trim();
    if (!lhs || !rhs) return null;
    const f0   = _evalAtX(lhs, 0)  - _evalAtX(rhs, 0);
    const f1   = _evalAtX(lhs, 1)  - _evalAtX(rhs, 1);
    const fNeg = _evalAtX(lhs, -1) - _evalAtX(rhs, -1);
    if (![f0, f1, fNeg].every(v => isFinite(v))) return null;
    const a = (f1 + fNeg - 2 * f0) / 2;
    const b = (f1 - fNeg) / 2;
    const c = f0;
    const EPS = 1e-9;
    const snap = v => Math.abs(v) < EPS ? 0
                  : Math.abs(v - Math.round(v)) < EPS ? Math.round(v) : v;
    const aa = snap(a), bb = snap(b), cc = snap(c);
    if (aa === 0) {
      if (bb === 0) return cc === 0
        ? { type: 'identity', text: 'Any x works — both sides are equal.' }
        : { type: 'inconsistent', text: 'No solution — sides never match.' };
      const x = snap(-cc / bb);
      return { type: 'linear', a: bb, b: cc, x, lhs, rhs };
    }
    const d = bb * bb - 4 * aa * cc;
    if (Math.abs(d) < EPS) {
      const x = snap(-bb / (2 * aa));
      return { type: 'quadratic', a: aa, b: bb, c: cc, discriminant: 0, x, lhs, rhs };
    }
    if (d > 0) {
      const sd = Math.sqrt(d);
      return {
        type: 'quadratic', a: aa, b: bb, c: cc, discriminant: d,
        x1: snap((-bb + sd) / (2 * aa)),
        x2: snap((-bb - sd) / (2 * aa)),
        lhs, rhs
      };
    }
    return {
      type: 'quadratic', a: aa, b: bb, c: cc, discriminant: d,
      complex: true, lhs, rhs
    };
  }

  // ── Statistics (v55) ─────────────────────────────────────

  function parseNumberList(input) {
    const s = String(input || '').toLowerCase();
    // Strip leading verbs/connectors.
    let t = s.replace(/^(mean|median|mode|average|stats|stats for|summary|summarize|stddev|stdev|variance|sum|range)\s*(of|for)?\s*/, '');
    t = t.replace(/[,;]/g, ' ').replace(/\band\b/g, ' ');
    const nums = (t.match(/-?\d+(?:\.\d+)?/g) || []).map(parseFloat);
    if (!nums.length) return null;
    return nums;
  }

  function summarize(nums) {
    if (!nums || !nums.length) return null;
    const n = nums.length;
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const sorted = [...nums].sort((a, b) => a - b);
    const min = sorted[0], max = sorted[n - 1];
    const median = n % 2
      ? sorted[(n - 1) / 2]
      : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    // Mode: most frequent; null if all unique.
    const freq = {};
    for (const v of nums) freq[v] = (freq[v] || 0) + 1;
    let mode = null, maxFreq = 1;
    for (const [v, f] of Object.entries(freq)) {
      if (f > maxFreq) { mode = parseFloat(v); maxFreq = f; }
    }
    // Welford one-pass variance (population vs sample — use sample).
    let M = 0, S = 0, k = 0;
    for (const v of nums) {
      k++;
      const oldM = M;
      M += (v - M) / k;
      S += (v - oldM) * (v - M);
    }
    const variance = n > 1 ? S / (n - 1) : 0;
    const stdev = Math.sqrt(variance);
    return { n, sum, mean, median, mode, min, max, range: max - min, variance, stdev };
  }

  // ── Number theory (v55) ──────────────────────────────────

  function gcd(a, b) {
    a = Math.abs(a | 0); b = Math.abs(b | 0);
    while (b) { [a, b] = [b, a % b]; }
    return a;
  }

  function lcm(a, b) {
    if (!a || !b) return 0;
    return Math.abs(a * b) / gcd(a, b);
  }

  function primeFactor(n) {
    n = Math.abs(n | 0);
    if (n < 2) return [];
    const out = [];
    for (let p = 2; p * p <= n; p++) {
      while (n % p === 0) { out.push(p); n = n / p; }
    }
    if (n > 1) out.push(n);
    return out;
  }

  // BigInt modular exponentiation for Miller-Rabin.
  function _modPow(base, exp, mod) {
    let result = 1n;
    base = base % mod;
    while (exp > 0n) {
      if (exp & 1n) result = (result * base) % mod;
      exp >>= 1n;
      base = (base * base) % mod;
    }
    return result;
  }

  function isPrime(n) {
    n = Math.abs(n | 0);
    if (n < 2) return false;
    // Small primes
    const SMALL = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];
    for (const p of SMALL) {
      if (n === p) return true;
      if (n % p === 0) return false;
    }
    // Trial division up to 1e4 (cheap)
    for (let i = 41; i * i <= n && i < 100000; i += 2) {
      if (n % i === 0) return false;
    }
    if (n < 100000 * 100000) return true;
    // Miller-Rabin with deterministic witnesses for n < 3.3e14.
    const nB = BigInt(n);
    let d = nB - 1n, r = 0n;
    while ((d & 1n) === 0n) { d >>= 1n; r++; }
    outer: for (const a of SMALL) {
      const aB = BigInt(a);
      if (aB >= nB) continue;
      let x = _modPow(aB, d, nB);
      if (x === 1n || x === nB - 1n) continue;
      for (let i = 0n; i < r - 1n; i++) {
        x = (x * x) % nB;
        if (x === nB - 1n) continue outer;
      }
      return false;
    }
    return true;
  }

  function choose(n, k) {
    n = n | 0; k = k | 0;
    if (k < 0 || k > n) return 0;
    if (k > n - k) k = n - k;
    let r = 1;
    for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return Math.round(r);
  }

  function permute(n, k) {
    n = n | 0; k = k | 0;
    if (k < 0 || k > n) return 0;
    let r = 1;
    for (let i = 0; i < k; i++) r *= (n - i);
    return r;
  }

  // ── Finance (v55) ────────────────────────────────────────

  function tip(amount, pct, split) {
    split = split || 1;
    const t = amount * pct / 100;
    const total = amount + t;
    return { tip: t, total, perPerson: total / split, split };
  }

  function discount(price, pct) {
    const savings = price * pct / 100;
    return { original: price, savings, final: price - savings };
  }

  function percentChange(oldVal, newVal) {
    if (oldVal === 0) return null;
    return ((newVal - oldVal) / Math.abs(oldVal)) * 100;
  }

  // ── Adult-tier: polynomial calculus (v55) ────────────────
  //
  // parsePoly("3x^2 + 2x + 5") → { 0: 5, 1: 2, 2: 3 }   (power → coef)
  // formatPoly inverses it. polyDerivative / polyIntegral apply the
  // power rule. Only single-variable polynomials with integer powers.

  function parsePoly(input) {
    let s = String(input || '').toLowerCase().replace(/\s+/g, '');
    s = s.replace(/-/g, '+-');
    if (s.startsWith('+')) s = s.slice(1);
    if (!s) return null;
    const terms = s.split('+').filter(t => t.length);
    const out = {};
    for (const term of terms) {
      const m = term.match(/^(-?\d*\.?\d*)(x(?:\^(-?\d+))?)?$/);
      if (!m) return null;
      let coefStr = m[1], hasX = !!m[2], powStr = m[3];
      const power = powStr != null ? parseInt(powStr, 10) : (hasX ? 1 : 0);
      let coef;
      if (hasX) {
        if (coefStr === '' || coefStr === '+') coef = 1;
        else if (coefStr === '-') coef = -1;
        else coef = parseFloat(coefStr);
      } else {
        if (coefStr === '' || coefStr === '+' || coefStr === '-') return null;
        coef = parseFloat(coefStr);
      }
      if (!isFinite(coef)) return null;
      out[power] = (out[power] || 0) + coef;
    }
    return out;
  }

  function formatPoly(coefs) {
    const powers = Object.keys(coefs).map(Number)
                         .filter(p => Math.abs(coefs[p]) > 1e-12)
                         .sort((a, b) => b - a);
    if (!powers.length) return '0';
    const parts = [];
    for (const p of powers) {
      const c = coefs[p];
      const neg = c < 0;
      const cabs = Math.abs(c);
      let cstr;
      if (p === 0) cstr = String(cabs);
      else if (cabs === 1) cstr = '';
      else cstr = String(cabs);
      const v = p === 0 ? '' : p === 1 ? 'x' : 'x^' + p;
      const sign = parts.length === 0 ? (neg ? '-' : '') : (neg ? ' - ' : ' + ');
      parts.push(sign + cstr + v);
    }
    return parts.join('');
  }

  function polyDerivative(input) {
    const coefs = parsePoly(input);
    if (!coefs) return null;
    const out = {};
    for (const [pStr, c] of Object.entries(coefs)) {
      const p = parseInt(pStr, 10);
      if (p === 0) continue;
      out[p - 1] = c * p;
    }
    return { coefs: out, text: formatPoly(out), original: coefs, originalText: formatPoly(coefs) };
  }

  function polyIntegral(input, a, b) {
    const coefs = parsePoly(input);
    if (!coefs) return null;
    const out = {};
    for (const [pStr, c] of Object.entries(coefs)) {
      const p = parseInt(pStr, 10);
      out[p + 1] = c / (p + 1);
    }
    const indefText = formatPoly(out) + ' + C';
    if (a == null || b == null) {
      return { coefs: out, text: indefText, original: coefs, originalText: formatPoly(coefs) };
    }
    // Definite: evaluate at b minus at a.
    const evalPoly = (cs, x) => Object.entries(cs).reduce(
      (s, [p, c]) => s + c * Math.pow(x, parseInt(p, 10)), 0);
    const definite = evalPoly(out, b) - evalPoly(out, a);
    return { coefs: out, text: indefText, definite, a, b,
             original: coefs, originalText: formatPoly(coefs) };
  }

  // ── Adult-tier: 2×2 matrix ops (v55) ─────────────────────

  const Matrix2 = {
    det(A) { return A[0][0] * A[1][1] - A[0][1] * A[1][0]; },
    inverse(A) {
      const d = Matrix2.det(A);
      if (Math.abs(d) < 1e-12) return null;
      return [
        [ A[1][1] / d, -A[0][1] / d],
        [-A[1][0] / d,  A[0][0] / d]
      ];
    },
    multiply(A, B) {
      return [
        [A[0][0]*B[0][0] + A[0][1]*B[1][0], A[0][0]*B[0][1] + A[0][1]*B[1][1]],
        [A[1][0]*B[0][0] + A[1][1]*B[1][0], A[1][0]*B[0][1] + A[1][1]*B[1][1]]
      ];
    },
    add(A, B) {
      return [
        [A[0][0]+B[0][0], A[0][1]+B[0][1]],
        [A[1][0]+B[1][0], A[1][1]+B[1][1]]
      ];
    }
  };

  // ── Adult-tier: 2-var linear system (v55) ────────────────
  //
  // Solve { a1*x + b1*y = c1 ; a2*x + b2*y = c2 } via Cramer's rule.
  // Returns { x, y } or null if singular.

  function solveLinearSystem2(a1, b1, c1, a2, b2, c2) {
    const d  = a1 * b2 - a2 * b1;
    if (Math.abs(d) < 1e-12) {
      // Check consistency: parallel lines either coincident or never meet.
      const dx = c1 * b2 - c2 * b1;
      const dy = a1 * c2 - a2 * c1;
      if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) {
        return { type: 'identity', text: 'Infinitely many solutions — same line.' };
      }
      return { type: 'inconsistent', text: 'No solution — parallel lines.' };
    }
    const dx = c1 * b2 - c2 * b1;
    const dy = a1 * c2 - a2 * c1;
    return { type: 'unique', x: dx / d, y: dy / d };
  }

  return {
    evaluateExpression, looksLikeMath, convertUnit, formatNumber, parseConversion,
    solveEquation,
    parseNumberList, summarize,
    gcd, lcm, primeFactor, isPrime, choose, permute,
    tip, discount, percentChange,
    parsePoly, formatPoly, polyDerivative, polyIntegral,
    Matrix2, solveLinearSystem2
  };
})();

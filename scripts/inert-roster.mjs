/**
 * @summary Read an identity roster as DATA, without executing a single byte of it.
 *
 * A guard runs against an untrusted PR's working tree. An earlier version of this reader did
 * `await import()` on the consumer's `ai/graph/identityRoots.mjs`, which executes that PR's code
 * inside CI — under a token the calling workflow had not restricted. A contributor could have put
 * anything in that module and CI would have run it. @neo-gpt blocked on it, correctly; I had flagged
 * the same concern myself one round earlier and shipped it anyway.
 *
 * Two regex parsers preceded that import and both failed *green*, so "just parse it" is not a free
 * answer either — the roster nests its fields under `properties`, and field order varies. The boundary
 * below is the third approach and the first that is both correct and inert:
 *
 * 1. extract the `IDENTITIES` array literal by balanced scan, string- and comment-aware;
 * 2. **refuse** the literal outright if it carries any token that could compute — no calls, arrows,
 *    `function`/`class`/`new`, getters, template substitutions;
 * 3. normalize the surviving data-only literal to JSON and `JSON.parse` it.
 *
 * Step 2 is the security property and step 3 is the correctness one. `JSON.parse` cannot execute,
 * and a literal that refuses to become JSON is reported rather than coerced — a roster this reader
 * cannot prove inert is a RED finding, never a silent skip.
 */

const
    // Tokens that make a literal computable rather than declarative. Presence of any is a refusal.
    DANGEROUS = [
        {pattern: /=>/,                   name: 'arrow function'},
        {pattern: /\bfunction\b/,         name: '`function`'},
        {pattern: /\bclass\b/,            name: '`class`'},
        {pattern: /\bnew\s+[A-Za-z_$]/,   name: '`new`'},
        {pattern: /\b(?:get|set)\s+[A-Za-z_$"'[]/, name: 'accessor (get/set)'},
        {pattern: /\$\{/,                 name: 'template substitution'},
        {pattern: /[A-Za-z_$)\]]\s*\(/,   name: 'call expression'},
        {pattern: /\.\.\./,               name: 'spread'}
    ];

/**
 * @summary Strip comments and normalize quoting/keys, respecting string boundaries.
 * @param {String} src
 * @returns {String}
 * @private
 */
function toJson(src) {
    let out = '', i = 0;

    while (i < src.length) {
        const ch = src[i];

        // ── string literals pass through verbatim (re-quoted to double) ────────────────────────
        if (ch === '"' || ch === "'") {
            const quote = ch;
            let body = '';

            i++;

            while (i < src.length && src[i] !== quote) {
                if (src[i] === '\\') { body += src[i] + src[i + 1]; i += 2; continue }
                body += src[i++]
            }

            i++; // closing quote
            out += JSON.stringify(body.replace(/\\'/g, "'"));
            continue
        }

        if (ch === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
        if (ch === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue }

        out += ch;
        i++
    }

    return out
        // bare object keys → quoted
        .replace(/([{,[]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3')
        // Identifier REFERENCES in value position → null. The real roster cites module constants
        // (`trustTier: TRUST_TIERS.OWNER`), so refusing them outright would make this reader
        // permanently red on the one repository that has a roster. Substituting `null` keeps the
        // structure intact, discards a value this check does not read, and stays inert by
        // construction: the identifier is replaced as TEXT and never resolved. `true`/`false`/`null`
        // are preserved because they are data.
        .replace(/(:\s*)(?!true\b|false\b|null\b)([A-Za-z_$][\w$]*(?:\.[\w$]+)*)(?=\s*[,}\]])/g, '$1null')
        .replace(/([[,]\s*)(?!true\b|false\b|null\b)([A-Za-z_$][\w$]*(?:\.[\w$]+)*)(?=\s*[,\]])/g, '$1null')
        // trailing commas
        .replace(/,(\s*[}\]])/g, '$1')
}

/**
 * @summary Extract the `IDENTITIES` array literal by balanced scan.
 * @param {String} source
 * @returns {String|null}
 * @private
 */
function extractLiteral(source) {
    const start = source.search(/export\s+const\s+IDENTITIES\s*=\s*\[/);

    if (start === -1) return null;

    const open = source.indexOf('[', start);
    let depth = 0, i = open;

    while (i < source.length) {
        const ch = source[i];

        if (ch === '"' || ch === "'") {
            const quote = ch;

            i++;
            while (i < source.length && source[i] !== quote) i += source[i] === '\\' ? 2 : 1;
            i++;
            continue
        }

        if (ch === '/' && source[i + 1] === '/') { while (i < source.length && source[i] !== '\n') i++; continue }
        if (ch === '/' && source[i + 1] === '*') { i += 2; while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++; i += 2; continue }

        if (ch === '[') depth++;
        if (ch === ']') { depth--; if (depth === 0) return source.slice(open, i + 1) }

        i++
    }

    return null
}

/**
 * @summary Parse a roster module's IDENTITIES as inert data.
 * @param {String} source  the module's text — never imported, never evaluated
 * @returns {{identities: Object[]}|{error: String}}
 */
export function readInertRoster(source) {
    const literal = extractLiteral(source);

    if (!literal) return {error: 'roster exports no IDENTITIES array literal; its contract changed shape.'};

    // Comments are stripped before the danger scan so a token quoted inside prose does not trip it,
    // while a real one outside a string still does.
    const scannable = toJson(literal);

    for (const {pattern, name} of DANGEROUS) {
        if (pattern.test(scannable.replace(/"(?:[^"\\]|\\.)*"/g, '""'))) {
            return {error:
                `roster is not inert data — it contains ${name}. This reader refuses to evaluate it. ` +
                `A roster that must compute cannot be read safely from CI, where it arrives as ` +
                `untrusted PR content.`}
        }
    }

    try {
        const parsed = JSON.parse(scannable);

        return Array.isArray(parsed)
            ? {identities: parsed}
            : {error: 'roster IDENTITIES did not parse to an array.'}
    } catch (err) {
        return {error: `roster IDENTITIES is not representable as data (${err.message}). Refusing rather than evaluating.`}
    }
}

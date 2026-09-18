#!/usr/bin/env node
/**
 * @summary Fails an npm `overrides` rule that no longer does anything, or that now forces a downgrade.
 *
 * An override is a floor: it stops a dependent whose declared range still admits a vulnerable version
 * from resolving beneath the patched one. Dependabot neither bumps nor removes `overrides`, so
 * nothing notices when every dependent has caught up — or when one moves to a new major and the stale
 * rule starts forcing it back onto the old one.
 *
 * Everything the verdict needs is in `package.json` (the rules) and `package-lock.json` (the range
 * every installed package DECLARES), so there is no network and no registry. The verdict can change
 * only in a pull request that changes one of those two files, which is why the check may run on every
 * pull request: upstream releases cannot redden one that touches neither.
 */

import {readFileSync, realpathSync} from 'node:fs';
import {resolve}                    from 'node:path';
import process                      from 'node:process';
import {parseArgs}                  from 'node:util';
import {fileURLToPath}              from 'node:url';
import semver                       from 'semver';

/**
 * The lock fields whose ranges an override stands in for. `devDependencies` count only on the root
 * entry: npm installs no other package's development dependencies.
 * @member {String[]} EDGE_FIELDS
 */
export const EDGE_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies'];

/**
 * The fields a subtree is walked through. A peer is provided by its dependent's context rather than
 * installed beneath it, so it widens no subtree.
 * @member {String[]} WALK_FIELDS
 */
export const WALK_FIELDS = ['dependencies', 'optionalDependencies'];

/**
 * @summary Splits an override key into its package name and optional version selector.
 *
 * `@scope/name@^2` is name `@scope/name` with selector `^2`: the separating `@` is the last one past
 * the scope's leading `@`.
 * @param {String} key
 * @returns {{name: String, selector: (String|null)}}
 */
export function parseKey(key) {
    const at = key.lastIndexOf('@');

    return at > 0 ? {name: key.slice(0, at), selector: key.slice(at + 1)} : {name: key, selector: null}
}

/**
 * @summary Flattens `overrides` into one rule per overridden package.
 *
 * A string value overrides its key wherever the enclosing object applies. An object value scopes its
 * keys to that package's subtree, and its `"."` key overrides the package itself. `$name` borrows the
 * root manifest's own spec for `name`, as npm does.
 * @param {Object} overrides The manifest's `overrides` object, or one nested level of it.
 * @param {Object} manifest  The root `package.json`, for `$name` references.
 * @param {Object[]} [scope] Enclosing `{name, selector}` keys, outermost first.
 * @returns {Object[]} `{label, scope, target, selector, range}` per rule, with `error` in place of
 *                     `range` when the value cannot be read as a semver range.
 */
export function collectRules(overrides, manifest, scope = []) {
    const rules = [];

    for (const [key, value] of Object.entries(overrides)) {
        if (value && typeof value === 'object') {
            const own = parseKey(key);

            '.' in value && rules.push(makeRule(scope, own, value['.'], manifest));

            rules.push(...collectRules(
                Object.fromEntries(Object.entries(value).filter(([nested]) => nested !== '.')),
                manifest,
                [...scope, own]
            ));
            continue
        }

        rules.push(makeRule(scope, parseKey(key), value, manifest))
    }

    return rules
}

/**
 * @summary Builds one rule, resolving a `$name` reference against the root manifest.
 * @param {Object[]} scope
 * @param {{name: String, selector: (String|null)}} target
 * @param {*} value
 * @param {Object} manifest
 * @returns {Object}
 */
function makeRule(scope, target, value, manifest) {
    const rule = {
        label   : `${[...scope.map(({name}) => name), target.name].join(' > ')} ${value}`,
        scope,
        selector: target.selector,
        target  : target.name
    };

    let range = value;

    if (typeof value === 'string' && value.startsWith('$')) {
        const ref = value.slice(1);

        range = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
            .map(field => manifest[field]?.[ref])
            .find(Boolean);

        if (!range) {
            return {...rule, error: `references $${ref}, which the root manifest does not declare`}
        }
    }

    if (typeof range !== 'string' || !semver.validRange(range)) {
        return {...rule, error: `\`${range}\` is not a semver range, so it has no floor to judge`}
    }

    // Parses, yet admits nothing: a typo'd raise such as `>=3.15.2 <3.0.0` lands here.
    if (!semver.minVersion(range)) {
        return {...rule, error: `\`${range}\` matches no version, so it has no floor to judge`}
    }

    return {...rule, range}
}

/**
 * @summary The package name a lock location installs.
 * @param {String} location e.g. `node_modules/a/node_modules/@s/b`
 * @param {Object} entry
 * @returns {String}
 */
export function nameOf(location, entry) {
    return entry.name ?? location.slice(location.lastIndexOf('node_modules/') + 'node_modules/'.length)
}

/**
 * @summary Resolves a dependency the way node does: the dependent's own `node_modules` first, then
 * each enclosing one up to the root.
 * @param {Object} packages The lock's `packages` map.
 * @param {String} from     The dependent's location, `''` for the root.
 * @param {String} name
 * @returns {(String|null)} The installed location, or null when nothing provides it.
 */
export function resolveLocation(packages, from, name) {
    let base = from;

    for (;;) {
        const candidate = base ? `${base}/node_modules/${name}` : `node_modules/${name}`;

        if (packages[candidate]) {
            return packages[candidate].link ? packages[candidate].resolved : candidate
        }

        if (!base) {
            return null
        }

        const cut = base.lastIndexOf('/node_modules/');

        base = cut === -1 ? '' : base.slice(0, cut)
    }
}

/**
 * @summary Every location in the dependency subtrees rooted at `starts`, the roots included.
 *
 * Walked through resolution rather than read off location prefixes: a hoisted dependency of `a`
 * lives at `node_modules/x`, not under `node_modules/a/`, and it is still inside `a`'s subtree.
 * @param {Object} packages
 * @param {String[]} starts
 * @returns {Set<String>}
 */
export function subtreeOf(packages, starts) {
    const
        seen  = new Set(starts),
        queue = [...starts];

    while (queue.length) {
        const location = queue.shift();

        for (const field of WALK_FIELDS) {
            for (const name of Object.keys(packages[location]?.[field] ?? {})) {
                const next = resolveLocation(packages, location, name);

                if (next !== null && !seen.has(next)) {
                    seen.add(next);
                    queue.push(next)
                }
            }
        }
    }

    return seen
}

/**
 * @summary The installed locations a rule's scope chain reaches.
 *
 * An empty chain is the whole tree, root included. Each link narrows to that package's instances
 * inside the previous link's subtree, filtered by its version selector.
 * @param {Object} packages
 * @param {Object[]} scope
 * @returns {Set<String>}
 */
export function scopeLocations(packages, scope) {
    let region = new Set(Object.keys(packages));

    for (const {name, selector} of scope) {
        const instances = [...region].filter(location => location !== '' &&
            nameOf(location, packages[location]) === name &&
            (!selector || semver.satisfies(packages[location].version ?? '', selector)));

        region = subtreeOf(packages, instances)
    }

    return region
}

/**
 * @summary Classifies one rule against the ranges its scope declares for the overridden package.
 *
 * - `FIGHTING`: some declared range starts above every version the override permits, so the rule
 *   forces that dependent BELOW what it requires.
 * - `needed`: some declared range still admits a version under the override's floor, or is
 *   incomparable — not a semver range, or one matching nothing — which the override replaces outright.
 * - `REDUNDANT`: nothing in scope can resolve below the floor, or nothing in scope declares it.
 *
 * Above an exact pin is the deliberate security direction (`dompurify: "3.4.8"` held at `^3.4.13`),
 * so it reads `needed`, never `FIGHTING`.
 * @param {Object} rule
 * @param {Object} packages
 * @returns {{verdict: String, below: Object[], incomparable: Object[], fighting: Object[], edges: Number}}
 */
export function classify(rule, packages) {
    const
        floor        = semver.minVersion(rule.range),
        below        = [],
        incomparable = [],
        fighting     = [];

    let edges = 0;

    for (const location of scopeLocations(packages, rule.scope)) {
        const
            entry  = packages[location],
            fields = location === '' ? [...EDGE_FIELDS, 'devDependencies'] : EDGE_FIELDS;

        for (const field of fields) {
            const declared = entry[field]?.[rule.target];

            if (!declared || (rule.selector && semver.validRange(declared) && !semver.intersects(declared, rule.selector))) {
                continue
            }

            edges++;

            const
                dependent = location === '' ? '(root)' : `${nameOf(location, entry)}@${entry.version}`,
                edge      = {declared, dependent};

            const lowest = semver.validRange(declared) && semver.minVersion(declared);

            if (!lowest) {
                incomparable.push(edge)
            } else if (semver.gtr(lowest, rule.range)) {
                fighting.push(edge)
            } else if (semver.lt(lowest, floor)) {
                below.push(edge)
            }
        }
    }

    return {
        below, edges, fighting, incomparable,
        verdict: fighting.length ? 'FIGHTING' : below.length || incomparable.length ? 'needed' : 'REDUNDANT'
    }
}

/**
 * @summary Reads a JSON file under `root`, telling absence apart from an unreadable observation.
 * @param {String} root
 * @param {String} file
 * @returns {{json?: Object, missing?: Boolean, error?: String}}
 */
function readJson(root, file) {
    try {
        return {json: JSON.parse(readFileSync(resolve(root, file), 'utf8'))}
    } catch (cause) {
        return cause.code === 'ENOENT' ? {missing: true} : {error: `${file}: ${cause.message}`}
    }
}

/**
 * @summary Classifies every override in the tree at `root`.
 * @param {Object} [options]
 * @param {String} [options.root=process.cwd()]
 * @returns {{rules: Object[], errors: String[]}} `rules` carry their classification.
 */
export function collectReport({root = process.cwd()} = {}) {
    const manifest = readJson(root, 'package.json');

    // A missing manifest is a wrong root, not an empty consumer: every repository calling this has one.
    if (!manifest.json) {
        return {errors: [manifest.error ?? `no package.json at ${root} — refusing to report a pass on a wrong root`], rules: []}
    }

    const overrides = manifest.json.overrides;

    if (!overrides || Object.keys(overrides).length === 0) {
        return {errors: [], rules: []}
    }

    const lock = readJson(root, 'package-lock.json');

    if (!lock.json) {
        return {errors: [lock.error ?? 'package.json declares overrides but there is no package-lock.json to judge them against'], rules: []}
    }

    const packages = lock.json.packages;

    if (!packages) {
        return {errors: [`package-lock.json v${lock.json.lockfileVersion} has no \`packages\` map; lockfile v2 or v3 is required`], rules: []}
    }

    const
        rules  = collectRules(overrides, manifest.json),
        errors = rules.filter(rule => rule.error).map(rule => `${rule.label}: ${rule.error}`);

    return {
        errors,
        rules: rules.filter(rule => !rule.error).map(rule => ({...rule, ...classify(rule, packages)}))
    }
}

/** @summary Prints the CLI contract. */
function printHelp(out) {
    out([
        'Usage: neo-agent-skills-npm-overrides [--root <dir>]',
        '',
        'Classifies every npm `overrides` rule against the ranges the lockfile says its dependents',
        'declare. No network: package.json and package-lock.json are the whole input.',
        '',
        '  needed     a dependent in scope still admits a version below the floor',
        '  REDUNDANT  nothing in scope can resolve below the floor — delete the rule',
        '  FIGHTING   the rule forces a dependent below what it requires — delete or raise it, or',
        '             narrow it when another dependent still needs the floor',
        '',
        '  --root, -r   Tree to read. Defaults to the current working directory.',
        '  --help,  -h  Print this help.',
        '',
        'Exit codes: 0 every rule needed (or no overrides), 1 a REDUNDANT or FIGHTING rule, or an',
        'input that cannot be read, 2 CLI misuse.'
    ].join('\n'))
}

/**
 * @summary Formats one dependent edge.
 * @param {{dependent: String, declared: String}} edge
 * @returns {String}
 */
const describe = ({dependent, declared}) => `${dependent} declares ${declared}`;

/**
 * @summary Reports every rule and returns the process exit code.
 * @param {String[]} [argv]
 * @param {{cwd?: String, out?: Function, error?: Function}} [io]
 * @returns {Number} Process exit code.
 */
export function run(argv = process.argv.slice(2), {cwd = process.cwd(), out = console.log, error = console.error} = {}) {
    let parsed;

    try {
        parsed = parseArgs({
            args            : argv,
            allowPositionals: false,
            strict          : true,
            options         : {
                help: {type: 'boolean', short: 'h', default: false},
                root: {type: 'string',  short: 'r'}
            }
        })
    } catch (cause) {
        error(`check-npm-overrides: ${cause.message}`);
        return 2
    }

    if (parsed.values.help) {
        printHelp(out);
        return 0
    }

    const {errors, rules} = collectReport({root: resolve(cwd, parsed.values.root ?? '.')});

    rules.forEach(({label, verdict, below, incomparable, fighting, edges}) => {
        // A spec that is not a comparable range is replaced by the rule, not "below" its floor.
        const holding = [
            below.length        && `below the floor: ${below.map(describe).join(', ')}`,
            incomparable.length && `replaced outright, no comparable range: ${incomparable.map(describe).join(', ')}`
        ].filter(Boolean).join('; ');

        if (verdict === 'needed') {
            out(`✅ ${label} · needed — ${holding}`)
        } else if (verdict === 'FIGHTING') {
            // Deleting a rule that another dependent still needs trades one defect for another.
            error(`❌ ${label} · FIGHTING — forces a dependent below its own range: ${fighting.map(describe).join(', ')}. ` +
                (holding ? `Other dependents still need it (${holding}), so narrow the rule to them.` : 'Delete or raise the rule.'))
        } else {
            error(`❌ ${label} · REDUNDANT — ${edges ? `all ${edges} dependent range(s) in scope start at or above its floor` : 'nothing in scope declares it'}. Delete the rule.`)
        }
    });

    errors.forEach(message => error(`check-npm-overrides: ${message}`));

    const stale = rules.filter(rule => rule.verdict !== 'needed');

    if (errors.length || stale.length) {
        stale.length && error(`check-npm-overrides: ${stale.length} of ${rules.length} override(s) no longer hold a floor. Dependabot never removes one; this check is what notices.`);
        return 1
    }

    out(rules.length
        ? `check-npm-overrides: ${rules.length} override(s), each still holding a floor a dependent needs.`
        : 'check-npm-overrides: no overrides in package.json — N/A, nothing to judge.');

    return 0
}

// Canonicalized on BOTH sides, as in check-substrate-size.mjs: a package `bin` is a symlink, and
// under `--preserve-symlinks-main` import.meta.url keeps the link path, so comparing either side
// unresolved lets the module load, skip `run()`, and exit 0 with nothing judged.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    process.exitCode = run()
}

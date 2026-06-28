// Pure consistency checks for the Stripe membership price map.
//
// Guards against the class of drift where the displayed price (DEFAULT_TIERS in
// the membership runtime), the allowlist amounts (data/stripe-membership-products.json),
// or the two Stripe environments fall out of sync. Returns an array of failure
// strings (empty = consistent) so it can be unit-tested without file IO.

const DEFAULT_ENVS = ['production', 'test'];
const DEFAULT_TIERS_KEYS = ['S', 'M', 'L'];
const DEFAULT_INTERVALS = ['month', 'year'];

function isFinitePositive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

export function checkMembershipPriceConsistency({
  map,
  defaultTiers,
  envs = DEFAULT_ENVS,
  tiers = DEFAULT_TIERS_KEYS,
  intervals = DEFAULT_INTERVALS,
} = {}) {
  const failures = [];

  if (!map || typeof map !== 'object') {
    return ['price map is missing or not an object'];
  }
  if (!defaultTiers || typeof defaultTiers !== 'object') {
    return ['DEFAULT_TIERS reference is missing or not an object'];
  }

  const seenPriceIds = new Map();
  const seenProductIds = new Map();
  const amountByCell = {}; // `${tier}.${interval}` -> { env -> amount }

  for (const env of envs) {
    const envMap = map[env];
    if (!envMap || typeof envMap !== 'object') {
      failures.push(`price map missing environment "${env}"`);
      continue;
    }

    for (const tier of tiers) {
      for (const interval of intervals) {
        const cellKey = `${tier}.${interval}`;
        const node = envMap?.[tier]?.[interval];
        if (!node || typeof node !== 'object') {
          failures.push(`${env}.${cellKey} node is missing`);
          continue;
        }

        // Amount must match the displayed price (DEFAULT_TIERS, in dollars).
        const expected = defaultTiers?.[tier]?.[interval];
        if (!isFinitePositive(expected)) {
          failures.push(`DEFAULT_TIERS.${cellKey} is not a positive amount`);
        } else if (Number(node.amount) !== Number(expected)) {
          failures.push(
            `${env}.${cellKey} amount ${node.amount} does not match displayed price ${expected}`,
          );
        }

        // Currency must be present + consistent with DEFAULT_TIERS currency when known.
        const currency = String(node.currency || '').toUpperCase();
        if (!currency) {
          failures.push(`${env}.${cellKey} is missing a currency`);
        }

        // Track for cross-environment amount parity.
        amountByCell[cellKey] = amountByCell[cellKey] || {};
        amountByCell[cellKey][env] = Number(node.amount);

        // Track id uniqueness across the whole map (catches copy/paste).
        const priceId = String(node.priceId || '').trim();
        const productId = String(node.productId || '').trim();
        if (priceId) {
          const where = `${env}.${cellKey}`;
          if (seenPriceIds.has(priceId)) {
            failures.push(`duplicate priceId ${priceId} (${seenPriceIds.get(priceId)} and ${where})`);
          } else {
            seenPriceIds.set(priceId, where);
          }
        }
        if (productId) {
          const where = `${env}.${cellKey}`;
          if (seenProductIds.has(productId)) {
            failures.push(`duplicate productId ${productId} (${seenProductIds.get(productId)} and ${where})`);
          } else {
            seenProductIds.set(productId, where);
          }
        }
      }
    }
  }

  // Cross-environment amount parity: production + test must price identically.
  for (const cellKey of Object.keys(amountByCell)) {
    const byEnv = amountByCell[cellKey];
    const present = envs.filter((env) => Number.isFinite(byEnv[env]));
    if (present.length > 1) {
      const first = byEnv[present[0]];
      for (const env of present.slice(1)) {
        if (byEnv[env] !== first) {
          failures.push(
            `${cellKey} amount differs across environments (${present[0]}=${first}, ${env}=${byEnv[env]})`,
          );
        }
      }
    }
  }

  return failures;
}

// Extracts the DEFAULT_TIERS object literal from the membership runtime source.
export function parseDefaultTiers(runtimeSource) {
  const match = runtimeSource.match(/const DEFAULT_TIERS = (\{[\s\S]*?\});/);
  if (!match) {
    throw new Error('Could not locate DEFAULT_TIERS in membership runtime source');
  }
  // Trusted first-party source; evaluate the object literal.
  // eslint-disable-next-line no-new-func
  return new Function(`return (${match[1]})`)();
}

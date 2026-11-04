/**
 * US state slug-token map — postal codes AND full names → lowercase code.
 *
 * Emitters slug the raw stored state, which may be either form, so both
 * spellings must map to the same code. Shared by the city-shelf slug parser
 * and the seed slug-variant resolver; keep it free of route/service imports.
 */

export const US_STATE_SLUG_TOKENS: Record<string, string> = {
  al: 'al', alabama: 'al', ak: 'ak', alaska: 'ak', az: 'az', arizona: 'az',
  ar: 'ar', arkansas: 'ar', ca: 'ca', california: 'ca', co: 'co', colorado: 'co',
  ct: 'ct', connecticut: 'ct', de: 'de', delaware: 'de', dc: 'dc',
  fl: 'fl', florida: 'fl', ga: 'ga', georgia: 'ga', hi: 'hi', hawaii: 'hi',
  id: 'id', idaho: 'id', il: 'il', illinois: 'il', in: 'in', indiana: 'in',
  ia: 'ia', iowa: 'ia', ks: 'ks', kansas: 'ks', ky: 'ky', kentucky: 'ky',
  la: 'la', louisiana: 'la', me: 'me', maine: 'me', md: 'md', maryland: 'md',
  ma: 'ma', massachusetts: 'ma', mi: 'mi', michigan: 'mi', mn: 'mn', minnesota: 'mn',
  ms: 'ms', mississippi: 'ms', mo: 'mo', missouri: 'mo', mt: 'mt', montana: 'mt',
  ne: 'ne', nebraska: 'ne', nv: 'nv', nevada: 'nv', nh: 'nh', 'new hampshire': 'nh',
  nj: 'nj', 'new jersey': 'nj', nm: 'nm', 'new mexico': 'nm', ny: 'ny', 'new york': 'ny',
  nc: 'nc', 'north carolina': 'nc', nd: 'nd', 'north dakota': 'nd', oh: 'oh', ohio: 'oh',
  ok: 'ok', oklahoma: 'ok', or: 'or', oregon: 'or', pa: 'pa', pennsylvania: 'pa',
  ri: 'ri', 'rhode island': 'ri', sc: 'sc', 'south carolina': 'sc', sd: 'sd', 'south dakota': 'sd',
  tn: 'tn', tennessee: 'tn', tx: 'tx', texas: 'tx', ut: 'ut', utah: 'ut',
  vt: 'vt', vermont: 'vt', va: 'va', virginia: 'va', wa: 'wa', washington: 'wa',
  wv: 'wv', 'west virginia': 'wv', wi: 'wi', wisconsin: 'wi', wy: 'wy', wyoming: 'wy',
};

/** Keys whose value is this code — 'in' → ['in', 'indiana']. Lazily built. */
let codeToKeys: Record<string, string[]> | null = null;

function stateCodeToKeys(): Record<string, string[]> {
  if (!codeToKeys) {
    codeToKeys = {};
    for (const [key, code] of Object.entries(US_STATE_SLUG_TOKENS)) {
      (codeToKeys[code] ??= []).push(key);
    }
  }
  return codeToKeys;
}

/**
 * Every slug token a stored state value can appear as: the stored form's own
 * tokens plus, when it resolves to a postal code, the code itself — or when it
 * IS a postal code, the full-name tokens too ('in' → {'in','indiana'},
 * 'West Virginia' → {'west','virginia','wv'}).
 */
export function expandStateSlugTokens(state: string | null | undefined): Set<string> {
  const tokens = new Set<string>();
  const spaced = (state ?? '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
  if (!spaced) return tokens;
  for (const t of spaced.split(' ')) if (t) tokens.add(t);

  const code = US_STATE_SLUG_TOKENS[spaced];
  if (code) tokens.add(code);
  // When the stored form is a bare code, add the full-name tokens too
  // ('in' → 'indiana'). A full name hits no keys here — only codes do.
  for (const key of stateCodeToKeys()[spaced] ?? []) {
    for (const t of key.split(' ')) if (t) tokens.add(t);
  }
  return tokens;
}

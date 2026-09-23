'use strict';

// Amazon Associate tag for affiliate links on public recipe pages. From
// PUBLIC_AMAZON_ASSOCIATE_TAG (Portainer stack env). Public by nature — it
// rides in every affiliate URL — so it is not a secret.

const AMAZON_TAG = (process.env.PUBLIC_AMAZON_ASSOCIATE_TAG || '').trim();

/** Append the Associate tag to an Amazon URL. No tag set → URL unchanged. */
function withTag(url) {
  if (!AMAZON_TAG || !url) return url || '';
  const [base, hash] = String(url).split('#');
  if (/[?&]tag=/.test(base)) return url;
  const sep = base.includes('?') ? '&' : '?';
  const tagged = `${base}${sep}tag=${AMAZON_TAG}`;
  return hash ? `${tagged}#${hash}` : tagged;
}

/** Build an Amazon search URL for an ingredient/tool, tagged. */
function amazonSearch(term) {
  return withTag(`https://www.amazon.com/s?k=${encodeURIComponent(term)}`);
}

module.exports = { AMAZON_TAG, withTag, amazonSearch };

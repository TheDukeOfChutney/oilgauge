export function mergeCollection(previousFeed, collectedOffers, errors, attemptedAt) {
  const successes = new Set(collectedOffers.map((offer) => offer.url));
  const failures = new Map(errors.map((error) => [error.url, error]));
  const retained = (previousFeed?.offers ?? [])
    .filter((offer) => failures.has(offer.url) && !successes.has(offer.url))
    .map((offer) => ({ ...offer, refreshStatus:"failed", lastAttemptAt:attemptedAt, lastError:failures.get(offer.url).error }));
  const fresh = collectedOffers.map((offer) => ({ ...offer, refreshStatus:"verified", lastAttemptAt:attemptedAt }));
  return {
    schemaVersion:2,
    generatedAt:attemptedAt,
    offers:[...fresh,...retained],
    errors,
    collection:{ attemptedAt, succeeded:fresh.length, failed:errors.length, retained:retained.length, status:errors.length===0?"success":fresh.length?"partial":"failed" },
  };
}

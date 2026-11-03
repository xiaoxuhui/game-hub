import {validateDynamicCatalog} from './dynamic-protocol.mjs';

export function validateSuccessor(previous, next) {
  if (!previous) {
    if (next.catalogSequence !== '1') throw new Error('Initial dynamic sequence must be 1; later issuance needs signed history');
    return next;
  }
  validateDynamicCatalog(previous, Date.parse(previous.issuedAt));
  if (next.releaseId !== previous.releaseId || BigInt(next.catalogSequence) <= BigInt(previous.catalogSequence)) throw new Error('Dynamic release identity or sequence rollback');
  for (const old of previous.games) {
    const game = next.games.find(value => value.id === old.id);
    if (!game || game.contentCode < old.contentCode) throw new Error('Dynamic cumulative identity or content rollback');
    if (game.contentCode === old.contentCode) {
      const identity = value => JSON.stringify(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'available').sort(([a], [b]) => a.localeCompare(b))));
      if (identity(game) !== identity(old)) throw new Error('Dynamic same-code metadata or archive reuse');
    }
  }
  return next;
}

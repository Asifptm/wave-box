/**
 * Tiny TTL LRU cache — O(1) get/set, bounded memory.
 */
class TtlLruCache {
  /**
   * @param {{ max?: number, ttlMs?: number }} [opts]
   */
  constructor(opts = {}) {
    this.max = opts.max ?? 64;
    this.ttlMs = opts.ttlMs ?? 60_000;
    /** @type {Map<string, { value: unknown, expires: number }>} */
    this.map = new Map();
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expires) {
      this.map.delete(key);
      return undefined;
    }
    // refresh LRU order
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }

  clear() {
    this.map.clear();
  }
}

module.exports = { TtlLruCache };

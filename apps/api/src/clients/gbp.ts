// Stub Google Business Profile (GBP) client for categories
// Replace with real Google APIs integration later.

export type GbpCategory = {
  id?: string | null;
  slug?: string | null;
  name: string;
};

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// In-memory per-tenant state to simulate GBP behavior across runs
const store = new Map<string, GbpCategory[]>();

function key(tenant_id: string | null) {
  return String(tenant_id ?? 'all');
}

function ensure(tenant_id: string | null) {
  const k = key(tenant_id);
  if (!store.has(k)) store.set(k, []);
  return store.get(k)!;
}

function idgen() {
  return 'gbp_' + Math.random().toString(36).slice(2, 10);
}

export const gbpClient = {
  async listCategories(tenant_id: string | null): Promise<GbpCategory[]> {
    await delay(20);
    const arr = ensure(tenant_id);
    // return shallow copy
    return arr.map(c => ({ id: c.id ?? null, slug: c.slug ?? null, name: c.name }));
  },

  async createCategory(tenant_id: string | null, cat: GbpCategory): Promise<void> {
    await delay(15);
    const arr = ensure(tenant_id);
    const slug = String(cat.slug ?? cat.name).toLowerCase();
    const exists = arr.find(c => String(c.slug ?? c.name).toLowerCase() === slug);
    if (!exists) {
      arr.push({ id: idgen(), slug: cat.slug ?? null, name: cat.name });
    }
  },

  async updateCategory(tenant_id: string | null, from: GbpCategory, to: GbpCategory): Promise<void> {
    await delay(15);
    const arr = ensure(tenant_id);
    const fromSlug = String(from.slug ?? from.name).toLowerCase();
    const idx = arr.findIndex(c => String(c.slug ?? c.name).toLowerCase() === fromSlug);
    if (idx >= 0) {
      arr[idx] = { id: arr[idx].id ?? idgen(), slug: to.slug ?? arr[idx].slug ?? null, name: to.name };
    }
  },

  async deleteCategory(tenant_id: string | null, cat: GbpCategory): Promise<void> {
    await delay(15);
    const arr = ensure(tenant_id);
    const slug = String(cat.slug ?? cat.name).toLowerCase();
    const idx = arr.findIndex(c => String(c.slug ?? c.name).toLowerCase() === slug);
    if (idx >= 0) arr.splice(idx, 1);
  },
};

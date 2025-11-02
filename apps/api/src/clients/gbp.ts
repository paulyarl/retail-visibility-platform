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

export const gbpClient = {
  async listCategories(_tenantId: string | null): Promise<GbpCategory[]> {
    // TODO: fetch categories from GBP for the tenant's linked account
    await delay(50);
    return [];
  },

  async createCategory(_tenantId: string | null, _cat: GbpCategory): Promise<void> {
    await delay(30);
  },

  async updateCategory(_tenantId: string | null, _from: GbpCategory, _to: GbpCategory): Promise<void> {
    await delay(30);
  },

  async deleteCategory(_tenantId: string | null, _cat: GbpCategory): Promise<void> {
    await delay(30);
  },
};

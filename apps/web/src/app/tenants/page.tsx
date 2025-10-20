export default async function TenantsPage() {
  const res = await fetch('http://localhost:3000/api/tenants', { cache: 'no-store' });
  const data = await res.json();
  const tenants: Array<{ id: string; name: string; createdAt?: string; created_at?: string }>
    = Array.isArray(data.tenants) ? data.tenants : [];

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Tenants</h1>
      {tenants.length === 0 ? (
        <p className="text-sm opacity-80">No tenants found.</p>
      ) : (
        <ul className="list-disc pl-6">
          {tenants.map(t => (
            <li key={t.id}>
              <span className="font-medium">{t.name}</span>
              <span className="text-sm opacity-70 ml-2">{t.id}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

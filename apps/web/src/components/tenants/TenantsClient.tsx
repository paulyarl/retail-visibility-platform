"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Tenant = { id: string; name: string; createdAt?: string };

export default function TenantsClient({ initialTenants = [] }: { initialTenants?: Tenant[] }) {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tenants");
      const data = await res.json();
      setTenants(Array.isArray(data) ? data : []);
    } catch (_e) {
      setError("Failed to load tenants");
    } finally {
      setLoading(false);
    }
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");
      setTenants((prev) => [data as Tenant, ...prev]);
      setName("");
    } catch (_e) {
      setError("Failed to create tenant");
    } finally {
      setLoading(false);
    }
  };

  const onRename = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    const res = await fetch(`/api/tenants/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!res.ok) {
      setError("Failed to rename tenant");
      return;
    }
    const data = await res.json();
    setTenants((prev) => prev.map((t) => (t.id === id ? (data as Tenant) : t)));
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete tenant? This cannot be undone.")) return;
    const res = await fetch(`/api/tenants/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.status !== 204 && !res.ok) {
      setError("Failed to delete tenant");
      return;
    }
    setTenants((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Create tenant</h2>
        <form onSubmit={onCreate} className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 border rounded bg-white text-black"
            placeholder="Tenant name"
            required
          />
          <button disabled={loading} className="px-3 py-2 text-sm rounded border hover:bg-gray-100 disabled:opacity-60">
            {loading ? "Creating…" : "Create"}
          </button>
          <button type="button" onClick={refresh} disabled={loading}
            className="px-3 py-2 text-sm rounded border hover:bg-gray-100 disabled:opacity-60">
            {loading ? "Loading…" : "Refresh"}
          </button>
        </form>
        {error && (
          <div className="bg-red-950/20 border border-red-900 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Tenants</h2>
        {tenants.length === 0 ? (
          <p className="text-sm opacity-80">No tenants.</p>
        ) : (
          <ul className="divide-y divide-white/10 border rounded">
            {tenants.map((t) => (
              <TenantRow key={t.id} tenant={t}
                onSelect={() => router.push(`/items?tenantId=${encodeURIComponent(t.id)}`)}
                onRename={onRename}
                onDelete={() => onDelete(t.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TenantRow({ tenant, onSelect, onRename, onDelete }: {
  tenant: Tenant;
  onSelect: () => void;
  onRename: (id: string, newName: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tenant.name);

  useEffect(() => setValue(tenant.name), [tenant.name]);

  const save = async () => {
    await onRename(tenant.id, value);
    setEditing(false);
  };

  return (
    <li className="p-3 flex flex-wrap items-center gap-2">
      <button onClick={onSelect} className="underline text-left">
        <span className="font-medium">{tenant.name}</span>
        <span className="text-sm opacity-70 ml-2">{tenant.id}</span>
      </button>
      <span className="ml-auto" />
      {editing ? (
        <>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="px-2 py-1 border rounded bg-white text-black"
          />
          <button onClick={save} className="px-2 py-1 text-sm rounded border hover:bg-gray-100">Save</button>
          <button onClick={() => setEditing(false)} className="px-2 py-1 text-sm rounded border hover:bg-gray-100">Cancel</button>
        </>
      ) : (
        <>
          <button onClick={() => setEditing(true)} className="px-2 py-1 text-sm rounded border hover:bg-gray-100">Rename</button>
          <button onClick={onDelete} className="px-2 py-1 text-sm rounded border hover:bg-gray-100">Delete</button>
        </>
      )}
    </li>
  );
}

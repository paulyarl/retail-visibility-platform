"use client";
import React, { useEffect, useState } from "react";

type Override = { date: string; open?: string; close?: string; note?: string; isClosed?: boolean };

export default function SpecialHoursCalendar({ apiBase, tenantId }: { apiBase: string; tenantId: string }) {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const r = await fetch(`${apiBase}/api/tenant/${tenantId}/business-hours/special`, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setOverrides(Array.isArray(j?.data?.overrides) ? j.data.overrides : []);
      }
    };
    load();
  }, [apiBase, tenantId]);

  const add = () => setOverrides([...overrides, { date: new Date().toISOString().slice(0,10), open: "10:00", close: "14:00", note: "" }]);
  const update = (i: number, k: keyof Override, v: any) => {
    const next = overrides.slice();
    next[i] = { ...next[i], [k]: v } as Override;
    setOverrides(next);
  };
  const remove = (i: number) => setOverrides(overrides.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const r = await fetch(`${apiBase}/api/tenant/${tenantId}/business-hours/special`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overrides }),
    });
    setSaving(false);
    setMsg(r.ok ? "Saved" : "Failed");
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {overrides.map((o, i) => (
          <div key={i} className="flex flex-wrap gap-2 items-center">
            <input type="date" className="border px-2 py-1 rounded" value={o.date} onChange={(e) => update(i, "date", e.target.value)} />
            <label className="flex gap-1 items-center">
              <input type="checkbox" checked={!!o.isClosed} onChange={(e) => update(i, "isClosed", e.target.checked)} />
              Closed
            </label>
            {!o.isClosed && (
              <>
                <input className="border px-2 py-1 rounded w-24" value={o.open || ''} onChange={(e) => update(i, "open", e.target.value)} placeholder="Open" />
                <span>-</span>
                <input className="border px-2 py-1 rounded w-24" value={o.close || ''} onChange={(e) => update(i, "close", e.target.value)} placeholder="Close" />
              </>
            )}
            <input className="border px-2 py-1 rounded w-64" value={o.note || ''} onChange={(e) => update(i, "note", e.target.value)} placeholder="Note" />
            <button className="text-red-600" onClick={() => remove(i)}>Remove</button>
          </div>
        ))}
        <button className="text-blue-600" onClick={add}>Add override</button>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={saving} className="bg-black text-white px-3 py-1 rounded" onClick={save}>{saving ? "Saving..." : "Save"}</button>
        {msg && <span>{msg}</span>}
      </div>
    </div>
  );
}

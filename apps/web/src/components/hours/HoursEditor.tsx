"use client";
import React, { useEffect, useState } from "react";

type Period = { day: string; open: string; close: string };

export default function HoursEditor({ apiBase, tenantId }: { apiBase: string; tenantId: string }) {
  const [timezone, setTimezone] = useState("America/New_York");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const r = await fetch(`${apiBase}/api/tenant/${tenantId}/business-hours`, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setTimezone(j?.data?.timezone || "America/New_York");
        setPeriods(Array.isArray(j?.data?.periods) ? j.data.periods : []);
      }
    };
    load();
  }, [apiBase, tenantId]);

  const add = () => setPeriods([...periods, { day: "MONDAY", open: "09:00", close: "17:00" }]);
  const update = (i: number, k: keyof Period, v: string) => {
    const next = periods.slice();
    next[i] = { ...next[i], [k]: v } as Period;
    setPeriods(next);
  };
  const remove = (i: number) => setPeriods(periods.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const r = await fetch(`${apiBase}/api/tenant/${tenantId}/business-hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone, periods }),
    });
    setSaving(false);
    setMsg(r.ok ? "Saved" : "Failed");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="w-32">Timezone</label>
        <input className="border px-2 py-1 rounded w-64" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
      </div>
      <div className="space-y-2">
        {periods.map((p, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select className="border px-2 py-1 rounded" value={p.day} onChange={(e) => update(i, "day", e.target.value)}>
              {"SUNDAY,MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY,SATURDAY".split(",").map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <input className="border px-2 py-1 rounded w-24" value={p.open} onChange={(e) => update(i, "open", e.target.value)} />
            <span>-</span>
            <input className="border px-2 py-1 rounded w-24" value={p.close} onChange={(e) => update(i, "close", e.target.value)} />
            <button className="text-red-600" onClick={() => remove(i)}>Remove</button>
          </div>
        ))}
        <button className="text-blue-600" onClick={add}>Add period</button>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={saving} className="bg-black text-white px-3 py-1 rounded" onClick={save}>{saving ? "Saving..." : "Save"}</button>
        {msg && <span>{msg}</span>}
      </div>
    </div>
  );
}

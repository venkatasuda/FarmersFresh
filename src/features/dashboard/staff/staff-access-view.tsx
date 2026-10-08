"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StaffAccess, StaffRole } from "@/lib/contracts/staff-access";
import { setStaffAccess } from "./actions";
export function StaffAccessView({ data, currentUser }: { data: StaffAccess; currentUser: string }) {
  const router = useRouter(), [pending, start] = useTransition(), [message, setMessage] = useState<string | null>(null);
  const name = (id: string) => data.people.find(p => p.id === id)?.full_name || id;
  return <div className="space-y-6">
    <h1 className="text-2xl font-semibold text-ink">Staff access</h1>
    <p className="text-sm text-ink-soft">Assign existing staff accounts to specific locations. Owner access remains separate. Staff handles orders, counter sales and deliveries; manager adds store operations and refunds; accountant handles scoped finance and cash reconciliation.</p>
    <form className="space-y-3 rounded-xl border border-line bg-surface p-4" onSubmit={event => {
      event.preventDefault(); if(pending) return;
      const form = new FormData(event.currentTarget), user=String(form.get("user")), location=String(form.get("location")), role=String(form.get("role")) as StaffRole | "";
      if (!confirm(`Change ${name(user)} to ${role || "no access"} at this location?`)) return;
      start(async () => {
        try { const result=await setStaffAccess(user,location,role || null,String(form.get("reason"))); setMessage(result.ok ? "Access updated." : result.message ?? "Could not update access."); if(result.ok) router.refresh(); }
        catch {setMessage("Could not update access. Please retry.");}
      });
    }}>
      <label className="block text-sm text-ink-soft">Staff member<select name="user" required disabled={pending} className="ml-2 rounded-lg border border-line bg-surface p-2 text-ink"><option value="">Choose staff</option>{data.people.filter(p => !p.is_owner && p.id !== currentUser).map(p => <option key={p.id} value={p.id}>{p.full_name || p.id}</option>)}</select></label>
      <label className="block text-sm text-ink-soft">Location<select name="location" required disabled={pending} className="ml-2 rounded-lg border border-line bg-surface p-2 text-ink">{data.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <label className="block text-sm text-ink-soft">Access role<select name="role" disabled={pending} className="ml-2 rounded-lg border border-line bg-surface p-2 text-ink"><option value="staff">Staff</option><option value="manager">Manager</option><option value="accountant">Accountant</option><option value="">Remove location access</option></select></label>
      <label className="block text-sm text-ink-soft">Reason<input name="reason" required maxLength={500} disabled={pending} className="mt-1 block w-full rounded-lg border border-line bg-surface p-2 text-ink" /></label>
      <button disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-white disabled:opacity-50">Save staff access</button>
      {message ? <p role="status" className="text-sm text-ink">{message}</p> : null}
    </form>
    <section className="rounded-xl border border-line bg-surface p-4"><h2 className="font-semibold text-ink">Current location access</h2><ul className="mt-3 divide-y divide-line">{data.memberships.map(m => <li key={`${m.user_id}:${m.location_id}`} className="py-2 text-sm text-ink">{name(m.user_id)} · {data.locations.find(l => l.id === m.location_id)?.name} · {m.role}</li>)}</ul></section>
    <details className="rounded-xl border border-line bg-surface p-4"><summary className="cursor-pointer font-semibold text-ink">Role permissions</summary>{["staff","manager","accountant"].map(role => <p key={role} className="mt-3 text-sm text-ink"><strong className="capitalize">{role}</strong>: {data.capabilities.filter(c => c.role === role).map(c => c.capability).join(", ")}</p>)}</details>
    <section className="rounded-xl border border-line bg-surface p-4"><h2 className="font-semibold text-ink">Access audit · latest 100 changes</h2><ul className="mt-3 divide-y divide-line">{data.audit.map(a => <li key={a.id} className="py-2 text-sm text-ink">{new Date(a.created_at).toLocaleString("en-IN")} · {name(a.actor_id)} changed {name(a.entity_id)}: {String(a.payload.before ?? "none")} → {String(a.payload.after ?? "none")}{a.payload.reason ? ` · ${a.payload.reason}` : ""}</li>)}</ul></section>
  </div>;
}

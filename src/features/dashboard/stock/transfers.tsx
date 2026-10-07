"use client";

import { useRef, useState, useTransition } from "react";
import { dispatchTransfer, receiveTransfer } from "./actions";
import type { StockTransfer } from "@/lib/contracts/staff-stock";
import type { StockLine } from "@/lib/types";
import { formatQty } from "@/lib/format";

export function Transfers({ location, destinations, products, transfers }: {
  location:string; destinations:{id:string;name:string}[]; products:StockLine[]; transfers:StockTransfer[];
}) {
  const [product,setProduct]=useState(products[0]?.productId ?? "");
  const [destination,setDestination]=useState(destinations[0]?.id ?? "");
  const [quantity,setQuantity]=useState("");
  const [note,setNote]=useState("");
  const [error,setError]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [pending,startTransition]=useTransition();
  const request=useRef({ key:"",id:"" });
  const unit=products.find(p=>p.productId===product)?.unit ?? "kg";
  function dispatch() {
    const key=JSON.stringify([location,destination,product,quantity,note]);
    if (request.current.key!==key) request.current={key,id:crypto.randomUUID()};
    setError(null); setNotice(null);
    startTransition(async()=>{
      try {
        const result=await dispatchTransfer(request.current.id,location,destination,product,Number(quantity),note);
        if (!result.ok) { setError(result.message); return; }
        setQuantity(""); setNote(""); request.current={key:"",id:""};
        setNotice("Dispatched. The receiving store must confirm arrival.");
      } catch { setError("Could not confirm dispatch. Retry with the same details."); }
    });
  }
  function receive(id:string) {
    if (!confirm("Confirm all goods have arrived? Any batches expired in transit will be recorded as wastage.")) return;
    setError(null); setNotice(null);
    startTransition(async()=>{
      try {
        const result=await receiveTransfer(id);
        if (!result.ok) setError(result.message);
        else setNotice("Receipt recorded. Stock and batch records are updated.");
      } catch { setError("Could not confirm receipt. Please retry."); }
    });
  }
  const field="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink";
  return <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
    <h2 className="font-semibold text-ink">Store transfers</h2>
    <p className="text-sm text-ink-soft">Dispatch removes stock here. The destination adds it after confirming receipt.</p>
    {destinations.length && products.length ? <form onSubmit={e=>{e.preventDefault();if(!pending) dispatch();}}>
      <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Dispatch stock</legend>
        <label className="text-sm text-ink-soft">Product<select className={field} value={product} onChange={e=>setProduct(e.target.value)} required>
          {products.map(p=><option key={p.productId} value={p.productId}>{p.name} · {formatQty(p.onHand,p.unit)} available</option>)}
        </select></label>
        <label className="text-sm text-ink-soft">Receiving store<select className={field} value={destination} onChange={e=>setDestination(e.target.value)} required>
          {destinations.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
        </select></label>
        <label className="text-sm text-ink-soft">Quantity ({unit})<input className={field} type="number" min={unit==="piece"?1:0.001} max={100000} step={unit==="piece"?1:0.001} required value={quantity} onChange={e=>setQuantity(e.target.value)} /></label>
        <label className="text-sm text-ink-soft">Note<input className={field} maxLength={500} value={note} onChange={e=>setNote(e.target.value)} /></label>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" type="submit">{pending?"Saving…":"Dispatch stock"}</button>
      </fieldset>
    </form> : <p className="text-sm text-ink-soft">Add another store before dispatching a transfer.</p>}
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    {notice ? <p role="status" className="text-sm text-brand-700">{notice}</p> : null}
    <ul className="divide-y divide-line">{transfers.map(t=><li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
      <div><p className="font-medium text-ink">{t.product} · {formatQty(t.quantity,t.unit)}</p>
        <p className="text-ink-soft">{t.source} → {t.destination} · {t.status==="received"?"Received":"In transit"}</p></div>
      {t.destinationId===location && t.status==="dispatched" ? <button type="button" disabled={pending} onClick={()=>receive(t.id)} className="rounded-lg border border-line px-3 py-2 text-brand-700 disabled:opacity-50">Confirm receipt</button> : null}
    </li>)}</ul>
    {!transfers.length ? <p className="text-sm text-ink-soft">No transfers for this store.</p> : <p className="text-xs text-ink-soft">Up to 100 transfers, with pending receipts first.</p>}
  </section>;
}

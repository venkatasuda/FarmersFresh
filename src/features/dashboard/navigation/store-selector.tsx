export function StoreSelector({ locations, locationId }: {
  locations: { id: string; name: string }[];
  locationId: string;
}) {
  return <form className="mb-6 flex items-end gap-3">
    <label className="text-sm text-ink-soft">Store
      <select name="location" defaultValue={locationId} className="ml-2 rounded-lg border border-line bg-surface px-3 py-2 text-ink">
        {locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
      </select>
    </label>
    <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">View store</button>
  </form>;
}

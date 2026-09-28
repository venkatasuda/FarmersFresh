// Shown while any dashboard route's server data loads. One file covers every
// subroute (Next uses the nearest loading.tsx). Uses the .ff-shimmer sheen.
function Bar({ className = "" }: { className?: string }) {
  return <div className={`ff-shimmer rounded-lg ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="space-y-2">
        <Bar className="h-7 w-48" />
        <Bar className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Bar key={i} className="h-20" />
        ))}
      </div>
      <div className="space-y-2 rounded-2xl border border-line bg-surface p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Bar key={i} className="h-10" />
        ))}
      </div>
    </div>
  );
}

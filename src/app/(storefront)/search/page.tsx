import { SearchPageView } from "@/features/search/search-view";
import { searchItems } from "@/lib/search";
import { getCatalogue } from "@/server/catalogue/storefront";

export const metadata = { title: "Search · Farmers Fresh" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const { q, page } = await searchParams;
  const term = typeof q === "string" ? q.trim() : "";

  // Typo- and language-tolerant, ranked. In-memory over the catalogue (small);
  // see lib/search.ts for the scale note.
  const all = await getCatalogue();
  const results = searchItems(all, term);

  return <SearchPageView term={term} results={results} q={term} page={typeof page === "string" ? page : undefined} />;
}

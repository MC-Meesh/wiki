import { listWikiDir } from "@/lib/wiki";
import { BrowseList } from "@/components/browse/BrowseList";

export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const entries = await listWikiDir("");

  return (
    <div className="px-5 py-4">
      <BrowseList entries={entries} />
    </div>
  );
}

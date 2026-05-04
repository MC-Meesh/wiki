import { readWikiFile, listWikiDir } from "@/lib/wiki";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { BrowseList } from "@/components/browse/BrowseList";

export const dynamic = "force-dynamic";

export default async function BrowsePathPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const filePath = path.join("/");

  const mdContent = await readWikiFile(filePath + ".md");
  if (mdContent) {
    return (
      <MarkdownEditor path={`${filePath}.md`} initialContent={mdContent} />
    );
  }

  try {
    const entries = await listWikiDir(filePath);
    return (
      <div className="px-5 py-4">
        <BrowseList entries={entries} />
      </div>
    );
  } catch {
    return (
      <div className="px-5 py-4">
        <p className="text-muted text-sm">not found: {filePath}</p>
      </div>
    );
  }
}

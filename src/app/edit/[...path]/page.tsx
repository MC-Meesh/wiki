import { readWikiFile } from "@/lib/wiki";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";

export const dynamic = "force-dynamic";

export default async function EditPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const filePath = path.join("/");
  const content = await readWikiFile(filePath);

  if (content === null) {
    return (
      <div className="px-5 py-4">
        <p className="text-muted text-sm">not found: {filePath}</p>
      </div>
    );
  }

  return <MarkdownEditor path={filePath} initialContent={content} />;
}

import { getDailyNote } from "@/lib/wiki";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { QuickAddTodo } from "@/components/daily/QuickAddTodo";

export const dynamic = "force-dynamic";

export default async function DailyPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  let content = await getDailyNote(date);

  if (content === null) {
    const dayName = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long",
    });
    content = `---\ndate: ${date}\nstatus: active\n---\n# ${date} (${dayName})\n\n## Focus\n- [ ] \n`;
  }

  return (
    <>
      <MarkdownEditor path={`daily/${date}.md`} initialContent={content} />
      <QuickAddTodo date={date} />
    </>
  );
}

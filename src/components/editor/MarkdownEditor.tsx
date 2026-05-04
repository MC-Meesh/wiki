"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { EditorState, Range } from "@codemirror/state";
import {
  EditorView,
  keymap,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  syntaxHighlighting,
  HighlightStyle,
  syntaxTree,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";

// Clickable checkbox widget
class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly pos: number) {
    super();
  }
  toDOM() {
    const box = document.createElement("span");
    box.className = "cm-task-checkbox";
    box.dataset.pos = String(this.pos);
    box.dataset.checked = String(this.checked);
    box.textContent = this.checked ? "☑" : "☐";
    box.style.cursor = "pointer";
    box.style.color = this.checked ? "#666" : "#fff";
    box.style.userSelect = "none";
    box.style.fontSize = "15px";
    box.style.marginRight = "4px";
    return box;
  }
  eq(other: CheckboxWidget) {
    return this.checked === other.checked && this.pos === other.pos;
  }
  ignoreEvent() {
    return false;
  }
}

function livePreviewDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const doc = view.state.doc;
  const selection = view.state.selection.main;
  const cursorLine = doc.lineAt(selection.head).number;

  const tree = syntaxTree(view.state);
  const seenLines = new Set<number>();

  // Apply hanging-indent line decorations for every line inside a list item
  const listLines = new Set<number>();

  tree.iterate({
    enter: (node) => {
      // Hanging indent for list item lines (including wrapped continuation)
      if (node.name === "ListItem") {
        const startLine = doc.lineAt(node.from);
        const endLine = doc.lineAt(node.to);
        // Find where content starts on the first line of the item:
        // indent + marker (- / * / +, or `1.`) + space + optional `[ ] `
        const firstLine = startLine.text;
        const m = firstLine.match(/^(\s*)([-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/);
        if (!m) return;
        const offset = m[0].length;
        for (let ln = startLine.number; ln <= endLine.number; ln++) {
          const li = doc.line(ln);
          if (listLines.has(li.from)) continue;
          listLines.add(li.from);
          ranges.push(
            Decoration.line({
              attributes: {
                style: `padding-left: ${offset}ch; text-indent: -${offset}ch;`,
              },
            }).range(li.from)
          );
        }
      }

      // Line-level heading styles
      const hMatch = node.name.match(/^ATXHeading([1-6])$/);
      if (hMatch) {
        const level = parseInt(hMatch[1]);
        const line = doc.lineAt(node.from);
        if (!seenLines.has(line.from)) {
          seenLines.add(line.from);
          ranges.push(
            Decoration.line({
              attributes: { class: `cm-md-h${level}` },
            }).range(line.from)
          );
        }
      }

      // Task list markers → clickable checkbox + strikethrough if checked
      if (node.name === "TaskMarker") {
        const text = doc.sliceString(node.from, node.to);
        const checked = /\[[xX]\]/.test(text);
        ranges.push(
          Decoration.replace({
            widget: new CheckboxWidget(checked, node.from),
          }).range(node.from, node.to)
        );
        if (checked) {
          const lineObj = doc.lineAt(node.from);
          if (node.to < lineObj.to) {
            ranges.push(
              Decoration.mark({ class: "cm-task-done" }).range(
                node.to,
                lineObj.to
              )
            );
          }
        }
        return;
      }

      // Heading `#` markers — dim instead of hide (avoids cursor offset bugs)
      if (node.name === "HeaderMark") {
        ranges.push(
          Decoration.mark({ class: "cm-syntax-dim" }).range(node.from, node.to)
        );
      }

      // Plain list bullets: leave them as raw `-` (no widget replacement)
    },
  });

  // Sort: by `from`, then by startSide (line decorations have startSide=-1, so they come first at the same position)
  ranges.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return a.value.startSide - b.value.startSide;
  });

  return Decoration.set(ranges, true);
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = livePreviewDecorations(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet
      ) {
        this.decorations = livePreviewDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    eventHandlers: {
      mousedown(e, view) {
        const target = e.target as HTMLElement;
        if (!target.classList.contains("cm-task-checkbox")) return false;
        e.preventDefault();
        const pos = parseInt(target.dataset.pos || "-1");
        const checked = target.dataset.checked === "true";
        if (pos < 0) return false;
        const line = view.state.doc.lineAt(pos);
        const lineText = line.text;
        const match = lineText.match(/^(\s*-\s+\[)([ xX])(\])/);
        if (!match) return false;
        const markerFrom = line.from + match[1].length;
        view.dispatch({
          changes: {
            from: markerFrom,
            to: markerFrom + 1,
            insert: checked ? " " : "x",
          },
        });
        return true;
      },
    },
  }
);

const theme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "#c4c4c4",
    fontSize: "14px",
    fontFamily: "'IBM Plex Mono', monospace",
  },
  ".cm-content": {
    caretColor: "#ffffff",
    padding: "20px 20px 120px 20px",
    lineHeight: "1.7",
    maxWidth: "720px",
    margin: "0 auto",
  },
  ".cm-cursor": { borderLeftColor: "#ffffff" },
  ".cm-activeLine": { backgroundColor: "rgba(255, 255, 255, 0.015)" },
  ".cm-gutters": { display: "none" },
  ".cm-selectionBackground": {
    backgroundColor: "rgba(255, 255, 255, 0.12) !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "rgba(255, 255, 255, 0.18) !important",
  },
  ".cm-line": { padding: "0" },
  ".cm-scroller": { overflow: "auto" },

  // Heading lines
  ".cm-md-h1": {
    fontSize: "22px",
    fontWeight: "700",
    color: "#f0f0f0",
    paddingTop: "12px",
    paddingBottom: "4px",
  },
  ".cm-md-h2": {
    fontSize: "18px",
    fontWeight: "600",
    color: "#ebebeb",
    paddingTop: "20px",
    paddingBottom: "8px",
    borderBottom: "1px solid rgba(140,140,140,0.18)",
  },
  ".cm-md-h3": {
    fontSize: "16px",
    fontWeight: "600",
    color: "#e5e5e5",
    paddingTop: "14px",
  },
  ".cm-md-h4": { fontSize: "15px", fontWeight: "600", color: "#e0e0e0", paddingTop: "8px" },
  ".cm-md-list-line": { color: "#c4c4c4" },
  ".cm-syntax-dim": {
    opacity: "0.3",
  },
  ".cm-task-done": {
    textDecoration: "line-through",
    textDecorationColor: "rgba(200,200,200,0.3)",
    color: "#6a6a6a",
  },
});

const mdHighlight = HighlightStyle.define([
  { tag: tags.strong, color: "#ebebeb", fontWeight: "700" },
  { tag: tags.emphasis, color: "#c0c0c0", fontStyle: "italic" },
  { tag: tags.link, color: "#e0e0e0", textDecoration: "underline" },
  { tag: tags.url, color: "#7a7a7a" },
  { tag: tags.monospace, color: "#d0d0d0", backgroundColor: "rgba(140,140,140,0.12)" },
  { tag: tags.quote, color: "#7a7a7a", fontStyle: "italic" },
  { tag: tags.meta, color: "#5a5a5a" },
  { tag: tags.comment, color: "#5a5a5a" },
  { tag: tags.heading, color: "#ebebeb" },
]);

export function MarkdownEditor({
  path,
  initialContent,
}: {
  path: string;
  initialContent: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  const save = useCallback(
    async (content: string) => {
      setSaving(true);
      try {
        await fetch(`/api/wiki/${path}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            message: `wiki-app: update ${path}`,
          }),
        });
        setSaved(true);
      } catch {
        setSaved(false);
      } finally {
        setSaving(false);
      }
    },
    [path]
  );

  const debouncedSave = useCallback(
    (content: string) => {
      setSaved(false);
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => save(content), 1000);
    },
    [save]
  );

  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        theme,
        EditorView.lineWrapping,
        history(),
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(mdHighlight),
        livePreviewPlugin,
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            debouncedSave(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;
    return () => view.destroy();
  }, [initialContent, debouncedSave]);

  return (
    <>
      <div className="fixed top-14 right-4 z-10 text-[10px] text-accent font-mono pointer-events-none">
        {saving ? "saving..." : saved ? "" : "unsaved"}
      </div>
      <div ref={editorRef} />
    </>
  );
}

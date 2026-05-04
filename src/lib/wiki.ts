import simpleGit, { SimpleGit } from "simple-git";
import { readFile, writeFile, readdir, stat, mkdir } from "fs/promises";
import { join, relative } from "path";

const WIKI_PATH = process.env.WIKI_PATH || "/wiki";

let git: SimpleGit;

function getGit(): SimpleGit {
  if (!git) git = simpleGit(WIKI_PATH);
  return git;
}

export async function readWikiFile(path: string): Promise<string | null> {
  try {
    const fullPath = join(WIKI_PATH, path);
    return await readFile(fullPath, "utf-8");
  } catch {
    return null;
  }
}

export async function writeWikiFile(
  path: string,
  content: string,
  message?: string
): Promise<void> {
  const fullPath = join(WIKI_PATH, path);
  await writeFile(fullPath, content, "utf-8");
  const g = getGit();
  await g.add(fullPath);
  await g.commit(message || `wiki-app: update ${path}`);
  g.push("origin", "main").catch(() => {});
}

export async function listWikiDir(
  dir: string = ""
): Promise<{ name: string; path: string; isDir: boolean }[]> {
  const fullPath = join(WIKI_PATH, dir);
  const entries = await readdir(fullPath, { withFileTypes: true });
  return entries
    .filter((e) => !e.name.startsWith("."))
    .map((e) => ({
      name: e.name,
      path: join(dir, e.name),
      isDir: e.isDirectory() || e.isSymbolicLink(),
    }))
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export async function getDailyNote(date: string): Promise<string | null> {
  return readWikiFile(`daily/${date}.md`);
}

export async function searchWiki(query: string): Promise<string[]> {
  const g = getGit();
  try {
    const result = await g.grep(query);
    return Object.keys(result.paths);
  } catch {
    return [];
  }
}

export function getWikiPath(): string {
  return WIKI_PATH;
}

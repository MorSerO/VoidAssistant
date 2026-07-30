import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import * as Diff from 'diff';
import type { EditProposal } from '../../shared/types';

// In-memory store for pending edit proposals
const pendingEdits = new Map<string, EditProposal>();

/**
 * Validate that a file path is within the allowed paths list.
 * Prevents path traversal attacks.
 */
export function isPathAllowed(filePath: string, allowedPaths: string[]): boolean {
  const normalized = path.normalize(path.resolve(filePath));
  return allowedPaths.some(allowed => {
    const normalizedAllowed = path.normalize(path.resolve(allowed));
    return normalized.startsWith(normalizedAllowed) ||
           normalized === normalizedAllowed ||
           // Also allow if the file is the exact allowed path
           path.dirname(normalized).startsWith(normalizedAllowed);
  });
}

/**
 * Read a file's content. Validates the path is within allowed paths.
 */
export function readFileContent(filePath: string, allowedPaths: string[]): string {
  if (!isPathAllowed(filePath, allowedPaths)) {
    throw new Error(`Access denied: file path "${filePath}" is not in the allowed paths.`);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Propose a new content for a file. Returns a diff for review.
 * Does NOT write the file - only stores the proposal.
 */
export function proposeFileEdit(
  filePath: string,
  newContent: string,
  allowedPaths: string[]
): EditProposal {
  if (!isPathAllowed(filePath, allowedPaths)) {
    throw new Error(`Access denied: file path "${filePath}" is not in the allowed paths.`);
  }

  const originalContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  const editId = uuidv4();
  const diff = Diff.createPatch(filePath, originalContent, newContent, 'Original', 'Proposed');

  const proposal: EditProposal = {
    editId,
    filePath,
    originalContent,
    newContent,
    diff,
  };

  pendingEdits.set(editId, proposal);
  return proposal;
}

/**
 * Confirm and apply a pending edit. Creates a .bak backup first.
 */
export function confirmFileEdit(editId: string): void {
  const proposal = pendingEdits.get(editId);
  if (!proposal) {
    throw new Error(`Edit proposal "${editId}" not found. It may have expired.`);
  }

  // Create backup
  const bakPath = proposal.filePath + '.bak';
  if (fs.existsSync(proposal.filePath)) {
    fs.copyFileSync(proposal.filePath, bakPath);
  }

  // Ensure directory exists
  const dir = path.dirname(proposal.filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write new content
  fs.writeFileSync(proposal.filePath, proposal.newContent, 'utf-8');
  pendingEdits.delete(editId);
}

/**
 * Reject/discard a pending edit.
 */
export function rejectFileEdit(editId: string): void {
  pendingEdits.delete(editId);
}

/**
 * Get the diaries directory path.
 */
export function getDiariesDir(): string {
  const dir = path.join(app.getPath('userData'), 'diaries');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Get the diary file path for a specific date.
 */
export function getDiaryFilePath(date: string): string {
  return path.join(getDiariesDir(), `${date}.md`);
}

/**
 * Read a diary entry for a specific date.
 */
export function readDiaryEntry(date: string): string | null {
  const filePath = getDiaryFilePath(date);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Create a new diary file for today if it doesn't exist.
 * Returns the content of the diary entry.
 */
export function getOrCreateDiaryEntry(date: string): string {
  const filePath = getDiaryFilePath(date);
  if (!fs.existsSync(filePath)) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const content = `# ${date}\n\n*Journal entry created at ${timeStr}*\n\n`;
    fs.writeFileSync(filePath, content, 'utf-8');
    return content;
  }
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Append content to today's diary entry.
 */
export function appendToDiaryEntry(content: string): void {
  const today = new Date().toISOString().split('T')[0];
  const filePath = getDiaryFilePath(today);
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const entry = `\n\n---\n*${timeStr}*\n\n${content}\n`;
  fs.appendFileSync(filePath, entry, 'utf-8');
}

/**
 * List all diary entries with previews.
 */
export function listDiaryEntriesList(): Array<{ date: string; preview: string }> {
  const dir = getDiariesDir();
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const date = f.replace('.md', '');
      const content = fs.readFileSync(path.join(dir, f), 'utf-8');
      const preview = content.replace(/^#.*\n/, '').trim().slice(0, 100);
      return { date, preview };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get diary entries within a date range.
 */
export function getDiaryEntriesByDateRangeList(start: string, end: string): Record<string, string> {
  const dir = getDiariesDir();
  if (!fs.existsSync(dir)) return {};

  const result: Record<string, string> = {};
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const date = file.replace('.md', '');
    if (date >= start && date <= end) {
      result[date] = fs.readFileSync(path.join(dir, file), 'utf-8');
    }
  }
  return result;
}

import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

export const HELPER = process.env.REMINDERS_HELPER || path.join(here, 'bin', 'reminders-helper');
export const DEFAULT_TIME = process.env.REMINDER_DEFAULT_TIME || '20:30';
export const DEFAULT_LIST = process.env.REMINDER_DEFAULT_LIST || undefined;

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Work out the reminder's first due time as "yyyy-MM-dd HH:mm" in the Mac's local time zone.
 * No date given: today at `time`, or tomorrow if that time has already passed.
 */
export function resolveDue({ date, time, now = new Date() } = {}) {
  const t = time || DEFAULT_TIME;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) {
    throw new Error(`time must be HH:MM (24h), got "${t}"`);
  }
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00`))) {
      throw new Error(`date must be YYYY-MM-DD, got "${date}"`);
    }
    return `${date} ${t}`;
  }
  const [h, m] = t.split(':').map(Number);
  const due = new Date(now);
  due.setHours(h, m, 0, 0);
  if (due <= now) due.setDate(due.getDate() + 1);
  return `${ymd(due)} ${t}`;
}

/** Run the EventKit helper and return its parsed JSON output. */
export function runHelper(args) {
  return new Promise((resolve, reject) => {
    execFile(HELPER, args, { timeout: 30_000 }, (err, stdout, stderr) => {
      let parsed;
      try {
        parsed = JSON.parse(stdout.trim().split('\n').pop() || '{}');
      } catch {
        parsed = undefined;
      }
      if (parsed?.error) return reject(new Error(parsed.error));
      if (err) {
        const hint = err.code === 'ENOENT' ? ` (helper not found at ${HELPER} — run "npm run build")` : '';
        return reject(new Error(`${err.message}${hint}${stderr ? `\n${stderr}` : ''}`));
      }
      if (!parsed) return reject(new Error(`Helper returned non-JSON output: ${stdout}`));
      resolve(parsed);
    });
  });
}

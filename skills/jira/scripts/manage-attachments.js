/**
 * manage-attachments.js
 *
 * Manage JIRA issue attachments: delete existing by filename, upload new files.
 *
 * Usage:
 *   node manage-attachments.js <issue-key> <file1> [file2 ...]
 *   node manage-attachments.js <issue-key> --list
 *   node manage-attachments.js <issue-key> <file1> --delete-only
 *   node manage-attachments.js <issue-key> <file1> --keep
 *
 * Options:
 *   --list        List existing attachments and exit
 *   --delete-only Delete matching attachments without re-uploading
 *   --keep        Upload without removing existing same-named attachments
 *
 * Default behavior:
 *   For each file, delete any existing attachment with the same name,
 *   then upload the new version.
 *
 * Examples:
 *   node manage-attachments.js NC-721 ASSESSMENT.md DEPLOYMENT-PLAN.md
 *   node manage-attachments.js NC-721 --list
 *   node manage-attachments.js NC-721 old-report.pdf --delete-only
 */

import { loadConfig } from './jira-client.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: node manage-attachments.js <issue-key> <file1> [file2 ...] [--list|--delete-only|--keep]');
    process.exit(0);
  }
  const issueKey = args[0];
  const flags = new Set(args.filter(a => a.startsWith('--')));
  const files = args.slice(1).filter(a => !a.startsWith('--'));
  return { issueKey, files, flags };
}

function makeHeaders(config, extra = {}) {
  const auth = (config.usePAT && !config.url.includes('.atlassian.net'))
    ? `Bearer ${config.token}`
    : `Basic ${Buffer.from(`${config.email}:${config.token}`).toString('base64')}`;
  return { Authorization: auth, Accept: 'application/json', ...extra };
}

async function listAttachments(config, issueKey) {
  const res = await fetch(
    `${config.url}/rest/api/2/issue/${issueKey}?fields=attachment`,
    { headers: makeHeaders(config) }
  );
  if (!res.ok) throw new Error(`Failed to fetch ${issueKey}: HTTP ${res.status}`);
  const issue = await res.json();
  return (issue.fields.attachment || []).map(a => ({
    id: a.id, filename: a.filename, size: a.size, created: a.created,
  }));
}

async function deleteAttachment(config, id, filename) {
  const res = await fetch(
    `${config.url}/rest/api/2/attachment/${id}`,
    { method: 'DELETE', headers: makeHeaders(config) }
  );
  if (res.status === 204) {
    console.log(`  deleted  : ${filename} (id=${id})`);
    return true;
  }
  console.log(`  del fail : ${filename} (id=${id}) — HTTP ${res.status}`);
  return false;
}

async function uploadAttachment(config, issueKey, filePath, fileName) {
  const fileData = fs.readFileSync(filePath);
  const formData = new FormData();
  formData.append('file', new Blob([fileData]), fileName);

  const res = await fetch(
    `${config.url}/rest/api/2/issue/${issueKey}/attachments`,
    {
      method: 'POST',
      headers: makeHeaders(config, { 'X-Atlassian-Token': 'no-check' }),
      body: formData,
    }
  );

  if (res.status === 200) {
    const parsed = await res.json();
    const att = Array.isArray(parsed) ? parsed[0] : parsed;
    console.log(`  uploaded : ${fileName} (id=${att.id}, ${(att.size / 1024).toFixed(1)} KB)`);
    return true;
  }
  const body = await res.text();
  console.log(`  up fail  : ${fileName} — HTTP ${res.status}: ${body.slice(0, 120)}`);
  return false;
}

async function main() {
  const config = loadConfig();
  const { issueKey, files, flags } = parseArgs();

  const listOnly   = flags.has('--list');
  const deleteOnly = flags.has('--delete-only');
  const keepExist  = flags.has('--keep');

  if (listOnly) {
    const attachments = await listAttachments(config, issueKey);
    if (attachments.length === 0) {
      console.log(`No attachments on ${issueKey}.`);
    } else {
      console.log(`Attachments on ${issueKey} (${attachments.length}):\n`);
      attachments.forEach(a => {
        const kb = (a.size / 1024).toFixed(1);
        console.log(`  [${a.id}]  ${a.filename}  (${kb} KB, ${a.created.slice(0, 10)})`);
      });
    }
    return;
  }

  if (files.length === 0) {
    console.error('No files specified. Use --list to see existing attachments.');
    process.exit(1);
  }

  console.log(`\n${issueKey} — managing attachments\n${'─'.repeat(40)}`);

  const existing = await listAttachments(config, issueKey);

  for (const fileArg of files) {
    const fileName = path.basename(fileArg);
    const filePath = path.isAbsolute(fileArg) ? fileArg : path.resolve(process.cwd(), fileArg);

    console.log(`\n${fileName}`);

    if (!keepExist) {
      const match = existing.find(a => a.filename === fileName);
      if (match) {
        await deleteAttachment(config, match.id, fileName);
      } else {
        console.log(`  (no existing attachment)`);
      }
    }

    if (!deleteOnly) {
      if (!fs.existsSync(filePath)) {
        console.log(`  skipped  : not found at ${filePath}`);
        continue;
      }
      await uploadAttachment(config, issueKey, filePath, fileName);
    }
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });

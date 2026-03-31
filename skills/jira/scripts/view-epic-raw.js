#!/usr/bin/env node
/**
 * View raw issue/epic data (all fields as JSON)
 *
 * Usage:
 *   node view-epic-raw.js <ISSUE-KEY>
 *   node view-epic-raw.js NC-686
 */

import { createClient } from './jira-client.js';

async function viewRaw(issueKey) {
  const client = await createClient();
  const issue = await client.getIssue(issueKey);

  console.log(`All fields for ${issueKey}:`);
  console.log(JSON.stringify(issue.fields, null, 2));
}

// Main
const issueKey = process.argv[2];

if (!issueKey || issueKey === '-h' || issueKey === '--help') {
  console.log('Usage: node view-epic-raw.js <ISSUE-KEY>');
  console.log('');
  console.log('Shows all raw field data as JSON for debugging.');
  console.log('');
  console.log('Examples:');
  console.log('  node view-epic-raw.js NC-686');
  console.log('  node view-epic-raw.js PROJ-100');
  process.exit(issueKey ? 0 : 1);
}

viewRaw(issueKey);

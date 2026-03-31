#!/usr/bin/env node
/**
 * View tasks in an epic (compact list)
 *
 * Usage:
 *   node view-epic-tasks.js <EPIC-KEY>
 *   node view-epic-tasks.js NC-687
 */

import { createClient } from './jira-client.js';

async function viewEpicTasks(epicKey) {
  const client = await createClient();

  const jql = `"Epic Link" = ${epicKey} ORDER BY created ASC`;
  const issues = await client.searchIssues(jql, { maxResults: 100 });

  console.log('='.repeat(100));
  console.log(`TASKS IN EPIC: ${epicKey}`);
  console.log('='.repeat(100));
  console.log('');
  console.log(`Found ${issues.length} task(s):\n`);

  issues.forEach((issue, idx) => {
    console.log(`${idx + 1}. ${issue.key}: ${issue.fields.summary}`);
    console.log(`   Status: ${issue.fields.status.name}`);
    console.log(`   Priority: ${issue.fields.priority.name}`);
    console.log('');
  });

  console.log('='.repeat(100));
  console.log(`View Epic: ${client.url}/browse/${epicKey}`);
  console.log('='.repeat(100));
}

// Main
const epicKey = process.argv[2];

if (!epicKey || epicKey === '-h' || epicKey === '--help') {
  console.log('Usage: node view-epic-tasks.js <EPIC-KEY>');
  console.log('');
  console.log('Examples:');
  console.log('  node view-epic-tasks.js NC-687');
  console.log('  node view-epic-tasks.js PROJ-100');
  process.exit(epicKey ? 0 : 1);
}

viewEpicTasks(epicKey);

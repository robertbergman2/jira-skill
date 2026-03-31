#!/usr/bin/env node
/**
 * Quick status check for an issue
 *
 * Usage:
 *   node check-status.js <ISSUE-KEY>
 *   node check-status.js NC-641
 */

import { createClient } from './jira-client.js';

const issueKey = process.argv[2];

if (!issueKey || issueKey === '-h' || issueKey === '--help') {
  console.log('Usage: node check-status.js <ISSUE-KEY>');
  console.log('');
  console.log('Examples:');
  console.log('  node check-status.js NC-641');
  console.log('  node check-status.js PROJ-100');
  process.exit(issueKey ? 0 : 1);
}

const client = await createClient();
const issue = await client.getIssue(issueKey);

console.log(`Issue: ${issueKey}`);
console.log(`Status: ${issue.fields.status.name}`);
console.log(`Updated: ${issue.fields.updated}`);
console.log(`\nFull status object:`, JSON.stringify(issue.fields.status, null, 2));

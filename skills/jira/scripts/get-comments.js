#!/usr/bin/env node
/**
 * Get comments for an issue
 *
 * Usage:
 *   node get-comments.js <ISSUE-KEY>
 *   node get-comments.js NC-641
 */

import { createClient } from './jira-client.js';

const issueKey = process.argv[2];

if (!issueKey || issueKey === '-h' || issueKey === '--help') {
  console.log('Usage: node get-comments.js <ISSUE-KEY>');
  console.log('');
  console.log('Examples:');
  console.log('  node get-comments.js NC-641');
  console.log('  node get-comments.js PROJ-100');
  process.exit(issueKey ? 0 : 1);
}

const client = await createClient();
const comments = await client.getComments(issueKey);

console.log(`\n========================================`);
console.log(`Comments for ${issueKey} (${comments.length} total)`);
console.log(`========================================\n`);

if (comments.length === 0) {
  console.log('No comments found.');
} else {
  comments.forEach((comment, idx) => {
    console.log(`[${idx + 1}] ${comment.author.displayName} - ${comment.created}`);
    console.log(`${comment.body}\n`);
    console.log('---');
  });
}

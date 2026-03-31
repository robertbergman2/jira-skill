#!/usr/bin/env node
/**
 * Show issues for current user
 */

import { createClient } from './jira-client.js';

async function main() {
  try {
    const client = await createClient();

    // Get current user
    const user = await client.getCurrentUser();
    console.log(`\n${'='.repeat(100)}`);
    console.log(`Issues for: ${user.displayName} (${user.name})`);
    console.log(`${'='.repeat(100)}\n`);

    // Search for all user's issues
    const jql = 'assignee = currentUser() OR reporter = currentUser() OR watcher = currentUser() ORDER BY updated DESC';
    console.log('Searching for your issues...\n');

    const issues = await client.searchIssues(jql, { maxResults: 100 });

    if (issues.length === 0) {
      console.log('No issues found.\n');
      return;
    }

    console.log(`Found ${issues.length} issue(s):\n`);
    console.log(`${'Key'.padEnd(15)} ${'Summary'.padEnd(55)} ${'Status'.padEnd(15)} ${'Updated'.padEnd(12)}`);
    console.log('-'.repeat(100));

    for (const issue of issues) {
      const key = issue.key;
      const summary = (issue.fields.summary || '').substring(0, 52) + (issue.fields.summary?.length > 52 ? '...' : '');
      const status = issue.fields.status?.name || 'N/A';
      const updated = issue.fields.updated ? new Date(issue.fields.updated).toISOString().split('T')[0] : 'N/A';

      console.log(`${key.padEnd(15)} ${summary.padEnd(55)} ${status.padEnd(15)} ${updated.padEnd(12)}`);
    }

    // Summary by status
    const statusCounts = {};
    for (const issue of issues) {
      const status = issue.fields.status?.name || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }

    console.log(`\n${'='.repeat(100)}`);
    console.log('Summary by Status:');
    console.log(`${'='.repeat(100)}`);

    const sorted = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
    for (const [status, count] of sorted) {
      console.log(`${status.padEnd(30)} ${count.toString().padStart(3)} issue(s)`);
    }

    console.log(`\nTotal: ${issues.length} issue(s)\n`);

  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

main();

#!/usr/bin/env node
/**
 * Generate project report
 */

import { createClient } from './jira-client.js';

async function main() {
  const projectKey = (process.argv[2] || '').toUpperCase();

  if (!projectKey) {
    console.error('Usage: node report.js <project-key>');
    console.error('Example: node report.js NC');
    process.exit(1);
  }

  try {
    const client = await createClient();

    console.log(`\n${'='.repeat(120)}`);
    console.log(`${projectKey} PROJECT - COMPREHENSIVE REPORT`);
    console.log(`${'='.repeat(120)}\n`);

    const user = await client.getCurrentUser();
    console.log(`Report generated for: ${user.displayName} (${user.name})`);
    console.log(`Report date: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}\n`);

    console.log('Fetching all project issues...');
    const jql = `project = ${projectKey} ORDER BY updated DESC`;
    const allIssues = await client.searchIssues(jql, { maxResults: 500 });

    console.log(`Total ${projectKey} issues found: ${allIssues.length}\n`);

    // Categorize
    const byStatus = {};
    const byAssignee = {};
    let myIssuesCount = 0;

    for (const issue of allIssues) {
      const status = issue.fields.status?.name || 'Unknown';
      const assignee = issue.fields.assignee?.displayName || 'Unassigned';

      byStatus[status] = (byStatus[status] || 0) + 1;
      byAssignee[assignee] = (byAssignee[assignee] || 0) + 1;

      // Check if user's issue
      const isAssignee = issue.fields.assignee?.name === user.name;
      const isReporter = issue.fields.reporter?.name === user.name;
      if (isAssignee || isReporter) myIssuesCount++;
    }

    // Executive summary
    console.log(`${'='.repeat(120)}`);
    console.log('1. EXECUTIVE SUMMARY');
    console.log(`${'='.repeat(120)}\n`);

    const doneCount = byStatus['Done'] || 0;
    const cancelledCount = byStatus['Cancelled'] || 0;
    const activeCount = allIssues.length - doneCount - cancelledCount;

    console.log(`Total Issues:     ${allIssues.length}`);
    console.log(`Completed:        ${doneCount} (${Math.round(doneCount * 100 / allIssues.length)}%)`);
    console.log(`Active:           ${activeCount}`);
    console.log(`Your Issues:      ${myIssuesCount}\n`);

    // Status breakdown
    console.log(`${'='.repeat(120)}`);
    console.log('2. BREAKDOWN BY STATUS');
    console.log(`${'='.repeat(120)}\n`);

    console.log(`${'Status'.padEnd(25)} ${'Count'.padEnd(10)} ${'% of Total'.padEnd(15)}`);
    console.log('-'.repeat(50));

    const sortedStatus = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);
    for (const [status, count] of sortedStatus) {
      const pct = Math.round(count * 100 / allIssues.length);
      console.log(`${status.padEnd(25)} ${count.toString().padEnd(10)} ${pct}%`);
    }

    // Top assignees
    console.log(`\n${'='.repeat(120)}`);
    console.log('3. TOP ASSIGNEES');
    console.log(`${'='.repeat(120)}\n`);

    console.log(`${'Assignee'.padEnd(40)} ${'Total'.padEnd(10)}`);
    console.log('-'.repeat(50));

    const sortedAssignees = Object.entries(byAssignee).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [assignee, count] of sortedAssignees) {
      const displayName = assignee.substring(0, 37) + (assignee.length > 37 ? '...' : '');
      console.log(`${displayName.padEnd(40)} ${count.toString().padEnd(10)}`);
    }

    // Recent activity
    console.log(`\n${'='.repeat(120)}`);
    console.log('4. RECENT ACTIVITY (Last 30 days)');
    console.log(`${'='.repeat(120)}\n`);

    const recentJql = `project = ${projectKey} AND updated >= -30d ORDER BY updated DESC`;
    const recentIssues = await client.searchIssues(recentJql, { maxResults: 50 });

    if (recentIssues.length > 0) {
      console.log(`${recentIssues.length} issue(s) updated in last 30 days:\n`);
      console.log(`${'Key'.padEnd(15)} ${'Updated'.padEnd(12)} ${'Status'.padEnd(15)} ${'Summary'.padEnd(60)}`);
      console.log('-'.repeat(102));

      for (const issue of recentIssues.slice(0, 20)) {
        const key = issue.key;
        const updated = issue.fields.updated ? new Date(issue.fields.updated).toISOString().split('T')[0] : 'N/A';
        const status = issue.fields.status?.name || 'N/A';
        const summary = (issue.fields.summary || '').substring(0, 57) + (issue.fields.summary?.length > 57 ? '...' : '');

        console.log(`${key.padEnd(15)} ${updated.padEnd(12)} ${status.padEnd(15)} ${summary.padEnd(60)}`);
      }
    }

    console.log(`\n${'='.repeat(120)}`);
    console.log('END OF REPORT');
    console.log(`${'='.repeat(120)}\n`);

  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

main();

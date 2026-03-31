#!/usr/bin/env node
/**
 * View epic with all child issues
 *
 * Usage:
 *   node epic-view.js NC-687
 *   node epic-view.js NC-687 --show-done
 */

import { createClient } from './jira-client.js';

function parseArgs(args) {
  const opts = {
    epicKey: null,
    showDone: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--show-done' || arg === '-d') {
      opts.showDone = true;
    } else if (!opts.epicKey) {
      opts.epicKey = arg;
    }
  }

  return opts;
}

function printUsage() {
  console.log(`
View Epic with Child Issues

Usage:
  node epic-view.js <EPIC-KEY> [options]

Options:
  -d, --show-done    Include completed/done issues

Examples:
  node epic-view.js NC-687
  node epic-view.js NC-687 --show-done
`);
}

async function viewEpic(opts) {
  try {
    const client = await createClient();

    // Get epic details
    const epic = await client.getIssue(opts.epicKey);

    console.log('');
    console.log('='.repeat(120));
    console.log(`EPIC: ${opts.epicKey} - ${epic.fields.summary}`);
    console.log('='.repeat(120));
    console.log('');
    console.log(`Status:   ${epic.fields.status?.name || 'N/A'}`);
    console.log(`Priority: ${epic.fields.priority?.name || 'N/A'}`);
    console.log(`Assignee: ${epic.fields.assignee?.displayName || 'Unassigned'}`);
    console.log(`Created:  ${epic.fields.created ? new Date(epic.fields.created).toISOString().split('T')[0] : 'N/A'}`);
    console.log('');

    // Search for all issues in this epic
    const jql = `"Epic Link" = ${opts.epicKey} ORDER BY created ASC`;
    const issues = await client.searchIssues(jql, {
      maxResults: 500,
      fields: ['key', 'summary', 'status', 'assignee', 'priority', 'issuetype', 'created', 'updated']
    });

    if (issues.length === 0) {
      console.log('No child issues found for this epic.');
      console.log('');
      console.log('Create tasks with:');
      console.log(`  node create-issue.js -p NC -t Task -s "Task summary" --parent ${opts.epicKey}`);
      console.log('');
      return;
    }

    // Filter out done issues if requested
    let displayIssues = issues;
    if (!opts.showDone) {
      displayIssues = issues.filter(issue =>
        issue.fields.status?.name !== 'Done' &&
        issue.fields.status?.name !== 'Closed' &&
        issue.fields.status?.name !== 'Cancelled'
      );
    }

    console.log('='.repeat(120));
    console.log(`CHILD ISSUES (${displayIssues.length} of ${issues.length} total)`);
    console.log('='.repeat(120));
    console.log('');

    if (displayIssues.length === 0) {
      console.log('All child issues are complete. Use --show-done to see them.');
      console.log('');
      return;
    }

    // Group by status
    const byStatus = {};
    for (const issue of displayIssues) {
      const status = issue.fields.status?.name || 'Unknown';
      if (!byStatus[status]) {
        byStatus[status] = [];
      }
      byStatus[status].push(issue);
    }

    // Display grouped by status
    const statusOrder = ['Open', 'To Do', 'In Progress', 'Review', 'Testing', 'Done', 'Closed', 'Cancelled'];
    const orderedStatuses = statusOrder.filter(s => byStatus[s]);
    const otherStatuses = Object.keys(byStatus).filter(s => !statusOrder.includes(s));
    const allStatuses = [...orderedStatuses, ...otherStatuses];

    for (const status of allStatuses) {
      const tasks = byStatus[status];
      if (!tasks) continue;

      console.log(`${status.toUpperCase()} (${tasks.length})`);
      console.log('-'.repeat(120));

      for (const task of tasks) {
        const icon = getStatusIcon(status);
        const priority = task.fields.priority?.name || 'N/A';
        const assignee = task.fields.assignee?.displayName || 'Unassigned';
        const type = task.fields.issuetype?.name || 'Task';

        console.log(`${icon} ${task.key.padEnd(12)} ${task.fields.summary}`);
        console.log(`   Type: ${type.padEnd(12)} Priority: ${priority.padEnd(12)} Assignee: ${assignee}`);
      }
      console.log('');
    }

    // Summary statistics
    const doneCount = issues.filter(i =>
      i.fields.status?.name === 'Done' ||
      i.fields.status?.name === 'Closed'
    ).length;
    const completionPct = Math.round((doneCount / issues.length) * 100);

    console.log('='.repeat(120));
    console.log('SUMMARY');
    console.log('='.repeat(120));
    console.log('');
    console.log(`Total Issues:  ${issues.length}`);
    console.log(`Completed:     ${doneCount} (${completionPct}%)`);
    console.log(`In Progress:   ${issues.length - doneCount}`);
    console.log('');
    console.log(`View Epic: ${client.url}/browse/${opts.epicKey}`);
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Error viewing epic:', error.message);
    console.error('');
    process.exit(1);
  }
}

function getStatusIcon(status) {
  const icons = {
    'Done': '✅',
    'Closed': '✅',
    'Cancelled': '❌',
    'In Progress': '🔄',
    'Review': '👀',
    'Testing': '🧪',
    'Open': '📋',
    'To Do': '📋'
  };
  return icons[status] || '⬜';
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  printUsage();
  process.exit(0);
}

const opts = parseArgs(args);

if (!opts.epicKey) {
  console.error('❌ Error: Epic key is required');
  console.error('');
  console.error('Usage: node epic-view.js <EPIC-KEY>');
  console.error('Example: node epic-view.js NC-687');
  console.error('');
  process.exit(1);
}

viewEpic(opts);

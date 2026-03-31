#!/usr/bin/env node
/**
 * List all subtasks for a JIRA issue
 */

import { createClient } from './jira-client.js';

async function listSubtasks(issueKey) {
  try {
    const client = await createClient();

    // Get parent issue with subtasks
    const issue = await client.getIssue(issueKey);

    console.log('='.repeat(100));
    console.log(`SUBTASKS FOR: ${issueKey} - ${issue.fields.summary}`);
    console.log('='.repeat(100));
    console.log('');

    const subtasks = issue.fields.subtasks || [];

    if (subtasks.length === 0) {
      console.log('No subtasks found.');
      console.log('');
      console.log('Create subtasks with:');
      console.log(`  node scripts/create-subtask.js ${issueKey} "Task summary"`);
      return;
    }

    console.log(`Found ${subtasks.length} subtask(s):\n`);

    // Group by status
    const byStatus = {};
    for (const subtask of subtasks) {
      const status = subtask.fields.status.name;
      if (!byStatus[status]) {
        byStatus[status] = [];
      }
      byStatus[status].push(subtask);
    }

    // Display grouped by status
    for (const [status, tasks] of Object.entries(byStatus)) {
      console.log(`${status.toUpperCase()} (${tasks.length})`);
      console.log('-'.repeat(100));

      for (const task of tasks) {
        const icon = status === 'Done' ? '✅' : status === 'In Progress' ? '🔄' : '⬜';
        console.log(`${icon} ${task.key} - ${task.fields.summary}`);
      }
      console.log('');
    }

    console.log('='.repeat(100));
    console.log(`View in JIRA: ${client.url}/browse/${issueKey}`);
    console.log('='.repeat(100));

  } catch (error) {
    console.error('❌ Error listing subtasks:', error.message);
    throw error;
  }
}

// CLI usage
const args = process.argv.slice(2);

if (args.length !== 1) {
  console.log('Usage: node list-subtasks.js <ISSUE-KEY>');
  console.log('');
  console.log('Examples:');
  console.log('  node list-subtasks.js NC-641');
  process.exit(1);
}

listSubtasks(args[0]);

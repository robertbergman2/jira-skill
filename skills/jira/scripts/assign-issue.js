#!/usr/bin/env node
/**
 * Assign a JIRA issue to a user
 * Usage:
 *   node assign-issue.js <issue-key> [username]
 *   node assign-issue.js PROJ-123            # Assign to current user
 *   node assign-issue.js PROJ-123 jsmith     # Assign to specific user
 */

import { createClient } from './jira-client.js';

async function assignIssue(issueKey, username = null) {
  try {
    const client = await createClient();

    // If no username provided, use current user
    if (!username) {
      const currentUser = await client.getCurrentUser();
      username = currentUser.name || currentUser.accountId;
    }

    console.log(`Assigning ${issueKey} to ${username}...`);

    // Update assignee field
    await client.updateIssue(issueKey, {
      assignee: { name: username }
    });

    console.log(`✅ Successfully assigned ${issueKey} to ${username}`);
    console.log(`   View: ${client.url}/browse/${issueKey}`);

  } catch (error) {
    console.error(`❌ Error assigning ${issueKey}:`, error.message);
    throw error;
  }
}

// CLI usage
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node assign-issue.js <ISSUE-KEY> [USERNAME]');
  console.log('');
  console.log('Examples:');
  console.log('  node assign-issue.js PROJ-123            # Assign to yourself');
  console.log('  node assign-issue.js PROJ-123 jsmith     # Assign to specific user');
  process.exit(1);
}

const [issueKey, username] = args;

assignIssue(issueKey, username);

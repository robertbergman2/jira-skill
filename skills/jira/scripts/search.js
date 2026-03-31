#!/usr/bin/env node
/**
 * Search JIRA issues with JQL
 *
 * Usage:
 *   node search.js "project = NC AND status = Open"
 *   node search.js "assignee = currentUser() ORDER BY updated DESC"
 *   node search.js "text ~ \"network upgrade\"" --limit 50
 */

import { createClient } from './jira-client.js';

function parseArgs(args) {
  const opts = {
    jql: null,
    maxResults: 100
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--limit' || arg === '-l') {
      opts.maxResults = parseInt(args[i + 1], 10);
      i++;
    } else if (!opts.jql) {
      opts.jql = arg;
    }
  }

  return opts;
}

function printUsage() {
  console.log(`
Search JIRA Issues with JQL

Usage:
  node search.js "<JQL query>" [options]

Options:
  -l, --limit    Maximum results to return (default: 100)

Examples:
  node search.js "project = NC AND status = Open"
  node search.js "assignee = currentUser() ORDER BY updated DESC"
  node search.js "priority in (High, Critical)" --limit 50
  node search.js "text ~ \\"network upgrade\\""
  node search.js "created >= -30d AND project = NC"

Common JQL Patterns:
  assignee = currentUser()                    # Your assigned issues
  reporter = currentUser()                    # Issues you created
  watcher = currentUser()                     # Issues you're watching
  status = Open                               # Open issues
  status IN (Open, "In Progress")             # Multiple statuses
  priority IN (High, Critical)                # High priority
  created >= -7d                              # Created in last 7 days
  updated >= -30d                             # Updated in last 30 days
  text ~ "keyword"                            # Text search
  project = NC AND status = Open              # Project and status
  assignee = currentUser() ORDER BY priority  # Ordered results

JQL Reference:
  https://support.atlassian.com/jira-software-cloud/docs/use-advanced-search-with-jira-query-language-jql/
`);
}

async function searchIssues(opts) {
  try {
    const client = await createClient();

    console.log('');
    console.log('='.repeat(120));
    console.log('JIRA SEARCH');
    console.log('='.repeat(120));
    console.log('');
    console.log(`Query: ${opts.jql}`);
    console.log(`Limit: ${opts.maxResults} results`);
    console.log('');
    console.log('Searching...');

    const issues = await client.searchIssues(opts.jql, { maxResults: opts.maxResults });

    if (issues.length === 0) {
      console.log('');
      console.log('No issues found matching your query.');
      console.log('');
      return;
    }

    console.log('');
    console.log(`Found ${issues.length} issue(s):`);
    console.log('');
    console.log(`${'Key'.padEnd(15)} ${'Summary'.padEnd(60)} ${'Status'.padEnd(15)} ${'Assignee'.padEnd(20)}`);
    console.log('-'.repeat(120));

    for (const issue of issues) {
      const key = issue.key;
      const summary = (issue.fields.summary || '').substring(0, 57) + (issue.fields.summary?.length > 57 ? '...' : '');
      const status = (issue.fields.status?.name || 'N/A').substring(0, 12);
      const assignee = (issue.fields.assignee?.displayName || 'Unassigned').substring(0, 17);

      console.log(`${key.padEnd(15)} ${summary.padEnd(60)} ${status.padEnd(15)} ${assignee.padEnd(20)}`);
    }

    // Summary by status
    const statusCounts = {};
    for (const issue of issues) {
      const status = issue.fields.status?.name || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }

    console.log('');
    console.log('='.repeat(120));
    console.log('Summary by Status:');
    console.log('='.repeat(120));
    console.log('');

    const sorted = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
    for (const [status, count] of sorted) {
      console.log(`${status.padEnd(30)} ${count.toString().padStart(3)} issue(s)`);
    }

    console.log('');
    console.log(`Total: ${issues.length} issue(s)`);
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Error searching issues:', error.message);
    console.error('');
    console.error('Check your JQL syntax and try again.');
    console.error('For help: node search.js --help');
    console.error('');
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  printUsage();
  process.exit(0);
}

const opts = parseArgs(args);

if (!opts.jql) {
  console.error('❌ Error: JQL query is required');
  console.error('');
  console.error('Usage: node search.js "<JQL query>"');
  console.error('Example: node search.js "project = NC AND status = Open"');
  console.error('');
  process.exit(1);
}

searchIssues(opts);

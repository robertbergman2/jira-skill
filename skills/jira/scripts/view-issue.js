#!/usr/bin/env node
/**
 * View detailed issue information
 */

import { createClient } from './jira-client.js';

async function main() {
  const issueKey = process.argv[2];

  if (!issueKey) {
    console.error('Usage: node view-issue.js <issue-key>');
    console.error('Example: node view-issue.js NC-564');
    process.exit(1);
  }

  try {
    const client = await createClient();

    const issue = await client.getIssue(issueKey.toUpperCase());
    const fields = issue.fields;

    console.log(`\n${'='.repeat(100)}`);
    console.log(`ISSUE: ${issue.key}`);
    console.log(`${'='.repeat(100)}\n`);

    console.log(`Summary:     ${fields.summary}`);
    console.log(`Type:        ${fields.issuetype?.name || 'N/A'}`);
    console.log(`Status:      ${fields.status?.name || 'N/A'}`);
    console.log(`Priority:    ${fields.priority?.name || 'N/A'}`);
    console.log(`Project:     ${fields.project?.key} - ${fields.project?.name}`);

    const assignee = fields.assignee;
    console.log(`Assignee:    ${assignee ? assignee.displayName : 'Unassigned'}`);

    const reporter = fields.reporter;
    console.log(`Reporter:    ${reporter ? reporter.displayName : 'N/A'}`);

    if (fields.created) {
      const created = new Date(fields.created);
      console.log(`Created:     ${created.toISOString().replace('T', ' ').substring(0, 19)}`);
    }

    if (fields.updated) {
      const updated = new Date(fields.updated);
      console.log(`Updated:     ${updated.toISOString().replace('T', ' ').substring(0, 19)}`);
    }

    if (fields.duedate) {
      console.log(`Due Date:    ${fields.duedate}`);
    }

    if (fields.labels && fields.labels.length > 0) {
      console.log(`Labels:      ${fields.labels.join(', ')}`);
    }

    if (fields.components && fields.components.length > 0) {
      const components = fields.components.map(c => c.name).join(', ');
      console.log(`Components:  ${components}`);
    }

    if (fields.description) {
      console.log(`\nDescription:`);
      console.log('-'.repeat(100));
      console.log(fields.description);
      console.log('-'.repeat(100));
    }

    if (fields.resolution) {
      console.log(`\nResolution:  ${fields.resolution.name}`);
    }

    // Get comments
    try {
      const comments = await client.getComments(issue.key);
      if (comments.length > 0) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`COMMENTS (${comments.length})`);
        console.log(`${'='.repeat(100)}`);

        for (const comment of comments) {
          const author = comment.author?.displayName || 'Unknown';
          const created = comment.created ? new Date(comment.created).toISOString().replace('T', ' ').substring(0, 16) : '';

          console.log(`\n[${created}] ${author}:`);
          console.log(comment.body);

          if (comment.updated && comment.updated !== comment.created) {
            const updated = new Date(comment.updated).toISOString().replace('T', ' ').substring(0, 16);
            console.log(`(Updated: ${updated})`);
          }
          console.log('-'.repeat(100));
        }
      }
    } catch (error) {
      // Comments might not be accessible
    }

    // Get watchers
    try {
      const watchers = await client.getWatchers(issue.key);
      if (watchers.length > 0) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`WATCHERS (${watchers.length})`);
        console.log(`${'='.repeat(100)}`);
        for (const watcher of watchers) {
          console.log(`  - ${watcher.displayName} (${watcher.name})`);
        }
      }
    } catch (error) {
      // Watchers might not be accessible
    }

    // Get available transitions
    try {
      const transitions = await client.getTransitions(issue.key);
      if (transitions.length > 0) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`AVAILABLE TRANSITIONS`);
        console.log(`${'='.repeat(100)}`);
        for (const transition of transitions) {
          const toStatus = transition.to?.name || 'Unknown';
          console.log(`  - ${transition.name} -> ${toStatus}`);
        }
      }
    } catch (error) {
      // Transitions might not be accessible
    }

    console.log(`\n${'='.repeat(100)}`);
    console.log(`LINKS`);
    console.log(`${'='.repeat(100)}`);
    console.log(`View in JIRA: ${client.url}/browse/${issue.key}\n`);

  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

main();

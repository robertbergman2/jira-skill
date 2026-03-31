#!/usr/bin/env node
/**
 * Update a Jira issue with comments and/or status transitions
 * Usage:
 *   node update-issue.js <issue-key> [options]
 *   node update-issue.js NC-641 --comment "Progress update" --status "In Progress"
 *   node update-issue.js JMX-123 --comment "Completed testing"
 *   node update-issue.js NC-641 --status "Done"
 */

import { createClient } from './jira-client.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0].startsWith('--')) {
    console.error('Usage: update-issue.js <issue-key> [--comment "text"] [--status "status name"] [--resolution "done"] [--time-spent "2h"] [--field customfield_18000=value]');
    console.error('');
    console.error('Examples:');
    console.error('  update-issue.js NC-641 --comment "Progress update"');
    console.error('  update-issue.js NC-641 --status "In Progress"');
    console.error('  update-issue.js NC-641 --status "Done" --resolution done --time-spent 4h');
    console.error('  update-issue.js NC-641 --status "Done" --resolution done --time-spent 4h --field customfield_18000=Maintenance');
    process.exit(1);
  }

  const issueKey = args[0];
  let comment = null;
  let statusName = null;
  let resolution = null;
  let timeSpent = null;
  const customFields = {};

  // Parse arguments
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--comment' && i + 1 < args.length) {
      comment = args[i + 1];
      i++;
    } else if (args[i] === '--status' && i + 1 < args.length) {
      statusName = args[i + 1];
      i++;
    } else if (args[i] === '--resolution' && i + 1 < args.length) {
      resolution = args[i + 1];
      i++;
    } else if (args[i] === '--time-spent' && i + 1 < args.length) {
      timeSpent = args[i + 1];
      i++;
    } else if (args[i] === '--field' && i + 1 < args.length) {
      // Accept key=value pairs: --field customfield_18000=Maintenance
      const eqIdx = args[i + 1].indexOf('=');
      if (eqIdx > 0) {
        const fieldKey = args[i + 1].slice(0, eqIdx);
        const fieldVal = args[i + 1].slice(eqIdx + 1);
        customFields[fieldKey] = { value: fieldVal };
      }
      i++;
    }
  }

  if (!comment && !statusName) {
    console.error('Error: Must provide at least --comment or --status');
    process.exit(1);
  }

  try {
    const client = await createClient();

    console.log(`Updating ${issueKey}...\n`);

    // Add comment if provided
    if (comment) {
      console.log('Adding comment...');
      await client.addComment(issueKey, comment);
      console.log('✓ Comment added\n');
    }

    // Change status if provided
    if (statusName) {
      console.log('Getting available transitions...');
      const transitions = await client.getTransitions(issueKey);

      // Find matching transition
      const targetTransition = transitions.find(t =>
        t.name.toLowerCase() === statusName.toLowerCase() ||
        t.to?.name?.toLowerCase() === statusName.toLowerCase()
      );

      if (targetTransition) {
        console.log(`✓ Found transition: ${targetTransition.name} (ID: ${targetTransition.id})\n`);

        const transitionOptions = {};
        const transitionFields = { ...customFields };
        if (resolution) {
          // Look up the exact resolution name from JIRA (case-insensitive match)
          const resolutions = await client.request('/rest/api/2/resolution');
          const match = resolutions.find(r => r.name.toLowerCase() === resolution.toLowerCase());
          if (match) {
            transitionFields.resolution = { name: match.name };
          } else {
            console.error(`⚠ Unknown resolution "${resolution}". Valid values:`);
            resolutions.forEach(r => console.error(`  - ${r.name} (ID: ${r.id})`));
            process.exit(1);
          }
        }
        if (Object.keys(transitionFields).length > 0) {
          transitionOptions.fields = transitionFields;
        }
        if (timeSpent) {
          transitionOptions.timeSpent = timeSpent;
        }

        console.log(`Transitioning to ${statusName}...`);
        await client.transitionIssue(issueKey, targetTransition.id, transitionOptions);
        console.log(`✓ Status updated to ${statusName}\n`);
      } else {
        console.log(`⚠ Could not find transition to "${statusName}"`);
        console.log('Available transitions:');
        transitions.forEach(t => {
          const toName = t.to?.name || t.name;
          console.log(`  - ${t.name} → ${toName} (ID: ${t.id})`);
        });
        console.log('');
      }
    }

    console.log('✓ Update complete!');
    console.log(`\nView issue: ${client.url}/browse/${issueKey}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();

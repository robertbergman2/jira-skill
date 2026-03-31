#!/usr/bin/env node
/**
 * Create subtasks (todo items) for a JIRA issue
 */

import { createClient } from './jira-client.js';

async function createSubtask(parentKey, summary, description = '') {
  try {
    const client = await createClient();

    // Get parent issue to find project
    const parentIssue = await client.getIssue(parentKey);
    const projectKey = parentIssue.fields.project.key;

    // Get issue types for the project
    const issueTypes = await client.getIssueTypes(projectKey);

    // Find Sub-task issue type
    const subtaskType = issueTypes.find(type =>
      type.name === 'Sub-task' || type.subtask === true
    );

    if (!subtaskType) {
      throw new Error('Sub-task issue type not found for this project');
    }

    // Copy required custom fields from parent
    const customFields = {};

    // Application or Service (customfield_17900)
    if (parentIssue.fields.customfield_17900) {
      customFields.customfield_17900 = parentIssue.fields.customfield_17900;
    }

    // IT SR Category (customfield_18000)
    if (parentIssue.fields.customfield_18000) {
      customFields.customfield_18000 = { id: parentIssue.fields.customfield_18000.id };
    }

    // Create subtask with Normal priority by default (ID: 10301)
    const subtaskData = {
      project: { key: projectKey },
      parent: { key: parentKey },
      summary: summary,
      description: description,
      issuetype: { id: subtaskType.id },
      priority: { id: '10301' }, // Normal priority - only change if user explicitly requests
      ...customFields
    };

    const result = await client.createIssue(subtaskData);

    console.log(`✅ Created subtask: ${result.key}`);
    console.log(`   Summary: ${summary}`);
    console.log(`   Parent: ${parentKey}`);
    console.log(`   View: ${client.url}/browse/${result.key}`);

    return result;

  } catch (error) {
    console.error('❌ Error creating subtask:', error.message);
    throw error;
  }
}

// CLI usage
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: node create-subtask.js <PARENT-KEY> <SUMMARY> [DESCRIPTION]');
  console.log('');
  console.log('Examples:');
  console.log('  node create-subtask.js NC-641 "Configure Prometheus alerts"');
  console.log('  node create-subtask.js NC-641 "Test automation workflow" "Verify that automated shutdowns work correctly"');
  process.exit(1);
}

const [parentKey, summary, description] = args;

createSubtask(parentKey, summary, description || '');

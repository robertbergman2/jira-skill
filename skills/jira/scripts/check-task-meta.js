#!/usr/bin/env node
/**
 * Check available fields and priorities for issue creation in a project
 *
 * Usage:
 *   node check-task-meta.js <PROJECT-KEY> [ISSUE-TYPE]
 *   node check-task-meta.js NC
 *   node check-task-meta.js NC Epic
 */

import { createClient } from './jira-client.js';

async function checkTaskMeta(projectKey, issueTypeName) {
  const client = await createClient();

  const meta = await client.request(
    `/rest/api/2/issue/createmeta?projectKeys=${projectKey}&issuetypeNames=${issueTypeName}&expand=projects.issuetypes.fields`
  );

  const issueType = meta.projects[0]?.issuetypes?.find(it => it.name === issueTypeName);

  if (!issueType) {
    console.log(`Issue type "${issueTypeName}" not found in project ${projectKey}.`);
    console.log('Available issue types:');
    meta.projects[0]?.issuetypes?.forEach(it => {
      console.log(`  - ${it.name}`);
    });
    return;
  }

  const fields = issueType.fields;

  if (fields?.priority) {
    console.log(`Available priorities for ${issueTypeName} in ${projectKey}:`);
    fields.priority.allowedValues.forEach(p => {
      console.log(`  - ${p.name} (id: ${p.id})`);
    });
  }

  if (fields?.issuetype) {
    console.log(`\nIssue type: ${fields.issuetype.name}`);
  }

  console.log(`\nRequired fields:`);
  for (const [key, field] of Object.entries(fields)) {
    if (field.required) {
      console.log(`  - ${key}: ${field.name}`);
    }
  }
}

// Main
const projectKey = process.argv[2];
const issueType = process.argv[3] || 'Task';

if (!projectKey || projectKey === '-h' || projectKey === '--help') {
  console.log('Usage: node check-task-meta.js <PROJECT-KEY> [ISSUE-TYPE]');
  console.log('');
  console.log('Shows available priorities and required fields for issue creation.');
  console.log('');
  console.log('Arguments:');
  console.log('  PROJECT-KEY   Project key (required)');
  console.log('  ISSUE-TYPE    Issue type name (default: Task)');
  console.log('');
  console.log('Examples:');
  console.log('  node check-task-meta.js NC');
  console.log('  node check-task-meta.js NC Epic');
  console.log('  node check-task-meta.js PROJ Bug');
  process.exit(projectKey ? 0 : 1);
}

checkTaskMeta(projectKey, issueType);

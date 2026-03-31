#!/usr/bin/env node
/**
 * Check custom fields on an issue
 */

import { createClient } from './jira-client.js';

async function checkFields(issueKey) {
  try {
    const client = await createClient();
    const issue = await client.getIssue(issueKey);

    console.log(`Custom fields for ${issueKey}:`);
    console.log('customfield_17900 (Application or Service):', issue.fields.customfield_17900);
    console.log('customfield_18000 (IT SR Category):', issue.fields.customfield_18000);
    console.log('');
    console.log('All custom fields starting with customfield_17 or customfield_18:');

    for (const [key, value] of Object.entries(issue.fields)) {
      if (key.startsWith('customfield_17') || key.startsWith('customfield_18')) {
        console.log(`${key}:`, JSON.stringify(value, null, 2));
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.log('Usage: node check-fields.js <ISSUE-KEY>');
  process.exit(1);
}

checkFields(args[0]);

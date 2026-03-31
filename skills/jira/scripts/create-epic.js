#!/usr/bin/env node
/**
 * Create an Epic in JIRA
 *
 * Usage:
 *   node create-epic.js --project NC --summary "Epic summary" --description "Description"
 *   node create-epic.js -p NC -s "Epic summary" -d "Description"
 *   node create-epic.js -p NC -s "Epic summary" --desc-file description.md
 *
 * Options:
 *   -p, --project      Project key (required)
 *   -s, --summary      Epic summary (required)
 *   -n, --epic-name    Epic name (defaults to summary)
 *   -d, --description  Epic description (inline)
 *   --desc-file        Read description from file
 *   --app-service      Application/Service ID (default: 1182)
 *   --category         IT SR Category (default: Enhancement)
 *   --priority         Priority ID (default: 10301 for Normal)
 *   --assignee         Assignee username
 */

import { createClient } from './jira-client.js';
import fs from 'fs';

function parseArgs(args) {
  const opts = {
    project: null,
    summary: null,
    epicName: null,
    description: '',
    descFile: null,
    appService: '1182',
    category: 'Enhancement',
    priority: '10301',
    assignee: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '-p':
      case '--project':
        opts.project = next;
        i++;
        break;
      case '-s':
      case '--summary':
        opts.summary = next;
        i++;
        break;
      case '-n':
      case '--epic-name':
        opts.epicName = next;
        i++;
        break;
      case '-d':
      case '--description':
        opts.description = next;
        i++;
        break;
      case '--desc-file':
        opts.descFile = next;
        i++;
        break;
      case '--app-service':
        opts.appService = next;
        i++;
        break;
      case '--category':
        opts.category = next;
        i++;
        break;
      case '--priority':
        opts.priority = next;
        i++;
        break;
      case '--assignee':
        opts.assignee = next;
        i++;
        break;
    }
  }

  return opts;
}

function printUsage() {
  console.log(`
Create JIRA Epic

Usage:
  node create-epic.js --project NC --summary "Epic summary" --description "Description"
  node create-epic.js -p NC -s "Epic summary" -d "Description"
  node create-epic.js -p NC -s "Epic summary" --desc-file description.md

Options:
  -p, --project      Project key (required)
  -s, --summary      Epic summary (required)
  -n, --epic-name    Epic name field (defaults to summary)
  -d, --description  Epic description (inline)
  --desc-file        Read description from file
  --app-service      Application/Service ID (default: 1182)
  --category         IT SR Category (default: Enhancement)
  --priority         Priority ID (default: 10301 for Normal)
  --assignee         Assignee username

Priority IDs:
  10301 - Normal (default)
  10001 - High
  10002 - Medium
  10003 - Low
  2     - Critical
  1     - Blocker

Examples:
  node create-epic.js -p NC -s "Network Upgrade Q2" -d "Upgrade all core switches"
  node create-epic.js -p NC -s "Security Hardening" --desc-file ./epic-plan.md --priority 10001
`);
}

async function createEpic(opts) {
  try {
    const client = await createClient();

    let description = opts.description;
    if (opts.descFile) {
      if (!fs.existsSync(opts.descFile)) {
        throw new Error(`Description file not found: ${opts.descFile}`);
      }
      description = fs.readFileSync(opts.descFile, 'utf8');
    }

    const epicData = {
      project: { key: opts.project },
      summary: opts.summary,
      customfield_11501: opts.epicName || opts.summary,
      description: description,
      issuetype: { name: 'Epic' },
      priority: { id: opts.priority },
      customfield_17900: [opts.appService],
      customfield_18000: { value: opts.category }
    };

    if (opts.assignee) {
      epicData.assignee = { name: opts.assignee };
    }

    console.log(`Creating Epic in ${opts.project}...`);

    const result = await client.createIssue(epicData);

    console.log('');
    console.log(`✅ Epic created: ${result.key}`);
    console.log(`   Summary: ${opts.summary}`);
    console.log(`   Project: ${opts.project}`);
    console.log(`   View: ${client.url}/browse/${result.key}`);

    return result;

  } catch (error) {
    console.error('❌ Error creating epic:', error.message);
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

if (!opts.project) {
  console.error('❌ Error: --project is required');
  process.exit(1);
}

if (!opts.summary) {
  console.error('❌ Error: --summary is required');
  process.exit(1);
}

createEpic(opts);

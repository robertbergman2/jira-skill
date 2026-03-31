#!/usr/bin/env node
/**
 * Create a JIRA issue (Task, Bug, Story, etc.)
 *
 * Usage:
 *   node create-issue.js --project NC --type Task --summary "Summary" --description "Description"
 *   node create-issue.js -p NC -t Task -s "Summary" -d "Description"
 *   node create-issue.js -p NC -t Task -s "Summary" --desc-file description.md
 *
 * Options:
 *   -p, --project      Project key (required)
 *   -t, --type         Issue type: Task, Bug, Story, etc. (default: Task)
 *   -s, --summary      Issue summary (required)
 *   -d, --description  Issue description (inline)
 *   --desc-file        Read description from file
 *   --app-service      Application/Service ID (default: 1182 for Network)
 *   --category         IT SR Category: Enhancement, Maintenance, etc. (default: Maintenance)
 *   --priority         Priority ID (default: 10301 for Normal)
 *   --assignee         Assignee username
 *   --parent           Parent issue key (for subtasks)
 */

import { createClient } from './jira-client.js';
import fs from 'fs';

function parseArgs(args) {
  const opts = {
    project: null,
    type: 'Task',
    summary: null,
    description: '',
    descFile: null,
    appService: '1182',  // Network (default)
    category: 'Maintenance',
    priority: '10301',  // Normal
    assignee: null,
    parent: null
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
      case '-t':
      case '--type':
        opts.type = next;
        i++;
        break;
      case '-s':
      case '--summary':
        opts.summary = next;
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
      case '--parent':
        opts.parent = next;
        i++;
        break;
    }
  }

  return opts;
}

function printUsage() {
  console.log(`
Create JIRA Issue

Usage:
  node create-issue.js --project NC --type Task --summary "Summary" --description "Description"
  node create-issue.js -p NC -t Task -s "Summary" -d "Description"
  node create-issue.js -p NC -t Task -s "Summary" --desc-file description.md

Options:
  -p, --project      Project key (required)
  -t, --type         Issue type: Task, Bug, Story, Epic (default: Task)
  -s, --summary      Issue summary (required)
  -d, --description  Issue description (inline)
  --desc-file        Read description from file
  --app-service      Application/Service ID (default: 1182 for Network)
  --category         IT SR Category: Enhancement, Maintenance, etc. (default: Maintenance)
  --priority         Priority ID (default: 10301 for Normal)
  --assignee         Assignee username
  --parent           Parent issue key (for subtasks)

Common App/Service IDs:
  1182 - Network

Common Categories:
  Enhancement, Maintenance, Incident, Request

Priority IDs:
  10301 - Normal (default)
  10001 - High
  10002 - Medium
  10003 - Low
  2     - Critical
  1     - Blocker

Examples:
  node create-issue.js -p NC -t Task -s "Configure new VLAN" -d "Set up VLAN 100 for dev team"
  node create-issue.js -p NC -t Bug -s "Fix routing issue" --category Incident --priority 10001
  node create-issue.js -p NC -t Task -s "Document network" --desc-file ./network-doc.md
`);
}

async function createIssue(opts) {
  try {
    const client = await createClient();

    // Load description from file if specified
    let description = opts.description;
    if (opts.descFile) {
      if (!fs.existsSync(opts.descFile)) {
        throw new Error(`Description file not found: ${opts.descFile}`);
      }
      description = fs.readFileSync(opts.descFile, 'utf8');
    }

    // Build issue data
    const issueData = {
      project: { key: opts.project },
      issuetype: { name: opts.type },
      summary: opts.summary,
      description: description,
      priority: { id: opts.priority },
      customfield_17900: [opts.appService],  // Application or Service
      customfield_18000: { value: opts.category }  // IT SR Category
    };

    // Add assignee if specified
    if (opts.assignee) {
      issueData.assignee = { name: opts.assignee };
    }

    // Add parent for subtasks
    if (opts.parent) {
      issueData.parent = { key: opts.parent };
    }

    // Handle Epic-specific fields
    if (opts.type.toLowerCase() === 'epic') {
      issueData.customfield_11501 = opts.summary;  // Epic Name
    }

    console.log(`Creating ${opts.type} in ${opts.project}...`);

    const result = await client.createIssue(issueData);

    console.log('');
    console.log(`✅ Created ${opts.type}: ${result.key}`);
    console.log(`   Summary: ${opts.summary}`);
    console.log(`   Project: ${opts.project}`);
    console.log(`   Type: ${opts.type}`);
    console.log(`   View: ${client.url}/browse/${result.key}`);

    return result;

  } catch (error) {
    console.error('❌ Error creating issue:', error.message);
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

// Validate required fields
if (!opts.project) {
  console.error('❌ Error: --project is required');
  process.exit(1);
}

if (!opts.summary) {
  console.error('❌ Error: --summary is required');
  process.exit(1);
}

createIssue(opts);

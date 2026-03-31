#!/usr/bin/env node
/**
 * Update JIRA Issue Description
 *
 * Usage:
 *   node update-description.js <issue-key> --description "New description"
 *   node update-description.js <issue-key> --file description.txt
 *   echo "Description" | node update-description.js <issue-key> --stdin
 *
 * Examples:
 *   node update-description.js NC-688 --description "Updated description text"
 *   node update-description.js NC-688 --file /path/to/description.md
 *   cat description.txt | node update-description.js NC-688 --stdin
 */

import { createClient } from './jira-client.js';
import fs from 'fs';
import path from 'path';

function printUsage() {
  console.log(`
Update JIRA Issue Description

Usage:
  node update-description.js <issue-key> --description "New description"
  node update-description.js <issue-key> --file <path>
  echo "text" | node update-description.js <issue-key> --stdin

Arguments:
  <issue-key>              JIRA issue key (e.g., NC-688, PROJ-123)

Options:
  --description, -d <text> Description text (inline)
  --file, -f <path>        Read description from file
  --stdin                  Read description from stdin
  --append                 Append to existing description instead of replacing
  --prepend                Prepend to existing description instead of replacing
  --help, -h               Show this help message

Examples:
  # Update with inline text
  node update-description.js NC-688 -d "This is the new description"

  # Update from a file
  node update-description.js NC-688 --file ./description.md

  # Update from stdin (useful for piping)
  cat description.txt | node update-description.js NC-688 --stdin

  # Append to existing description
  node update-description.js NC-688 -d "Additional info" --append

  # Prepend to existing description
  node update-description.js NC-688 -d "Important notice" --prepend

Notes:
  - Description supports JIRA wiki markup (h1., h2., {code}, ||table||, etc.)
  - For long descriptions, using --file or --stdin is recommended
  - The --append and --prepend options preserve existing content
`);
}

async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';

    // Check if stdin is a TTY (interactive terminal)
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);

    // Timeout after 5 seconds if no data
    setTimeout(() => {
      if (!data) {
        resolve('');
      }
    }, 5000);
  });
}

function parseArgs(args) {
  const result = {
    issueKey: null,
    description: null,
    file: null,
    stdin: false,
    append: false,
    prepend: false,
    help: false
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--description' || arg === '-d') {
      result.description = args[++i];
    } else if (arg === '--file' || arg === '-f') {
      result.file = args[++i];
    } else if (arg === '--stdin') {
      result.stdin = true;
    } else if (arg === '--append') {
      result.append = true;
    } else if (arg === '--prepend') {
      result.prepend = true;
    } else if (!arg.startsWith('-') && !result.issueKey) {
      result.issueKey = arg.toUpperCase();
    }

    i++;
  }

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.issueKey) {
    console.error('Error: Issue key is required');
    console.error('Usage: node update-description.js <issue-key> --description "text"');
    console.error('Run with --help for more options');
    process.exit(1);
  }

  // Validate issue key format
  if (!/^[A-Z]+-\d+$/.test(args.issueKey)) {
    console.error(`Error: Invalid issue key format: ${args.issueKey}`);
    console.error('Expected format: PROJECT-123 (e.g., NC-688)');
    process.exit(1);
  }

  // Get description from one of the sources
  let newDescription = null;

  if (args.description) {
    newDescription = args.description;
  } else if (args.file) {
    try {
      const filePath = path.resolve(args.file);
      newDescription = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error(`Error reading file: ${error.message}`);
      process.exit(1);
    }
  } else if (args.stdin) {
    newDescription = await readStdin();
    if (!newDescription.trim()) {
      console.error('Error: No input received from stdin');
      process.exit(1);
    }
  }

  if (!newDescription) {
    console.error('Error: Description is required');
    console.error('Provide via --description, --file, or --stdin');
    console.error('Run with --help for more options');
    process.exit(1);
  }

  try {
    const client = await createClient();

    // If appending or prepending, get current description first
    if (args.append || args.prepend) {
      console.log(`Fetching current description for ${args.issueKey}...`);
      const issue = await client.getIssue(args.issueKey);
      const currentDescription = issue.fields.description || '';

      if (args.append) {
        newDescription = currentDescription + '\n\n' + newDescription;
      } else if (args.prepend) {
        newDescription = newDescription + '\n\n' + currentDescription;
      }
    }

    console.log(`Updating description for ${args.issueKey}...`);

    await client.updateIssue(args.issueKey, {
      description: newDescription
    });

    console.log(`✅ ${args.issueKey} description updated successfully!`);
    console.log('');
    console.log(`View in JIRA: ${process.env.JIRA_URL}/browse/${args.issueKey}`);

  } catch (error) {
    if (error.message.includes('404')) {
      console.error(`Error: Issue ${args.issueKey} not found`);
    } else if (error.message.includes('401') || error.message.includes('403')) {
      console.error('Error: Authentication failed or insufficient permissions');
    } else {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

main();

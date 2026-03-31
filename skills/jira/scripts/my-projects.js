#!/usr/bin/env node
/**
 * Show projects where user has issues
 */

import { createClient } from './jira-client.js';

async function main() {
  try {
    const client = await createClient();

    const user = await client.getCurrentUser();
    console.log(`\n${'='.repeat(100)}`);
    console.log(`Projects for: ${user.displayName} (${user.name})`);
    console.log(`${'='.repeat(100)}\n`);

    console.log('Searching for projects with your issues...');
    console.log('(This may take a minute...)\n');

    const projects = await client.getMyProjects();

    if (projects.length === 0) {
      console.log('No projects found with your issues.\n');
      return;
    }

    // Sort by total issues descending
    projects.sort((a, b) => b.total - a.total);

    console.log(`Found ${projects.length} project(s) with your issues:\n`);
    console.log(`${'Key'.padEnd(15)} ${'Name'.padEnd(40)} ${'Assigned'.padEnd(10)} ${'Reported'.padEnd(10)} ${'Watching'.padEnd(10)} ${'Total'.padEnd(10)}`);
    console.log('-'.repeat(105));

    for (const proj of projects) {
      const name = proj.name.substring(0, 37) + (proj.name.length > 37 ? '...' : '');
      console.log(
        `${proj.key.padEnd(15)} ${name.padEnd(40)} ` +
        `${proj.assigned.toString().padEnd(10)} ${proj.reported.toString().padEnd(10)} ` +
        `${proj.watching.toString().padEnd(10)} ${proj.total.toString().padEnd(10)}`
      );
    }

    // Summary
    const totalAssigned = projects.reduce((sum, p) => sum + p.assigned, 0);
    const totalReported = projects.reduce((sum, p) => sum + p.reported, 0);
    const totalWatching = projects.reduce((sum, p) => sum + p.watching, 0);
    const totalUnique = projects.reduce((sum, p) => sum + p.total, 0);

    console.log(`\n${'='.repeat(105)}`);
    console.log('Summary:');
    console.log(`${'='.repeat(105)}`);
    console.log(`Total Projects: ${projects.length}`);
    console.log(`Total Issues (unique): ${totalUnique}`);
    console.log(`  - Assigned to you: ${totalAssigned}`);
    console.log(`  - Created by you: ${totalReported}`);
    console.log(`  - Watching: ${totalWatching}\n`);

  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

main();

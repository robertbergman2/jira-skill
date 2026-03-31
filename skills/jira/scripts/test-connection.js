#!/usr/bin/env node
/**
 * Test JIRA API connection and authentication
 *
 * Usage:
 *   node test-connection.js
 */

import { createClient } from './jira-client.js';

async function testConnection() {
  console.log('Testing JIRA API connection...\n');

  const client = await createClient();

  console.log('Configuration:');
  console.log(`  Base URL: ${client.url}`);
  console.log(`  API Version: ${client.apiVersion}`);
  console.log(`  Auth Type: ${client.usePAT ? 'PAT' : 'Basic'}`);
  console.log(`  Is Cloud: ${client.isCloud}\n`);

  try {
    console.log('Testing GET /rest/api/2/myself...');
    const user = await client.getCurrentUser();
    console.log(`✓ Success! Logged in as: ${user.displayName} (${user.name})\n`);

    console.log('Testing project listing...');
    const projects = await client.listProjects();
    console.log(`✓ Success! Found ${projects.length} project(s)\n`);

    console.log('All tests passed! API connection is working.');

  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('\nFull error:', error);
  }
}

testConnection();

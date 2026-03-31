#!/usr/bin/env node
import { createClient } from './jira-client.js';

async function checkPriorities() {
  const client = await createClient();
  const priorities = await client.getPriorities();
  console.log('Available priorities:');
  priorities.forEach(p => {
    console.log(`- ${p.name} (id: ${p.id})`);
  });
}

checkPriorities();

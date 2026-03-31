#!/usr/bin/env node
/**
 * JIRA API Client Library
 * Supports both JIRA Cloud (API v3) and Server/Data Center (API v2)
 */

import fs from 'fs';
import os from 'os';

function loadAgentSettingsEnv() {
  const settingsPath = `${os.homedir()}/.agent/settings.json`;

  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.env || {};
  } catch {
    return {};
  }
}

/**
 * Load JIRA configuration from environment variables
 * Set in ~/.claude/settings.json env section
 */
export function loadConfig() {
  const settingsEnv = loadAgentSettingsEnv();
  const url = process.env.JIRA_URL || settingsEnv.JIRA_URL;
  const email = process.env.JIRA_EMAIL || settingsEnv.JIRA_EMAIL || '';
  const token = process.env.JIRA_TOKEN || settingsEnv.JIRA_TOKEN;
  const rawUsePAT = process.env.JIRA_USE_PAT ?? settingsEnv.JIRA_USE_PAT;
  const usePAT = rawUsePAT !== 'false';

  if (!url || !token) {
    throw new Error(
      'JIRA configuration not found in environment variables or ~/.agent/settings.json.\n\n' +
      'Please add to ~/.agent/settings.json:\n' +
      '{\n' +
      '  "env": {\n' +
      '    "JIRA_URL": "https://your-jira-instance.example.com",\n' +
      '    "JIRA_EMAIL": "your.email@example.com",\n' +
      '    "JIRA_TOKEN": "your_personal_access_token",\n' +
      '    "JIRA_USE_PAT": "true"\n' +
      '  }\n' +
      '}'
    );
  }

  return {
    url: url.replace(/\/$/, ''), // Remove trailing slash
    email,
    token,
    usePAT
  };
}

/**
 * JIRA API Client
 */
export class JiraClient {
  constructor(config) {
    this.url = config.url;
    this.email = config.email;
    this.token = config.token;
    this.usePAT = config.usePAT;
    this.isCloud = this.url.includes('.atlassian.net');
    this.apiVersion = this.isCloud ? '3' : '2';

    // Setup headers
    this.headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    if (this.usePAT && !this.isCloud) {
      // Personal Access Token for Server/DC
      this.headers['Authorization'] = `Bearer ${this.token}`;
    } else {
      // Basic auth for Cloud or Server with password
      const auth = Buffer.from(`${this.email}:${this.token}`).toString('base64');
      this.headers['Authorization'] = `Basic ${auth}`;
    }
  }

  /**
   * Make API request
   */
  async request(endpoint, options = {}) {
    const url = `${this.url}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers
      }
    };

    if (typeof fetch !== 'function') {
      throw new Error('Global fetch is not available. Use Node.js 18 or newer.');
    }

    const response = await fetch(url, config);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    // Some endpoints return 204 No Content
    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    return this.request(`/rest/api/${this.apiVersion}/myself`);
  }

  /**
   * List all projects
   */
  async listProjects() {
    if (this.isCloud) {
      // Cloud uses paginated search
      const allProjects = [];
      let startAt = 0;
      const maxResults = 50;

      while (true) {
        const data = await this.request(
          `/rest/api/3/project/search?startAt=${startAt}&maxResults=${maxResults}`
        );

        allProjects.push(...data.values);

        if (data.isLast) break;
        startAt += maxResults;
      }

      return allProjects;
    } else {
      // Server/DC returns all projects
      return this.request(`/rest/api/2/project`);
    }
  }

  /**
   * Get specific project
   */
  async getProject(projectKey) {
    return this.request(`/rest/api/${this.apiVersion}/project/${projectKey}`);
  }

  /**
   * Search issues with JQL
   */
  async searchIssues(jql, options = {}) {
    const maxResults = options.maxResults || 100;
    const fields = options.fields || ['key', 'summary', 'status', 'assignee', 'reporter', 'created', 'updated', 'project', 'issuetype', 'priority'];

    const allIssues = [];
    let startAt = 0;
    const batchSize = 100;

    while (startAt < maxResults) {
      const params = new URLSearchParams({
        jql,
        startAt: startAt.toString(),
        maxResults: Math.min(batchSize, maxResults - startAt).toString(),
        fields: fields.join(',')
      });

      const data = await this.request(`/rest/api/${this.apiVersion}/search?${params}`);

      allIssues.push(...data.issues);

      if (startAt + data.issues.length >= data.total || allIssues.length >= maxResults) {
        break;
      }

      startAt += data.issues.length;
    }

    return allIssues;
  }

  /**
   * Get specific issue
   */
  async getIssue(issueKey) {
    return this.request(`/rest/api/${this.apiVersion}/issue/${issueKey}`);
  }

  /**
   * Create issue
   */
  async createIssue(data) {
    return this.request(`/rest/api/${this.apiVersion}/issue`, {
      method: 'POST',
      body: JSON.stringify({ fields: data })
    });
  }

  /**
   * Update issue
   */
  async updateIssue(issueKey, data) {
    return this.request(`/rest/api/${this.apiVersion}/issue/${issueKey}`, {
      method: 'PUT',
      body: JSON.stringify({ fields: data })
    });
  }

  /**
   * Get issue comments
   */
  async getComments(issueKey) {
    const data = await this.request(`/rest/api/${this.apiVersion}/issue/${issueKey}/comment`);
    return data.comments || [];
  }

  /**
   * Add comment
   */
  async addComment(issueKey, comment) {
    return this.request(`/rest/api/${this.apiVersion}/issue/${issueKey}/comment`, {
      method: 'POST',
      body: JSON.stringify({ body: comment })
    });
  }

  /**
   * Get available transitions
   */
  async getTransitions(issueKey) {
    const data = await this.request(`/rest/api/${this.apiVersion}/issue/${issueKey}/transitions`);
    return data.transitions || [];
  }

  /**
   * Transition issue
   */
  async transitionIssue(issueKey, transitionId, options = {}) {
    const payload = {
      transition: { id: transitionId }
    };

    if (options.fields) {
      payload.fields = options.fields;
    }

    const update = {};
    if (options.comment) {
      update.comment = [{ add: { body: options.comment } }];
    }
    if (options.timeSpent) {
      update.worklog = [{ add: { timeSpent: options.timeSpent } }];
    }
    if (Object.keys(update).length > 0) {
      payload.update = update;
    }

    return this.request(`/rest/api/${this.apiVersion}/issue/${issueKey}/transitions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Get watchers
   */
  async getWatchers(issueKey) {
    const data = await this.request(`/rest/api/${this.apiVersion}/issue/${issueKey}/watchers`);
    return data.watchers || [];
  }

  /**
   * Add watcher
   */
  async addWatcher(issueKey, username) {
    return this.request(`/rest/api/${this.apiVersion}/issue/${issueKey}/watchers`, {
      method: 'POST',
      body: JSON.stringify(username)
    });
  }

  /**
   * Get projects where current user has issues
   */
  async getMyProjects() {
    const jqlQueries = [
      'assignee = currentUser()',
      'reporter = currentUser()',
      'watcher = currentUser()'
    ];

    const projectsMap = new Map();

    for (const jql of jqlQueries) {
      try {
        const issues = await this.searchIssues(jql, { maxResults: 10000 });

        for (const issue of issues) {
          const project = issue.fields.project;
          const key = project.key;

          if (!projectsMap.has(key)) {
            projectsMap.set(key, {
              key,
              name: project.name,
              assigned: 0,
              reported: 0,
              watching: 0,
              totalUnique: new Set()
            });
          }

          const proj = projectsMap.get(key);
          proj.totalUnique.add(issue.key);

          if (jql.includes('assignee')) proj.assigned++;
          if (jql.includes('reporter')) proj.reported++;
          if (jql.includes('watcher')) proj.watching++;
        }
      } catch (error) {
        console.error(`Error with JQL "${jql}":`, error.message);
      }
    }

    // Convert to array and add total
    return Array.from(projectsMap.values()).map(proj => ({
      key: proj.key,
      name: proj.name,
      assigned: proj.assigned,
      reported: proj.reported,
      watching: proj.watching,
      total: proj.totalUnique.size
    }));
  }

  /**
   * Get issue types for a project
   */
  async getIssueTypes(projectKey) {
    const project = await this.getProject(projectKey);
    return project.issueTypes || [];
  }

  /**
   * Get priorities
   */
  async getPriorities() {
    return this.request(`/rest/api/${this.apiVersion}/priority`);
  }

  /**
   * Add worklog
   */
  async addWorklog(issueKey, timeSpent, comment = null) {
    const payload = { timeSpent };
    if (comment) payload.comment = comment;

    return this.request(`/rest/api/${this.apiVersion}/issue/${issueKey}/worklog`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
}

/**
 * Create and return a configured JIRA client
 */
export async function createClient() {
  const config = loadConfig();
  return new JiraClient(config);
}

# JIRA Skill

A portable JIRA skill that manages issues directly from the command line. Works with any AI agent harness that supports skills (Claude Code, Cline, Aider, custom harnesses, etc.). Built for JIRA Server/Data Center and JIRA Cloud with Personal Access Token authentication.

## What It Does

- **Issue Management** - View, create, update, assign, and close issues with workflow transitions and time tracking
- **Epic Management** - Create epics, view child issues grouped by status, create subtasks, track progress
- **Search** - Full JQL query support from the CLI
- **Project Reports** - Status breakdowns, assignee analytics, recent activity
- **Attachments** - Upload, replace, list, and delete attachments on issues

## Setup

Run the setup script for your platform. It will check for and install prerequisites (Node.js, OpenCode), install skill dependencies, prompt for your JIRA and PNNL credentials, write `~/.agent/settings.json`, and test your JIRA connection.

**macOS / Linux**

```bash
bash setup-opencode-pnnl.sh
```

**Windows (PowerShell)**

```powershell
.\setup-opencode-pnnl.ps1
```

> On Windows, OpenCode runs best inside [WSL](https://learn.microsoft.com/en-us/windows/wsl/install). Open a WSL terminal and use the bash script above for the best experience.

### What the setup script does

1. Checks for Node.js (v18+) and installs it if missing
2. Checks for OpenCode and installs it if missing
3. Installs npm dependencies for the skill
4. Prompts for your JIRA URL, email, Personal Access Token, and PNNL API key
5. Writes JIRA credentials to `~/.agent/settings.json` under the `env` section
6. Configures the OpenCode PNNL provider at `~/.config/opencode/opencode.json`
7. Runs `test-connection.js` to verify the JIRA connection

### Manual configuration

If you prefer to configure manually, add the following to `~/.agent/settings.json`:

```json
{
  "env": {
    "JIRA_URL": "https://your-jira-instance.example.com",
    "JIRA_EMAIL": "your.email@example.com",
    "JIRA_TOKEN": "your_personal_access_token",
    "JIRA_USE_PAT": "true"
  }
}
```

Set `JIRA_USE_PAT` to `"false"` for JIRA Cloud API tokens.

To get your Personal Access Token: go to your organization's JIRA URL, navigate to your Profile, select **Personal Access Tokens**, and create a token.

## Usage

| Command | Description |
|---------|-------------|
| `my-issues` | Show your assigned/reported/watching issues |
| `my-projects` | List projects where you have issues |
| `view-issue <key>` | View detailed issue information |
| `create-issue -p <proj> -s <summary>` | Create a new issue |
| `update-issue <key> --status "Done"` | Update issue status |
| `search "<jql>"` | Search with JQL |
| `report <project>` | Generate project report |
| `epic-view <key>` | View epic with child issues |
| `assign-issue <key>` | Assign issue to yourself |
| `list-subtasks <key>` | List subtasks |
| `manage-attachments <key> --list` | List attachments |
| `manage-attachments <key> <file>` | Upload attachment |

All scripts accept `--help` for full usage details.

## Scripts

All scripts are ES Modules (Node.js) in the `scripts/` directory:

| Script | Purpose |
|--------|---------|
| `jira-client.js` | Core API client library |
| `my-issues.js` | List user's issues |
| `my-projects.js` | List user's projects |
| `view-issue.js` | View issue details |
| `create-issue.js` | Create new issue |
| `create-epic.js` | Create epic |
| `create-subtask.js` | Create subtask |
| `update-issue.js` | Update issue fields/status |
| `update-description.js` | Update issue description |
| `assign-issue.js` | Assign issue |
| `search.js` | JQL search |
| `report.js` | Project report |
| `epic-view.js` | Epic with child issues |
| `view-epic-tasks.js` | Compact epic task list |
| `list-subtasks.js` | List subtasks |
| `manage-attachments.js` | Attachment operations |
| `get-comments.js` | Get issue comments |
| `check-status.js` | Quick status check |
| `check-fields.js` | Inspect custom fields |
| `check-priorities.js` | List priorities |
| `check-task-meta.js` | Show required fields |
| `test-connection.js` | Test API connectivity |

## Integration with Agent Harnesses

The skill is designed to be portable. Each script is a standalone Node.js CLI tool that:

- Reads credentials from environment variables (not hardcoded)
- Accepts arguments via CLI flags
- Returns structured, parseable output
- Can be invoked by any agent harness that can run shell commands

Register the skill by pointing your agent harness at the `SKILL.md` file. Each script is also independently executable from the command line:

```bash
node scripts/my-issues.js
node scripts/view-issue.js NC-123
node scripts/search.js "project = NC AND status = Open" --limit 20
node scripts/create-issue.js -p NC -t Task -s "Summary" -d "Description"
```

## Security

- PAT is injected via environment variables, never passed as inline command arguments
- Credentials never appear in process listings or shell history
- All API calls use HTTPS
- Supports both PAT (Server/DC) and API Token (Cloud) authentication

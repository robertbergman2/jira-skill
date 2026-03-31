---
name: jira
description: Manage JIRA projects and issues including viewing, creating, updating, searching with JQL, generating reports, and tracking epics/tasks. Supports both JIRA Cloud and Server/Data Center with Personal Access Token authentication.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# JIRA Management Skill

Comprehensive JIRA project and issue management through Claude Code.

## Description

This skill enables JIRA management directly from Claude Code, including:
- Project management and reporting
- Issue CRUD operations (Task, Bug, Story, Epic, Sub-task)
- Search and filtering with JQL
- Epic and subtask tracking
- Workflow transitions
- Time tracking and comments

Supports both JIRA Cloud and JIRA Server/Data Center.

## Configuration

This skill requires JIRA configuration in `~/.agent/settings.json` env section:

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

### Locating the Scripts Directory

The scripts live in the `scripts/` subdirectory next to this SKILL.md file. The installation location varies by agent harness — it could be `~/.claude/skills/jira/`, `~/.config/opencode/skills/jira/`, or anywhere else the harness stores skills.

To find the correct path at runtime:

1. Determine where this SKILL.md file is located.
2. The scripts directory is always `<directory containing SKILL.md>/scripts/`.
3. Use that resolved path for all `cd ... && node <script>.js` commands.

**IMPORTANT:** Never hardcode a specific user's home directory or assume a specific harness installation path.

### Default Project (Self-Configuration)

On first use, if `JIRA_DEFAULT_PROJECT` is not set in the harness environment/settings, the skill will:

1. Call `my-projects.js` to list projects where the user has active issues
2. If exactly one project is found — set it automatically
3. If multiple projects are found — ask the user which to use as default
4. If no projects are found — ask the user to provide their project key
5. Write the result into the harness settings (e.g. `~/.claude/settings.json` for Claude Code, `~/.config/opencode/opencode.json` for OpenCode):

```json
{
  "env": {
    "JIRA_DEFAULT_PROJECT": "PROJ"
  }
}
```

Once set, `JIRA_DEFAULT_PROJECT` is used as the implicit project key for any command that requires a project (e.g. `/jira report`, `/jira create`) when the user does not specify one explicitly.

To change the default project later, run `/jira set-project`.

### Project Metadata (Self-Configuration)

On first use with a project, the skill discovers and caches project-specific metadata. This is stored in a file next to this SKILL.md at `project-metadata/<PROJECT_KEY>.md`.

**Discovery flow** (runs automatically when no metadata file exists for the active project):

1. Run `check-task-meta.js <PROJECT_KEY>` to discover:
   - Available issue types
   - Required custom fields and their allowed values
   - Workflow transitions and their IDs
2. Run `check-fields.js` against an existing issue in the project (ask the user for one if needed) to discover:
   - Custom field IDs and formats actually in use
   - Application/Service values
   - IT SR Category values
3. Run `check-priorities.js` to get the full priority list
4. Present the discovered metadata to the user for confirmation
5. Write the confirmed metadata to `project-metadata/<PROJECT_KEY>.md`

Once cached, the skill reads from the metadata file instead of re-discovering. The user can force re-discovery with `/jira discover <PROJECT_KEY>`.

**Metadata file format** (`project-metadata/<PROJECT_KEY>.md`):
```markdown
# <PROJECT_KEY> Project Metadata

## Issue Types
<discovered issue types>

## Custom Fields
<field ID, name, type, required, allowed values>

## Workflow Transitions
<transition ID, name, target status>

## Common Patterns
<project-specific command examples>
```

### Node.js Installation (macOS)

The scripts require Node.js. Install via Homebrew (recommended):

```bash
brew install node
```

Verify installation:

```bash
node --version   # should be v18+
```

### Getting Your Personal Access Token

For JIRA Server/Data Center:
1. Go to your JIRA instance
2. Click your profile -> Profile
3. Select "Personal access tokens"
4. Create a new token
5. Copy the token to settings.json

For JIRA Cloud:
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Create API token
3. Set `JIRA_USE_PAT` to `"false"` in settings

## Usage

### Quick Commands
```
/jira set-project
/jira discover <PROJECT_KEY>
/jira my-issues
/jira my-projects
/jira view PROJ-123
/jira search "project = PROJ AND status = Open"
/jira report PROJ
/jira epic PROJ-100
/jira assign PROJ-123 [username]
/jira subtasks PROJ-123
/jira update-description PROJ-123 "New description text"
/jira update-description PROJ-123 --file description.md
/jira attachments PROJ-123 --list
/jira attachments PROJ-123 file1.md file2.pdf
```

## Instructions

When the user invokes this skill:

1. **Load Configuration**: Read JIRA settings from the harness environment/settings

1a. **Auto-Configure Default Project** (if `JIRA_DEFAULT_PROJECT` is not set):
   - Run `my-projects.js` from the scripts directory
   - If one project is returned -> use it as the default and write it to the harness settings under `env.JIRA_DEFAULT_PROJECT`
   - If multiple projects are returned -> present the list and ask: *"Which project should I use as your default? (You can always override per-command.)"*
   - If no projects are found -> ask: *"I couldn't find any projects with your active issues. What is your JIRA project key? (e.g. NC, PROJ, DEVOPS)"*
   - Once confirmed, write the chosen key to the harness settings
   - For `set-project` command -> force this detection flow even if `JIRA_DEFAULT_PROJECT` is already set

1b. **Auto-Discover Project Metadata** (if no `project-metadata/<PROJECT_KEY>.md` exists):
   - Run the discovery flow described in "Project Metadata (Self-Configuration)" above
   - This ensures the skill knows the project's custom fields, workflows, and issue types before executing commands

2. **Parse Command**: Determine what operation the user wants:
   - No args -> Show available commands
   - `discover <project>` -> Force re-discovery of project metadata
   - `my-issues` -> Show user's assigned/reported/watching issues
   - `my-projects` -> Show projects where user has issues
   - `view <key>` -> Show detailed issue information
   - `create` -> Create new issue with prompts
   - `update <key>` -> Update existing issue
   - `update-description <key>` -> Update issue description
   - `search <jql>` -> Search with JQL query
   - `report <project>` -> Generate project report
   - `epic <key>` -> Show epic with child issues
   - `assign <key> [user]` -> Assign issue to user
   - `subtasks <key>` -> List issue subtasks
   - `attachments <key> --list` -> List attachments on an issue
   - `attachments <key> <file1> [file2 ...]` -> Upload files, replacing any existing same-named attachments
   - `attachments <key> <file> --delete-only` -> Delete an attachment without re-uploading
   - `attachments <key> <file> --keep` -> Upload without removing existing same-named attachment

3. **Execute Operation**: Run the appropriate Node.js script from `scripts/` directory

   **CRITICAL SECURITY RULE**: NEVER pass `JIRA_TOKEN`, `JIRA_URL`, `JIRA_EMAIL`, or any credentials as inline environment variable assignments in the Bash command (e.g., do NOT do `JIRA_TOKEN="abc123" node script.js`). These variables are already injected into the environment by the harness. Always run scripts like this:
   ```bash
   cd <resolved-scripts-dir> && node script.js <args>
   ```
   Passing credentials inline exposes the PAT in the terminal UI and process listings.

4. **Display Results**: Format and present results to the user

5. **Offer Next Actions**: Suggest relevant follow-up actions based on context

## Default Priority Settings

**IMPORTANT**: All newly created JIRA issues (epics, subtasks, tasks) default to **Normal** priority (ID: 10301).

**Priority should only be changed if the user explicitly requests a different priority.**

Use `check-priorities.js` to discover the full list of available priorities for the instance. Common priorities:
- Blocker (ID: 1)
- Critical (ID: 2)
- Major (ID: 3)
- Minor (ID: 4)
- Trivial (ID: 5)
- **Normal (ID: 10301)** <- DEFAULT

**When creating issues:**
- Use `priority: { id: '10301' }` by default
- Only change if user says "create a Critical task" or "set priority to High", etc.
- If user doesn't mention priority, always use Normal (10301)

## Available Scripts

The skill uses these Node.js scripts in the `scripts/` directory:

**IMPORTANT: All scripts are ES Modules (ESM).** They use `import`/`export` syntax and cannot be required with CommonJS `require()`. Always run scripts directly with `node <script>.js`.

All scripts accept CLI arguments and have built-in `--help` flags. No scripts contain hardcoded project keys or issue numbers.

### Core Library
- `jira-client.js` - Core JIRA API client library (exports `loadConfig`, `JiraClient`, `createClient`)

### Issue Management
- `my-issues.js` - List user's assigned/reported/watching issues
- `my-projects.js` - List projects where user has issues
- `view-issue.js <key>` - View detailed issue information
- `create-issue.js -p <project> -s <summary> [-t type] [-d desc]` - Create new issue
- `update-issue.js <key> [--comment text] [--status name]` - Update issue fields and status
- `update-description.js <key> -d <text> | --file <path> | --stdin` - Update issue description
- `assign-issue.js <key> [username]` - Assign issue to user

### Epic Management
- `create-epic.js -p <project> -s <summary> [-d desc] [-n epic-name]` - Create epic
- `epic-view.js <key> [--show-done]` - View epic with all child issues grouped by status
- `view-epic-tasks.js <key>` - View tasks in an epic (compact list)

### Subtask Management
- `create-subtask.js <parent-key> <summary> [description]` - Create subtask for an issue
- `list-subtasks.js <key>` - List all subtasks for an issue

### Search & Reporting
- `search.js <jql> [--limit N]` - Search issues with JQL queries
- `report.js <project-key>` - Generate comprehensive project reports

### Attachment Management
- `manage-attachments.js <key> --list` - List all attachments on an issue
- `manage-attachments.js <key> <file1> [file2 ...]` - Upload files, replacing any existing same-named attachments
- `manage-attachments.js <key> <file> --delete-only` - Delete an existing attachment without re-uploading
- `manage-attachments.js <key> <file> --keep` - Upload without removing existing same-named attachment

### Utilities
- `get-comments.js <key>` - Get comments for an issue
- `check-status.js <key>` - Quick status check for an issue
- `check-fields.js <key>` - Inspect custom fields on an issue
- `check-priorities.js` - List all available priority levels
- `check-task-meta.js <project-key> [issue-type]` - Show required fields and priorities for issue creation
- `view-epic-raw.js <key>` - View raw issue field data as JSON (debugging)
- `test-connection.js` - Test JIRA API connectivity and authentication

### Using the API Client Programmatically

For any operation not covered by the existing scripts, use the `JiraClient` from `jira-client.js` — it reads credentials from environment variables internally and never exposes them in the command line. Do NOT use `curl` with inline credentials.

## Examples

### Example 1: View My Issues
```
User: /jira my-issues
Assistant: [Runs my-issues.js script and displays formatted results]
```

### Example 2: View Specific Issue
```
User: /jira view PROJ-123
Assistant: [Runs view-issue.js with PROJ-123 and shows full details]
```

### Example 3: Generate Report
```
User: /jira report PROJ
Assistant: [Runs report.js for PROJ project and shows comprehensive report]
```

### Example 4: Create Issue
```
User: /jira create
Assistant: [Asks for project, type, summary, description and runs create-issue.js]
```

### Example 5: Create Epic
```
User: /jira create epic in PROJ "Network Upgrade Q2"
Assistant: [Runs create-epic.js -p PROJ -s "Network Upgrade Q2"]
```

### Example 6: Update Issue Description
```
User: /jira update-description PROJ-123 "New description for the issue"
Assistant: [Runs update-description.js and confirms update]
```

### Example 7: Update Description from File
```
User: /jira update-description PROJ-123 --file ./description.md
Assistant: [Reads file and updates PROJ-123 description]
```

### Example 8: Append to Description
```
User: /jira update-description PROJ-123 --append "Additional notes"
Assistant: [Appends text to existing description]
```

### Example 9: Search Issues with JQL
```
User: /jira search "project = PROJ AND status = Open ORDER BY priority DESC"
Assistant: [Runs search.js and displays matching issues with summary by status]
```

### Example 10: View Epic with Child Issues
```
User: /jira epic PROJ-100
Assistant: [Runs epic-view.js and shows epic details with all child issues grouped by status]
```

### Example 11: Assign Issue
```
User: /jira assign PROJ-123
Assistant: [Runs assign-issue.js and assigns to current user]
```

### Example 12: List Subtasks
```
User: /jira subtasks PROJ-123
Assistant: [Runs list-subtasks.js and displays all subtasks grouped by status]
```

### Example 13: List Attachments
```
User: /jira attachments PROJ-123 --list
Assistant: [Runs manage-attachments.js --list and displays all attachments with IDs, sizes, and dates]
```

### Example 14: Upload / Replace Attachments
```
User: /jira attachments PROJ-123 ASSESSMENT.md DEPLOYMENT-PLAN.md report.pdf
Assistant: [Runs manage-attachments.js, deletes any existing same-named attachments, uploads new versions]
```

### Example 15: Delete an Attachment
```
User: /jira attachments PROJ-123 old-report.pdf --delete-only
Assistant: [Runs manage-attachments.js --delete-only and removes the attachment]
```

### Example 16: Discover Project Metadata
```
User: /jira discover PROJ
Assistant: [Runs check-task-meta.js, check-fields.js, check-priorities.js, presents findings, and saves to project-metadata/PROJ.md]
```

## Error Handling

If configuration is missing:
- Guide user to add JIRA settings to their harness configuration (environment variables or settings file)
- Show example configuration

If authentication fails:
- Check token validity
- Verify URL is correct
- Suggest regenerating token

If API errors occur:
- Display helpful error message
- Suggest possible solutions
- Offer to retry

## Tips for Users

- Use JQL for powerful searching
- Bookmark frequently used queries
- Generate reports for project health checks
- Close completed epics to keep projects clean
- Run `/jira discover <PROJECT_KEY>` after switching to a new project to learn its metadata

## Permissions Required

- Browse Projects permission
- Create/Edit Issues permission (for create/update)
- Add Comments permission (for commenting)
- Log Work permission (for time tracking)

## Transition Requirements

### Closing Issues (Done Transition)

**IMPORTANT:** The "Done" transition may require several fields depending on your JIRA instance configuration:

| Field | Required | Notes |
|-------|----------|-------|
| Resolution | Yes | Use "Done" (ID: 7) for completed work |
| IT SR Category | Varies | Check with `check-task-meta.js` |
| Time Spent | Varies | Must log work during transition if required |

**If the user does not provide time spent when closing an issue, ASK them for it before attempting the transition.** The transition may fail without it.

Example prompt:
> "To close PROJ-XXX, I need the time spent on this task. How many hours should I log?"

### Transition API Call

Use the `update-issue.js` script to close issues. It handles resolution, worklog, and custom fields during the transition:
```bash
# Basic close
cd <resolved-scripts-dir> && node update-issue.js PROJ-XXX --status "Done" --resolution done --time-spent 8h

# With custom fields required by transition (discovered via check-task-meta.js)
cd <resolved-scripts-dir> && node update-issue.js PROJ-XXX --status "Done" --resolution done --time-spent 8h --field customfield_XXXXX=Value
```

Use `--field <customfield_id>=<value>` to pass any custom field required by the transition. Multiple `--field` flags are supported.

**NEVER use curl with inline `$JIRA_TOKEN` — this exposes the PAT in the process list.**

## Notes

- All operations use the JIRA REST API
- Personal Access Tokens are recommended for security
- Supports both Cloud (API v3) and Server/DC (API v2)
- Scripts automatically detect instance type from URL
- All scripts accept CLI arguments - no hardcoded project keys or issue numbers
- Project-specific metadata (custom fields, workflows, issue types) is discovered automatically and cached in `project-metadata/` next to this file

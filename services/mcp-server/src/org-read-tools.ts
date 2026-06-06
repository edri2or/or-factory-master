import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { repoGet, orgGet, searchGet, fetchFileContents, ORG } from './github-client.js';

// Org-wide READ tools, consolidated from the retired `org-reader` MCP
// (edri2or/factory, services/org-reader-mcp). These give this single MCP the one
// capability it lacked — reading issues / PRs / code / commits / variables across
// EVERY edri2or repo — using the broker App's org-wide installation token (see
// github-client.ts). The Actions-run tools the org-reader also had
// (list_workflow_runs, get_workflow_run, get_run_jobs, read_github_actions_run_logs,
// get_workflow_run_usage, list_run_artifacts, list_pending_deployments,
// list_workflows) already exist in tools.ts and are intentionally NOT duplicated
// here. `owner` defaults to ORG and is asserted in the client.

const ownerSchema = z
  .string()
  .default(ORG)
  .describe(`Repository owner (must be '${ORG}' — App is scoped to this org)`);

const repoSchema = z.string().describe('Repository name');

export function registerOrgReadTools(server: McpServer): void {
  server.tool(
    'list_repos',
    `List repositories under the ${ORG} org (read-only).`,
    {
      limit: z.number().int().min(1).max(100).optional().default(30),
      type: z.enum(['all', 'public', 'private', 'forks', 'sources', 'member']).optional().default('all'),
    },
    async ({ limit, type }) => {
      const data = (await orgGet(`/repos?per_page=${limit ?? 30}&type=${type ?? 'all'}`)) as unknown[];
      const repos = (data ?? []).map((r: unknown) => {
        const repo = r as Record<string, unknown>;
        return {
          name: repo['name'],
          full_name: repo['full_name'],
          private: repo['private'],
          description: repo['description'],
          html_url: repo['html_url'],
          default_branch: repo['default_branch'],
          updated_at: repo['updated_at'],
          archived: repo['archived'],
        };
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(repos, null, 2) }] };
    },
  );

  server.tool(
    'get_repo',
    'Get metadata for a single repository.',
    { owner: ownerSchema, repo: repoSchema },
    async ({ owner, repo }) => {
      const r = (await repoGet(owner, repo, '')) as Record<string, unknown>;
      const summary = {
        full_name: r['full_name'],
        private: r['private'],
        description: r['description'],
        html_url: r['html_url'],
        default_branch: r['default_branch'],
        topics: r['topics'],
        archived: r['archived'],
        pushed_at: r['pushed_at'],
        open_issues_count: r['open_issues_count'],
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
    },
  );

  server.tool(
    'list_pull_requests',
    'List pull requests for a repo.',
    {
      owner: ownerSchema,
      repo: repoSchema,
      state: z.enum(['open', 'closed', 'all']).optional().default('open'),
      limit: z.number().int().min(1).max(50).optional().default(20),
    },
    async ({ owner, repo, state, limit }) => {
      const data = (await repoGet(owner, repo, `/pulls?state=${state ?? 'open'}&per_page=${limit ?? 20}`)) as unknown[];
      const prs = (data ?? []).map((p: unknown) => {
        const pr = p as Record<string, unknown>;
        return {
          number: pr['number'],
          title: pr['title'],
          state: pr['state'],
          draft: pr['draft'],
          user: (pr['user'] as Record<string, unknown>)?.['login'],
          head: (pr['head'] as Record<string, unknown>)?.['ref'],
          base: (pr['base'] as Record<string, unknown>)?.['ref'],
          html_url: pr['html_url'],
          updated_at: pr['updated_at'],
        };
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(prs, null, 2) }] };
    },
  );

  server.tool(
    'get_pull_request',
    'Get a single pull request with body, head/base, mergeable state.',
    { owner: ownerSchema, repo: repoSchema, pull_number: z.number().int().describe('PR number') },
    async ({ owner, repo, pull_number }) => {
      const pr = (await repoGet(owner, repo, `/pulls/${pull_number}`)) as Record<string, unknown>;
      const summary = {
        number: pr['number'],
        title: pr['title'],
        state: pr['state'],
        draft: pr['draft'],
        body: pr['body'],
        user: (pr['user'] as Record<string, unknown>)?.['login'],
        head: (pr['head'] as Record<string, unknown>)?.['ref'],
        base: (pr['base'] as Record<string, unknown>)?.['ref'],
        mergeable: pr['mergeable'],
        mergeable_state: pr['mergeable_state'],
        comments: pr['comments'],
        review_comments: pr['review_comments'],
        commits: pr['commits'],
        additions: pr['additions'],
        deletions: pr['deletions'],
        changed_files: pr['changed_files'],
        html_url: pr['html_url'],
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
    },
  );

  server.tool(
    'list_pull_request_files',
    'List files changed in a pull request.',
    { owner: ownerSchema, repo: repoSchema, pull_number: z.number().int().describe('PR number') },
    async ({ owner, repo, pull_number }) => {
      const data = (await repoGet(owner, repo, `/pulls/${pull_number}/files?per_page=100`)) as unknown[];
      const files = (data ?? []).map((f: unknown) => {
        const file = f as Record<string, unknown>;
        return {
          filename: file['filename'],
          status: file['status'],
          additions: file['additions'],
          deletions: file['deletions'],
          changes: file['changes'],
        };
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(files, null, 2) }] };
    },
  );

  server.tool(
    'list_issues',
    'List issues for a repo (excludes PRs).',
    {
      owner: ownerSchema,
      repo: repoSchema,
      state: z.enum(['open', 'closed', 'all']).optional().default('open'),
      labels: z.string().optional().describe('Comma-separated label names'),
      limit: z.number().int().min(1).max(50).optional().default(20),
    },
    async ({ owner, repo, state, labels, limit }) => {
      const params = new URLSearchParams();
      params.set('state', state ?? 'open');
      params.set('per_page', String(limit ?? 20));
      if (labels) params.set('labels', labels);
      const data = (await repoGet(owner, repo, `/issues?${params}`)) as unknown[];
      const issues = (data ?? [])
        .filter((i: unknown) => !(i as Record<string, unknown>)['pull_request'])
        .map((i: unknown) => {
          const issue = i as Record<string, unknown>;
          return {
            number: issue['number'],
            title: issue['title'],
            state: issue['state'],
            user: (issue['user'] as Record<string, unknown>)?.['login'],
            labels: (issue['labels'] as Array<Record<string, unknown>>)?.map((l) => l['name']),
            comments: issue['comments'],
            html_url: issue['html_url'],
            updated_at: issue['updated_at'],
          };
        });
      return { content: [{ type: 'text' as const, text: JSON.stringify(issues, null, 2) }] };
    },
  );

  server.tool(
    'get_issue',
    'Get a single issue with body.',
    { owner: ownerSchema, repo: repoSchema, issue_number: z.number().int() },
    async ({ owner, repo, issue_number }) => {
      const issue = (await repoGet(owner, repo, `/issues/${issue_number}`)) as Record<string, unknown>;
      const summary = {
        number: issue['number'],
        title: issue['title'],
        state: issue['state'],
        body: issue['body'],
        user: (issue['user'] as Record<string, unknown>)?.['login'],
        labels: (issue['labels'] as Array<Record<string, unknown>>)?.map((l) => l['name']),
        comments: issue['comments'],
        html_url: issue['html_url'],
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
    },
  );

  server.tool(
    'list_issue_comments',
    'List comments on an issue.',
    { owner: ownerSchema, repo: repoSchema, issue_number: z.number().int() },
    async ({ owner, repo, issue_number }) => {
      const data = (await repoGet(owner, repo, `/issues/${issue_number}/comments?per_page=50`)) as unknown[];
      const comments = (data ?? []).map((c: unknown) => {
        const comment = c as Record<string, unknown>;
        return {
          user: (comment['user'] as Record<string, unknown>)?.['login'],
          body: comment['body'],
          created_at: comment['created_at'],
          html_url: comment['html_url'],
        };
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(comments, null, 2) }] };
    },
  );

  server.tool(
    'list_commits',
    'List commits on a branch.',
    {
      owner: ownerSchema,
      repo: repoSchema,
      sha: z.string().optional().describe('Branch, tag, or commit SHA (default: HEAD)'),
      limit: z.number().int().min(1).max(50).optional().default(20),
    },
    async ({ owner, repo, sha, limit }) => {
      const params = new URLSearchParams();
      params.set('per_page', String(limit ?? 20));
      if (sha) params.set('sha', sha);
      const data = (await repoGet(owner, repo, `/commits?${params}`)) as unknown[];
      const commits = (data ?? []).map((c: unknown) => {
        const commit = c as Record<string, unknown>;
        const innerCommit = commit['commit'] as Record<string, unknown>;
        const author = innerCommit?.['author'] as Record<string, unknown> | undefined;
        return {
          sha: commit['sha'],
          message: innerCommit?.['message'],
          author_name: author?.['name'],
          author_date: author?.['date'],
          html_url: commit['html_url'],
        };
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(commits, null, 2) }] };
    },
  );

  server.tool(
    'get_file_contents',
    'Get the contents of a file in a repo (UTF-8, truncated at 50 KB).',
    {
      owner: ownerSchema,
      repo: repoSchema,
      path: z.string().describe('File path (e.g. README.md, src/index.ts)'),
      ref: z.string().optional().describe('Branch / tag / commit SHA (default: HEAD)'),
    },
    async ({ owner, repo, path, ref }) => {
      try {
        const text = await fetchFileContents(owner, repo, path, ref);
        return { content: [{ type: 'text' as const, text }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${String(e)}` }] };
      }
    },
  );

  server.tool(
    'search_code',
    'Search code across the org (e.g. q="error_class:NoMethodError org:edri2or").',
    {
      q: z.string().describe(`Search query — automatically scoped to org:${ORG} if not specified in q`),
      limit: z.number().int().min(1).max(30).optional().default(10),
    },
    async ({ q, limit }) => {
      const scoped = q.includes('org:') || q.includes('repo:') ? q : `${q} org:${ORG}`;
      const params = new URLSearchParams();
      params.set('q', scoped);
      params.set('per_page', String(limit ?? 10));
      const data = (await searchGet(`/code?${params}`)) as { items?: unknown[]; total_count?: number };
      const items = (data.items ?? []).map((i: unknown) => {
        const item = i as Record<string, unknown>;
        return {
          name: item['name'],
          path: item['path'],
          repository: (item['repository'] as Record<string, unknown>)?.['full_name'],
          html_url: item['html_url'],
        };
      });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ total_count: data.total_count, items }, null, 2) }],
      };
    },
  );

  server.tool(
    'search_issues',
    'Search issues and PRs across the org.',
    {
      q: z.string().describe(`Search query — auto-scoped to org:${ORG} if not specified`),
      limit: z.number().int().min(1).max(30).optional().default(10),
    },
    async ({ q, limit }) => {
      const scoped = q.includes('org:') || q.includes('repo:') ? q : `${q} org:${ORG}`;
      const params = new URLSearchParams();
      params.set('q', scoped);
      params.set('per_page', String(limit ?? 10));
      const data = (await searchGet(`/issues?${params}`)) as { items?: unknown[]; total_count?: number };
      const items = (data.items ?? []).map((i: unknown) => {
        const item = i as Record<string, unknown>;
        return {
          number: item['number'],
          title: item['title'],
          state: item['state'],
          repository_url: item['repository_url'],
          html_url: item['html_url'],
          updated_at: item['updated_at'],
        };
      });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ total_count: data.total_count, items }, null, 2) }],
      };
    },
  );

  server.tool(
    'get_workflow',
    'Get metadata for a single workflow (state, badge_url, timestamps). Distinct from list_workflows.',
    {
      owner: ownerSchema,
      repo: repoSchema,
      workflow_id: z.string().describe('Workflow ID or filename (e.g. "deploy-mcp-server.yml")'),
    },
    async ({ owner, repo, workflow_id }) => {
      const wf = (await repoGet(owner, repo, `/actions/workflows/${encodeURIComponent(workflow_id)}`)) as Record<string, unknown>;
      const summary = {
        id: wf['id'],
        name: wf['name'],
        path: wf['path'],
        state: wf['state'],
        created_at: wf['created_at'],
        updated_at: wf['updated_at'],
        html_url: wf['html_url'],
        badge_url: wf['badge_url'],
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
    },
  );

  server.tool(
    'list_repo_variables',
    'List Actions Variables defined at the repository level. Variables are plaintext by design (not secrets).',
    {
      owner: ownerSchema,
      repo: repoSchema,
      limit: z.number().int().min(1).max(100).optional().default(30),
    },
    async ({ owner, repo, limit }) => {
      const data = (await repoGet(owner, repo, `/actions/variables?per_page=${limit}`)) as { variables: unknown[] };
      const variables = (data.variables ?? []).map((v: unknown) => {
        const vr = v as Record<string, unknown>;
        return { name: vr['name'], value: vr['value'], created_at: vr['created_at'], updated_at: vr['updated_at'] };
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(variables, null, 2) }] };
    },
  );

  server.tool(
    'get_repo_variable',
    'Get a single repository Actions Variable by name (plaintext value).',
    { owner: ownerSchema, repo: repoSchema, name: z.string().describe('Variable name') },
    async ({ owner, repo, name }) => {
      const data = await repoGet(owner, repo, `/actions/variables/${encodeURIComponent(name)}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'list_org_variables',
    `List Actions Variables defined at the ${ORG} organization level. Variables are plaintext by design (not secrets).`,
    { limit: z.number().int().min(1).max(100).optional().default(30) },
    async ({ limit }) => {
      const data = (await orgGet(`/actions/variables?per_page=${limit}`)) as { variables: unknown[] };
      const variables = (data.variables ?? []).map((v: unknown) => {
        const vr = v as Record<string, unknown>;
        return {
          name: vr['name'],
          value: vr['value'],
          visibility: vr['visibility'],
          created_at: vr['created_at'],
          updated_at: vr['updated_at'],
        };
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(variables, null, 2) }] };
    },
  );

  server.tool(
    'get_org_variable',
    `Get a single ${ORG} organization Actions Variable by name (plaintext value).`,
    { name: z.string().describe('Variable name') },
    async ({ name }) => {
      const data = await orgGet(`/actions/variables/${encodeURIComponent(name)}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // === Phase-4 tools (require a GitHub App permission bump) ===
  // These need the broker App to hold `secrets:read` (list_repo_secrets_names) and
  // `administration:read` (branch protection / environments). Until an org admin
  // accepts the added permissions on the org-wide installation, each returns a
  // clean `permission_denied` hint rather than throwing — the other 17 org-read
  // tools do not depend on this.

  server.tool(
    'list_repo_secrets_names',
    `List the NAMES of GitHub Actions Secrets in a ${ORG} repository. Values are NEVER returned (the GitHub Secrets API never returns values to App tokens — only names and timestamps). Requires the broker App to have 'secrets:read'.`,
    { owner: ownerSchema, repo: repoSchema },
    async ({ owner, repo }) => {
      try {
        const data = (await repoGet(owner, repo, '/actions/secrets')) as { secrets?: unknown[]; total_count?: number };
        const secrets = (data.secrets ?? []).map((s: unknown) => {
          const sec = s as Record<string, unknown>;
          return { name: sec['name'], created_at: sec['created_at'], updated_at: sec['updated_at'] };
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ owner, repo, totalCount: data.total_count ?? secrets.length, secrets }, null, 2) }],
        };
      } catch (e) {
        const msg = String(e);
        if (/403|Resource not accessible by integration/i.test(msg)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'permission_denied', expected: "broker App needs secrets:read; an org admin must accept new permissions on the installation", detail: msg.slice(0, 300) }, null, 2) }] };
        }
        throw e;
      }
    },
  );

  server.tool(
    'list_branch_protection_rules',
    `List branch protection rules for a ${ORG} repository. With 'branch', returns that branch's protection config; otherwise lists all protected branches and their configs. Requires the broker App to have 'administration:read'.`,
    { owner: ownerSchema, repo: repoSchema, branch: z.string().optional().describe('Branch name (default: list all protected branches)') },
    async ({ owner, repo, branch }) => {
      try {
        if (branch) {
          const data = await repoGet(owner, repo, `/branches/${encodeURIComponent(branch)}/protection`);
          return { content: [{ type: 'text' as const, text: JSON.stringify({ owner, repo, branch, protection: data }, null, 2) }] };
        }
        const branches = (await repoGet(owner, repo, '/branches?protected=true&per_page=100')) as Array<{ name: string }>;
        const protectionByBranch: Record<string, unknown> = {};
        for (const b of branches) {
          try {
            protectionByBranch[b.name] = await repoGet(owner, repo, `/branches/${encodeURIComponent(b.name)}/protection`);
          } catch (innerE) {
            protectionByBranch[b.name] = { error: String(innerE).slice(0, 200) };
          }
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify({ owner, repo, protectedBranches: branches.map((b) => b.name), protection: protectionByBranch }, null, 2) }] };
      } catch (e) {
        const msg = String(e);
        if (/403|Resource not accessible by integration/i.test(msg)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'permission_denied', expected: "broker App needs administration:read; an org admin must accept new permissions on the installation", detail: msg.slice(0, 300) }, null, 2) }] };
        }
        throw e;
      }
    },
  );

  server.tool(
    'list_github_environments',
    `List deployment environments for a ${ORG} repository (id, name, protection_rules, deployment_branch_policy, timestamps). Requires the broker App to have 'administration:read'.`,
    { owner: ownerSchema, repo: repoSchema },
    async ({ owner, repo }) => {
      try {
        const data = (await repoGet(owner, repo, '/environments?per_page=100')) as { environments?: unknown[]; total_count?: number };
        const environments = (data.environments ?? []).map((e: unknown) => {
          const env = e as Record<string, unknown>;
          return {
            id: env['id'],
            name: env['name'],
            protection_rules: env['protection_rules'],
            deployment_branch_policy: env['deployment_branch_policy'],
            created_at: env['created_at'],
            updated_at: env['updated_at'],
          };
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ owner, repo, totalCount: data.total_count ?? environments.length, environments }, null, 2) }] };
      } catch (e) {
        const msg = String(e);
        if (/403|Resource not accessible by integration/i.test(msg)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'permission_denied', expected: "broker App needs administration:read; an org admin must accept new permissions on the installation", detail: msg.slice(0, 300) }, null, 2) }] };
        }
        throw e;
      }
    },
  );
}

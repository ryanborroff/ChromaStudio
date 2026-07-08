const REPO = "ryanborroff/ChromaStudio";
const BRANCH = "main";
const CHECK_NAME = "Typecheck & Build";
const RULESET_NAME = "Protect main";

interface GitHubErrorResponse {
  message?: string;
  errors?: Array<{ message?: string }>;
}

interface RulesetResponse {
  id?: number;
  name?: string;
}

async function githubFetch(
  token: string,
  url: string,
  method: string,
  body?: unknown
): Promise<Response> {
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function deleteExistingRuleset(
  token: string,
  rulesetId: number
): Promise<void> {
  const url = `https://api.github.com/repos/${REPO}/rulesets/${rulesetId}`;
  const res = await githubFetch(token, url, "DELETE");
  if (res.status !== 204) {
    const text = await res.text();
    console.warn(`Warning: could not delete old ruleset (${res.status}): ${text}`);
  }
}

async function applyRuleset(token: string): Promise<void> {
  const listUrl = `https://api.github.com/repos/${REPO}/rulesets`;

  console.log(`Applying branch ruleset to ${REPO}:${BRANCH}...`);
  console.log(`Requiring CI check: "${CHECK_NAME}"`);

  const listRes = await githubFetch(token, listUrl, "GET");
  if (listRes.ok) {
    const existing = (await listRes.json()) as RulesetResponse[];
    for (const r of existing) {
      if (r.name === RULESET_NAME && r.id !== undefined) {
        console.log(`Found existing ruleset "${RULESET_NAME}" (id ${r.id}) — replacing it.`);
        await deleteExistingRuleset(token, r.id);
      }
    }
  }

  const body = {
    name: RULESET_NAME,
    target: "branch",
    enforcement: "active",
    conditions: {
      ref_name: {
        include: [`refs/heads/${BRANCH}`],
        exclude: [],
      },
    },
    rules: [
      {
        type: "required_status_checks",
        parameters: {
          required_status_checks: [{ context: CHECK_NAME }],
          strict_required_status_checks_policy: false,
        },
      },
      { type: "deletion" },
      { type: "non_fast_forward" },
    ],
  };

  const res = await githubFetch(token, listUrl, "POST", body);

  if (res.status === 201) {
    const data = (await res.json()) as RulesetResponse;
    console.log(`Ruleset applied successfully (id ${data.id ?? "?"}).`);
    console.log(`- Required CI check: "${CHECK_NAME}" must pass before merging`);
    console.log(`- Branch deletions: BLOCKED`);
    console.log(`- Force pushes: BLOCKED`);
    console.log(
      `Verify at: https://github.com/${REPO}/settings/rules`
    );
  } else {
    const data = (await res.json()) as GitHubErrorResponse;
    console.error(`ERROR: HTTP ${res.status}`);
    console.error(data.message ?? JSON.stringify(data));
    if (data.errors) {
      for (const e of data.errors) console.error(" -", e.message);
    }
    process.exit(1);
  }
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN environment variable is not set.");
    process.exit(1);
  }
  await applyRuleset(token);
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

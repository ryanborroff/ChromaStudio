import { createHmac, timingSafeEqual } from "crypto";

const REPO = "ryanborroff/ChromaStudio";
const BRANCH = "main";
const CHECK_NAME = "Typecheck & Build";

async function applyBranchProtection() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN environment variable is not set.");
    process.exit(1);
  }

  const url = `https://api.github.com/repos/${REPO}/branches/${BRANCH}/protection`;

  const body = {
    required_status_checks: {
      strict: true,
      contexts: [CHECK_NAME],
    },
    enforce_admins: false,
    required_pull_request_reviews: null,
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false,
    block_creations: false,
    required_conversation_resolution: false,
  };

  console.log(`Applying branch protection to ${REPO}:${BRANCH}...`);
  console.log(`Requiring CI check: "${CHECK_NAME}"`);

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 200) {
    console.log("Branch protection applied successfully.");
    console.log(`- Direct pushes to main: BLOCKED`);
    console.log(`- Required CI check: "${CHECK_NAME}" must pass`);
    console.log(`- Force pushes: BLOCKED`);
    console.log(`- Branch deletions: BLOCKED`);
  } else if (response.status === 403) {
    const data = (await response.json()) as { message?: string };
    if (data.message?.includes("Upgrade to GitHub Pro")) {
      console.error(
        "ERROR: Branch protection on private repositories requires GitHub Pro or higher."
      );
      console.error(
        "To enable protection, either upgrade your GitHub account to Pro at"
      );
      console.error("  https://github.com/settings/billing/plans");
      console.error(
        "or make the repository public at https://github.com/ryanborroff/ChromaStudio/settings"
      );
    } else {
      console.error(
        `ERROR: 403 Forbidden — ${data.message ?? "insufficient permissions"}`
      );
      console.error(
        "Ensure GITHUB_TOKEN has admin access to the repository (repo scope)."
      );
    }
    process.exit(1);
  } else {
    const text = await response.text();
    console.error(`ERROR: HTTP ${response.status}`);
    console.error(text);
    process.exit(1);
  }
}

applyBranchProtection().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

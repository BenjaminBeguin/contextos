import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const WORKFLOW = `name: Cortex Review
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
permissions:
  contents: read
  pull-requests: write
jobs:
  cortex-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g @mxbenjaminbeguin/cortex
      - name: Cortex review
        run: cortex review --base "\${{ github.event.pull_request.base.ref }}" --post
        env:
          CORTEX_TOKEN: \${{ secrets.CORTEX_TOKEN }}
          CORTEX_API_URL: \${{ vars.CORTEX_API_URL }}
          GH_TOKEN: \${{ github.token }}
`;

export interface CiOptions {
  force?: boolean;
}

export async function ciCommand(opts: CiOptions = {}) {
  const dir = join(process.cwd(), ".github", "workflows");
  const file = join(dir, "cortex-review.yml");
  if (existsSync(file) && !opts.force) {
    console.error(`${file} already exists. Re-run with --force to overwrite.`);
    return;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, WORKFLOW);

  console.log("Wrote .github/workflows/cortex-review.yml\n");
  console.log("Next steps:");
  console.log("  1. Commit .cortex/config.json and the workflow file.");
  console.log("  2. Add your Cortex API token as a repo secret:");
  console.log("       gh secret set CORTEX_TOKEN --body <your-cortex-token>");
  console.log("  3. If you self-host the API, set its URL as a repo variable:");
  console.log("       gh variable set CORTEX_API_URL --body https://your-cortex-api");
  console.log("  4. Enable the reviewer for this repo in the Cortex dashboard (PR Reviewer card).");
}

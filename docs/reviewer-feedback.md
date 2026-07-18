# Reviewer feedback loop — contract

The PR Reviewer generates findings grounded in a repo's approved memories. Until
now those reviews were fired-and-forgotten. This loop **persists** every review,
lets a human mark each finding **accepted** or **dismissed**, and feeds that signal
back into the **confidence** of the memory that grounded the finding — so memories
that produce useful reviews rise, and ones that produce noise fall.

```
memory (approved) ──grounds──▶ finding ──human feedback──▶ Δ confidence back to memory
```

## Data model (Prisma) — authored in prisma/schema.prisma

- `PrReview` — one persisted review. Fields: `id, repoId, prNumber?, prTitle,
  source ("ci"|"github"|"manual"), summary, findingCount, createdAt`. Relations:
  `repo`, `findings`.
- `PrReviewFinding` — one finding. Fields: `id, reviewId, key, severity, title,
  detail, path?, line?, memoryId?, memoryTitle?, feedback ("pending"|"accepted"|
  "dismissed"), feedbackAt?, createdAt`. Relations: `review`, `memory?`.
- `Memory` gains back-relation `reviewFindings PrReviewFinding[]`.
- `Repo` gains back-relation `reviews PrReview[]`.
- `key` = the shared `findingKey(finding)` (`path:line:slug(title)`), identical to
  the dedup marker the CLI posts to GitHub, so GitHub-side feedback can be matched.
- `memoryId` is resolved when persisting: exact case-insensitive match of
  `finding.memory` (title the model referenced) against the repo's memories.

## Persistence

Both review routes (`POST /repos/:repoId/review` and `.../review-diff`) persist a
`PrReview` + its `PrReviewFinding[]` after generating the review. Non-fatal: a
persistence error must not break returning the review. The response gains
`reviewId` and per-finding `id`+`key` so the client can send feedback.

## Confidence rule (services/feedback.ts — pure + unit-tested)

```
ACCEPT_DELTA = +0.05
DISMISS_DELTA = -0.08     // dismissals bite a little harder than accepts reward
MIN = 0.05, MAX = 0.99

effect(feedback): accepted → +ACCEPT_DELTA, dismissed → DISMISS_DELTA, pending → 0
clampConfidence(x) = min(MAX, max(MIN, x))

// Transition is reversible: moving a finding's feedback from `from` to `to`
// applies delta = effect(to) - effect(from) to the grounding memory.
confidenceDelta(from, to) = effect(to) - effect(from)
applyFeedback(current, from, to) = clampConfidence(current + confidenceDelta(from, to))
```

Only findings with a resolved `memoryId` move confidence. Each change writes an
`AuditLog` (`action: "memory.confidence_adjusted"`) and a `UsageEvent`
(`type: "review.feedback"`, metadata `{ findingId, from, to, delta }`).

## HTTP endpoints (all workspace-scoped via assertRepoAccess)

- `GET  /repos/:repoId/reviews?limit=&offset=` → `{ reviews: PrReviewDTO[], total }`
  (each review includes its findings; newest first).
- `GET  /reviews/:reviewId` → `PrReviewDTO`.
- `POST /findings/:findingId/feedback` body `{ feedback: "accepted"|"dismissed"|"pending" }`
  → `{ finding: PrReviewFindingDTO, memory?: { id, confidence, previousConfidence } }`.
- `POST /repos/:repoId/review-feedback` body `{ items: [{ key, feedback }] }`
  → applies feedback by dedup `key` against the repo's most-recent matching findings
  (used by `memmo review-sync` to push GitHub 👍/👎 back). Returns `{ updated }`.

### DTO shapes (shared TS types in @memmo/shared)

```ts
PrReviewFindingDTO = {
  id, key, severity, title, detail, path?, line?,
  memoryId?, memoryTitle?, feedback, feedbackAt?, createdAt
}
PrReviewDTO = {
  id, prNumber?, prTitle, source, summary, findingCount, createdAt,
  findings: PrReviewFindingDTO[]
}
```

## CLI — `memmo review-sync`

Reads the PR's memmo-authored review comments (they carry
`<!-- memmo-review:KEY -->` markers), maps GitHub reactions on each comment
(👍 → accepted, 👎 → dismissed), and POSTs `/repos/:repoId/review-feedback` with
`[{ key, feedback }]`. Runs in the same GitHub Actions context as `memmo review`.

## Web UI

`apps/web/app/repos/[repoId]/reviews/page.tsx` (+ nav entry in `RepoNav`): list
persisted reviews, expand findings, Accept / Dismiss buttons calling
`POST /findings/:id/feedback`, and show the grounding memory with its confidence and
the delta when it moves (amber "signal fired" affordance). Built on the new design
identity.

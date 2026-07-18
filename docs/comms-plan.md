# Memmo — Communication & Launch Plan

A go-to-market communication plan for **Memmo — long-term memory for AI coding
agents**. Pre-launch stage: landing page + waitlist live, CLI (`memmo`) ready,
Claude Code / MCP-native.

---

## 1. Objectives

| Goal | Why | Example target |
|------|-----|----------------|
| Grow the waitlist → activated teams | Build a pipeline before GA | 1,000 waitlist / 50 activated teams in 60 days |
| Establish the category position | "AI-memory" is crowded; own the *team + Claude Code* angle | Rank for "Claude Code memory", "MCP memory" |
| Earn developer trust | Devs buy from peers, not ads | HN front page, PH top 5, dev-newsletter mentions |
| Feed activation | Signups only matter if repos get connected | 40% of signups run `memmo init` |

Pick 1 north-star metric per phase (waitlist → installs → connected repos).

---

## 2. Audiences & the message for each

| Segment | The pain they feel | Message |
|---------|--------------------|---------|
| **Individual Claude Code devs** (the wedge) | Re-explaining the codebase every session | "Your agent stops starting from zero." |
| **Eng leads / AI-native teams** | Tribal knowledge, slow onboarding | "Team memory that compounds — for people and agents." |
| **Staff/platform engineers** | Agents repeating known mistakes | "Warn agents before they touch risky files." |
| **Founders / CTOs** (buyers) | Knowledge walks out when people leave | "Institutional memory that survives turnover." |

Lead with the **individual dev** wedge (bottom-up), expand to **teams**.

---

## 3. Positioning & key messages

- **One-liner:** Long-term memory for AI coding agents.
- **Category:** the operational-memory layer for AI coding — MCP-native,
  Claude Code first.
- **Three pillars:**
  1. **Captures** real work (agent sessions + merged PRs) — with human approval.
  2. **Injects** the right context *before* the agent acts.
  3. **Compounds** — memory + a PR reviewer that learns from every accept/dismiss.
- **Differentiation** (vs Mem0 / Memco / Memori and general "AI memory"):
  *team-level*, *human-in-the-loop curation*, *Claude Code / MCP-native*, and a
  *self-improving reviewer* — not just a vector store bolted onto an agent.
- **Proof, not claims:** show a demo where the agent avoids a real mistake
  because a memory fired. Never claim "first" in a crowded field.

---

## 4. Channels

- **Owned:** landing + waitlist, docs, **blog** (SEO + thought leadership),
  changelog, email.
- **Earned / launch:** **Show HN**, **Product Hunt**, dev newsletters
  (TLDR, Console, Changelog News, Bytes), the **MCP server directory**, podcasts.
- **Social:** **X/Twitter** (primary — build-in-public), **LinkedIn** (eng
  leaders), **Reddit** (r/ClaudeAI, r/ChatGPTCoding — value-first, no spam),
  **Dev.to / Hashnode**, relevant **Discords/Slacks**.
- **Ecosystem:** list in Anthropic's MCP directory; co-market with complementary
  Claude Code tooling.

---

## 5. Phased timeline

**Phase 0 — Foundation (now → announce)**
Finish demo video + docs, set up analytics (signup → activation funnel), claim
handles (@memmo / memmohq), warm up an X presence, seed 3–5 build-in-public posts.

**Phase 1 — Pre-launch / waitlist build (2–4 weeks)**
- 2–3 "problem" essays: *the amnesia tax*, *tribal knowledge*, *onboarding AI*.
- Weekly build-in-public updates (screens, demos, decisions).
- Short demo clips (the "aha": context injected before an edit).
- CTA everywhere → waitlist.

**Phase 2 — Launch week**
- **Tue–Thu.** Product Hunt at 12:01 PT; Show HN mid-morning ET (stagger, don't
  collide). Launch blog post + 60–90s demo. X launch thread. Email the waitlist.
- Line up 5–10 friendly early users to try it and comment authentically.

**Phase 3 — Sustain (post-launch)**
- Weekly changelog + one content piece. Publish 1–2 **case studies**
  ("how team X cut re-work"). Double down on the channels that converted.
  Start light paid only after organic message-market fit.

---

## 6. Assets to prepare (checklist)

- [ ] 60–90s **demo video** (agent gets context → avoids a mistake)
- [ ] **Launch blog:** "Why AI coding agents need memory"
- [ ] **Show HN** post (title + body + first comment)
- [ ] **Product Hunt** kit (gallery, tagline, description, maker's first comment)
- [ ] **X launch thread** + 8–10 build-in-public posts
- [ ] Quickstart **GIF** (`memmo init` → Claude Code using it)
- [ ] **Email sequence:** waitlist welcome → launch → activation nudge
- [ ] Docs polished + "Connect Claude Code in 60s" page

---

## 7. Launch-day runbook

1. **Night before:** schedule PH, draft HN, queue X thread, warn early users.
2. **12:01 PT:** PH goes live → maker's first comment (story, not sales).
3. **~8–9am ET:** Show HN (`Show HN: Memmo – long-term memory for AI coding agents`).
4. Post the X thread; email the waitlist; drop links in relevant communities.
5. **All day:** reply to *every* comment fast and honestly. Log objections.
6. **+1 day:** thank-you post + "what we heard" recap.

---

## 8. Metrics / KPIs

- **Awareness:** PH rank, HN points/comments, impressions, referral traffic.
- **Acquisition:** waitlist signups, **npm installs of `memmo`**, sign-ups.
- **Activation:** repos connected (`memmo init`), memories approved, agents served.
- **Retention:** weekly active teams, memory retrievals/week.
- Review weekly; kill channels that don't convert.

---

## 9. Risks & guardrails

- **Crowded category** → differentiate on *team + human-approval + Claude-native*;
  never claim "first".
- **Overclaiming** → demo real behavior; under-promise.
- **Privacy is a buying factor** → lead with *encrypted, repo-scoped, BYO-database,
  bring-your-own-AI-provider* for team/enterprise conversations.
- **Brand consistency** → always "Memmo"; keep the tagline stable.

---

## 10. Ready-to-use copy (drafts)

**X / product bio**
> Memmo — long-term memory for AI coding agents. Your team's decisions, context,
> and lessons, injected into Claude Code before it acts. So no session starts
> from zero.

**Product Hunt tagline**
> Long-term memory for AI coding agents

**Show HN title**
> Show HN: Memmo – long-term memory for AI coding agents (Claude Code, MCP)

**Show HN body (draft)**
> Hi HN — Memmo gives AI coding agents long-term memory. Today Claude Code starts
> every session from zero: it re-reads the repo, re-derives conventions, and
> repeats mistakes the team already solved. Memmo captures what actually works
> (from agent sessions and merged PRs), a human approves it, and it's injected
> back into future sessions over MCP — with a PR reviewer that gets sharper as
> you accept/dismiss its findings. It's Claude Code-native, repo-scoped and
> encrypted, and works with your own AI provider (Anthropic, OpenAI, Google, or a
> custom endpoint). Free tier + `npm i -g memmo`. Happy to answer anything.

**Waitlist welcome email (draft)**
> Subject: You're on the Memmo waitlist 🧠
>
> Thanks for joining. Memmo is long-term memory for AI coding agents — so Claude
> Code stops re-learning your codebase every session. We'll email you the moment
> your invite is ready. In the meantime, here's a 90-second demo: [link].
> — Benjamin

**Cold/LinkedIn one-liner (eng leaders)**
> If your team uses Claude Code, Memmo turns each session's learning into shared,
> approved memory — so agents (and new hires) stop starting from zero. Worth a look?

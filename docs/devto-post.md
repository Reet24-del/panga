---
title: "“Simple site hai, 15k mein ho jayega na?” I built Panga so freelancers stop saying yes too fast"
published: false
tags: devchallenge, hf26challenge, opensource, ai
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge: Week 2](https://dev.to/challenges/hacktoberfest-week2-2026-10-12): Side Hustle.*

It's 9:41 on a Tuesday night when Mr Sharma's email lands.

> *Namaste! I run Sharma Tuition Classes in Lucknow for class 9 to 12. We need a simple website showing our courses, our teachers, last year's results and a contact form. Just 4-5 pages. Our budget is ₹12,000.*

Easy money. You've built this site twenty times. You reply *"Haan ji, ho jayega"* and put the phone down.

It buzzes.

> *parents should be able to pay the monthly fees online also, UPI se*

It buzzes again.

> *and students will login to download notes and old papers*
> *weekly online test bhi ho jaye with marks, that will be very good*
> *Hindi version bhi chahiye, most parents prefer Hindi*
> *every result season we will send topper photos, you put them on the site*

And then the line every freelancer in India has heard at least once:

> *bas simple sa hi hai na*

Fourteen minutes, six messages. The "simple site" now has a payment flow, a student login, an exam system, a second language and a maintenance job that never ends. The budget is still ₹12,000.

You find out what that means three weeks later, at 2 AM, when you finally add up the hours. About ninety-two of them. That's **₹130 an hour**, before the first "small change".

There's a Hindi word for this kind of trouble: **panga**. Trouble you pick on purpose.

So I built **Panga**, a deal room that reads the brief *and* the chat, finds the work hiding in it, shows what the deal really pays per hour, and lets you rehearse the awkward call with a pushy client **before** you say yes. Then it helps you answer the only question that matters:

**Lena hai? Negotiate karna hai? Ya chhodna hai?**
*Take it, change the deal, or walk away?*

{% youtube R5gJBSatjeI %}

*The demo video above is Panga running live on the Sharma deal, narrated with ElevenLabs.*

## The pain nobody puts on their portfolio

Freelance developers are good at building things. We lose money before the building starts.

- **The scope isn't in the brief. It's in the chat.** The email says "4-5 pages". The WhatsApp thread quietly adds payments, logins and a translation, spread over six messages and three days.
- **We price by feel.** "₹12,000 feels right for a small site." Nobody divides the price by the real hours until the project is half done.
- **"Small changes later also."** The most expensive sentence in freelancing. Unlimited revisions with no line item.
- **We say yes on calls.** The client pushes, the silence gets awkward, and *"haan, ho jayega"* slips out. Nobody writes it down. The client remembers.
- **The reply takes an hour.** Saying "this costs more" politely, in the right tone, without sounding greedy, is hard. So we don't say it.
- **We never learn.** The last project ran forty percent over. The next quote is still a guess.

None of this is a coding problem. It's a reading, maths and nerve problem. Those are things software can actually help with.

## What I built

Panga turns a messy deal into four steps. Here's what it did with Mr Sharma's messages, live, in about 30 seconds.

### 01 The work: find what's hiding in the chat

![The work: every item quotes the client, hidden items are marked](https://raw.githubusercontent.com/Reet24-del/panga/main/docs/images/02-the-work.png)

Gemma reads the brief and the chat and lists every piece of work. Panga found **the website from the email and five more jobs in the chat**: UPI fee payments, a student login for notes, weekly online tests, a Hindi version, and topper photos every result season.

The rule that makes this trustworthy: **every item must quote the client word for word, and Panga checks each quote against the original text.** If the model invents a quote, Panga throws the item away. Click a quote and the client's own message lights up on the right.

It also gets the small things right:

- **Hosting** was never mentioned, so it's listed as "nobody asked for this" and **not priced**.
- The **"before April" deadline isn't treated as work**.
- The **₹12,000** came straight out of the email, with the quote it came from.

Unsure what an online test system involves? **What's involved?** runs a live web search with SerpApi and explains it with numbered sources.

### 02 The money: the real hourly rate

![The money: 92 hours, ₹130 an hour, ₹70,000 to be worth it](https://raw.githubusercontent.com/Reet24-del/panga/main/docs/images/04-the-money.png)

All of that work adds up to about **92 hours**. At ₹12,000 that's **₹130 an hour** against a ₹700 minimum. To be worth your time, the full job should be **₹70,000**.

This part is plain TypeScript, not AI. Every number has a **"How?"** that shows its formula, and you can change your rate, revision rounds or buffer and watch everything update. A "what if the small changes never stop?" slider shows the rate sinking further.

### 03 Client from hell: practise the call

![Practice call with the pretend client](https://raw.githubusercontent.com/Reet24-del/panga/main/docs/images/05-practice-call.png)

A pretend client who has read *only this brief* calls you, by text or by voice, and pushes on every gap using his own messages. In the demo I answered the way most of us do, a little too nicely:

> *"Haan ji, notes ka portal bhi bana dunga, no problem."*

When the call ends, the replay shows exactly what that cost:

![Replay: Panga flags the free portal you just promised](https://raw.githubusercontent.com/Reet24-del/panga/main/docs/images/06-replay.png)

That easy "no problem" is flagged as **extra work** you just promised for free. The price talk is flagged too, with a suggestion for pinning each one down. You can add the promise to the work list in one click.

### 04 Your call: take it, change it, or walk

![Three options: ₹12,000 starter, ₹70,000 full scope, or walk away](https://raw.githubusercontent.com/Reet24-del/panga/main/docs/images/07-your-call.png)

Panga lays out three options:

- **Change the deal:** a smaller package that fits the client's ₹12,000, with what's left out written down.
- **Take it, at your price:** everything they asked for, at ₹70,000.
- **Walk away:** a polite no.

Pick one, and it drafts the reply in your tone, **including Hinglish**. It then checks that **every amount in the reply matches its own numbers**, so a hallucinated "₹9,000" can't sneak into a message to your client.

![The drafted reply in Hinglish](https://raw.githubusercontent.com/Reet24-del/panga/main/docs/images/08-reply.png)

You approve it. **Panga never messages your client. You do.**

When the project ends, you record how long it really took. That becomes a past project, and the next similar brief shows it, for example: *"Kurta shop: estimated 50 h, took 72 h. Product import took twice as long as quoted."*

### Who would pay for this

Freelance web developers and small studios who quote fixed prices, especially for the ₹10k–₹50k "simple website" jobs where scope creep hurts most. One avoided free student portal pays for years of the tool.

The plan is **₹49 per deal check, or ₹299 a month**. A full check costs Panga **well under ₹1** in model calls, so the numbers work even at Indian freelance prices.

## Demo

- **Live:** [panga-gnb2.onrender.com](https://panga-gnb2.onrender.com). It's on a free instance, so the first visit after a quiet spell can take about 50 seconds to wake up. Click **Try the sample deal**, or paste the Sharma example below.
- **Code:** [github.com/Reet24-del/panga](https://github.com/Reet24-del/panga) (MIT)

{% details The Sharma Tuitions example (paste this into Panga) %}

**What's the project?** Sharma Tuitions website

**Brief:**

```
Namaste! I run Sharma Tuition Classes in Lucknow for class 9 to 12. We need a simple website showing our courses, our teachers, last year's results and a contact form. Just 4-5 pages. Our budget is ₹12,000.
```

**Chat:**

```
[9:41] Mr Sharma: aapka kaam dekha, accha laga
[9:43] Mr Sharma: parents should be able to pay the monthly fees online also, UPI se
[9:44] Mr Sharma: and students will login to download notes and old papers
[9:47] Mr Sharma: weekly online test bhi ho jaye with marks, that will be very good
[9:50] Mr Sharma: Hindi version bhi chahiye, most parents prefer Hindi
[9:52] Mr Sharma: every result season we will send topper photos, you put them on the site
[9:55] Mr Sharma: admission season starts 1st April so before that please. bas simple sa hi hai na
```

{% enddetails %}

## Why open innovation matters here

**Client briefs are private.** They hold prices, business plans and sometimes customers' names. Panga runs on open-weight models: **Gemma 4** (`gemma-4-31B-it`) for reasoning and **Qwen3** (`qwen3-embedding-0.6b`) for search, served by DigitalOcean. Neither is a closed vendor's model whose terms can change under me. Panga talks to any OpenAI-compatible endpoint, so a freelancer who wants nothing leaving their machine can point it at Gemma on their own laptop or GPU box by changing a couple of settings.

**The business only works if it's cheap.** A deal check is several model calls: extraction, a practice call, a replay, research, a reply. On an open model with serverless inference, that's well under a rupee, which is what makes a ₹49 price possible for people who are themselves paid in rupees.

**The trust doesn't depend on the model being perfect.** Open models make mistakes, and so do closed ones. Panga doesn't hope Gemma is right. It checks: quotes must match the source, maths is done in code, and reply amounts are verified. That makes a smaller open model good enough for a job where money is on the line.

**The whole stack is open.** Mastra for agents, Temporal for workflows, Postgres with pgvector for search, and Panga itself under MIT.

## How I built it

```
Browser ──► Next.js on Render ──► Mastra agents ──► Gemma 4 on DigitalOcean
               │                                   (scope analyst, researcher,
               │                                    client simulator, writer)
               ├──► Tiger Data (Postgres + pgvector): deals, past projects, hybrid search
               ├──► Backboard: memory of your rates, tone and corrections
               ├──► SerpApi: "What's involved?" research with sources
               └──► Sentry: traces of every agent run and model call

Voice call: Browser ──► ElevenLabs agent ──(Custom LLM)──► Panga /api/sim ──► Gemma
```

**106 automated tests** cover the money maths (including a worked example from the spec), quote matching, the practice call's hidden tags, reply amount checks, the database layer and the deal workflow.

## Every sponsor in Panga, and exactly what it does

Panga uses ten of this challenge's partners. Nine run in the live demo. One (Temporal) is built and tested but switched off on the free deployment, and I say why below.

| Sponsor | Its job in Panga | Live in the demo? |
|---|---|---|
| DigitalOcean | Runs every AI call: Gemma 4 and the Qwen3 embeddings | Yes |
| Gemma | The only reasoning model | Yes |
| Mastra | The four agents | Yes |
| ElevenLabs | Voice practice call, voice-note transcription, demo narration | Yes |
| Tiger Data | The database, and hybrid search over past projects | Yes |
| Backboard | Remembers your rates, tone and corrections | Yes |
| SerpApi | Live web research with sources | Yes |
| Sentry | Traces every agent run, model call and token | Yes |
| Render | Hosts the app and the agents | Yes |
| Temporal | A durable workflow for each deal | Built and tested, not live |

### DigitalOcean: where the AI runs

- **What it is:** DigitalOcean's Gradient AI Platform includes Serverless Inference, which serves open-weight models behind an OpenAI-compatible API and bills per token.
- **What it does in Panga:** it runs **every** AI call. Gemma 4 (`gemma-4-31B-it`) handles all the reasoning, and Qwen3 (`qwen3-embedding-0.6b`) makes the embeddings behind past-project search.
- **How it's wired:** the Mastra agents point at `https://inference.do-ai.run/v1` with a DigitalOcean model key (`src/mastra/index.ts`). Embeddings come from the same endpoint's `/v1/embeddings` (`src/server/embeddings.ts`). The repo also ships an App Platform spec (`.do/app.yaml`). Panga first ran on App Platform, then I moved hosting to Render's free plan to keep the build at ₹0.
- **Where you see it:** every result in the demo: the work list, the practice call, the replay, the research and the reply.

### Gemma: the brain

- **What it is:** Google's family of open-weight models.
- **What it does in Panga:** Gemma 4 31B is the **only** reasoning model. It reads the brief and the chat, plays the client on the practice call, reviews the call for promises, summarises research and drafts the reply.
- **How it's wired:** DigitalOcean serves it (above) and Mastra calls it (below). Because any model can be wrong, Panga checks Gemma's work in code: quotes must match the client's text, all money maths is TypeScript, and every amount in a reply is checked against Panga's own numbers.
- **Where you see it:** Sentry counts 24 Gemma calls and 27,063 tokens on the live app this week, all on `gemma-4-31B-it`.

### Mastra: the agents

- **What it is:** an open-source TypeScript framework for building AI agents.
- **What it does in Panga:** four agents run on Gemma, each with its own instructions:

| Agent | Its job | Where you see it |
|---|---|---|
| Scope analyst | Lists the work in the brief and chat, quoting the client. Later, reviews the practice call for promises. | Step 01 and the replay |
| Researcher | Explains an unfamiliar requirement from live search results | "What's involved?" |
| Client simulator | Plays the client on the practice call, by text or voice, streaming | Step 03 |
| Proposal writer | Drafts the reply in your tone | Step 04 |

- **How it's wired:** `src/mastra/index.ts` defines the agents. JSON steps use `generate`, and the live call uses `stream`. Mastra's observability exporter sends every run to Sentry.

### ElevenLabs: the voice

The ElevenLabs category names three uses: give an open-source agent a voice, transcribe audio, or narrate the demo. Panga does all three.

1. **A voice for the open-model client.** The voice practice call is an ElevenLabs Conversational AI agent whose **Custom LLM is Panga's own endpoint** (`/api/sim/v1/chat/completions`, locked with a shared secret). ElevenLabs listens, handles turn-taking and speaks. Gemma, through the client-simulator agent, decides every word the client says, based on this deal's brief. The browser starts the call with a short-lived signed URL from Panga, so the API key never reaches the browser.
2. **Transcription.** "Add their voice note" sends a client's voice note to ElevenLabs Scribe (`scribe_v2`), and the text joins the brief for Gemma to read.
3. **Narration.** The demo video's voice is ElevenLabs text-to-speech (voice "George", `eleven_multilingual_v2`). Hindi lines are written in Devanagari so they're pronounced correctly, and I checked every clip by transcribing it back with Scribe.

### Tiger Data: the database and the search

- **What it is:** managed Postgres with pgvector, running on Tiger Data's free plan.
- **What it does in Panga:** it stores deals, practice calls and your library of past projects, and finds the past projects most like a new brief.
- **How it's wired:** every past project is saved with a Qwen3 embedding (pgvector) and a full-text index. One SQL query runs a **hybrid search**: score = 0.7 × vector similarity + 0.3 × keyword rank (`src/server/projects-repo.ts`).
- **Where you see it:** past projects that match a new deal, and the Memory & library page.

### Backboard: the memory

- **What it is:** an API that gives AI apps long-term memory and search over it.
- **What it does in Panga:** it remembers you between deals: your minimum hourly rate, currency, tone, work you never include, and every correction you make to an extracted work list.
- **How it's wired:** each workspace gets one Backboard assistant, and its ID is kept in Postgres. Preferences and corrections are saved as Backboard memories. When a new brief arrives, Panga **searches those memories with the brief's text** and puts the best matches into the scope analyst's prompt (`recallForBrief` in `src/server/memory.ts`). A correction you made last month shapes this month's work list.
- **Where you see it:** the Memory & library page.

### SerpApi: the research

- **What it is:** an API that returns search engine results as JSON.
- **What it does in Panga:** it powers **"What's involved?"** on any work item, for when you don't know how big something like "weekly online tests" really is.
- **How it's wired:** the top five Google results from SerpApi go to the researcher agent, which must cite them as [1], [2] and so on. Citations that don't point to a real result are removed, and an answer with no valid citation is replaced by the sources themselves. Each search is its own Sentry span (`panga.research.search`).

### Sentry Agent Tracing: watching the agents work

- **What it is:** Sentry's tracing for AI agents. Every agent run, model call, token count and cost becomes a span you can inspect.
- **How it's set up:** Mastra's Sentry exporter (`@mastra/sentry`) is plugged into Panga's Mastra instance, so every agent run and Gemma call is traced without extra code per call. Sentry's Node instrumentation adds the Postgres queries to Tiger and the HTTP calls to Backboard, SerpApi and DigitalOcean to the same trace. I added custom spans around the non-AI steps (`panga.verify_quotes`, `panga.research`, `panga.research.search`). Errors are reported with the step that failed, such as `memory.recall` or `elevenlabs.transcribe`.

![Sentry's AI Agents dashboard for Panga: Gemma calls, tokens, cost and duration, and a list of traces with time, tokens and cost for each](https://raw.githubusercontent.com/Reet24-del/panga/main/docs/images/09-sentry-agents.png)

- **How it performs** on the live app over the last 7 days (the `panga` project only, so these are my test runs and the demo):

| Agent run | Time | Tokens |
|---|---|---|
| Scope analyst, reading a full brief | 28–47 s | about 2,000 |
| Scope analyst, reviewing a practice call | 4–7 s | 750–900 |
| Client simulator, one turn of the call | 1.0–2.5 s | 870–1,000 |
| Proposal writer, drafting the reply | 5.5 s | 600 |

  In total, 24 Gemma calls used 27,063 tokens. Sentry estimates every trace at **less than $0.01**.

![One Sentry trace: the scope analyst's 45-second Gemma call, with the Tiger queries and Backboard calls that ran before it](https://raw.githubusercontent.com/Reet24-del/panga/main/docs/images/10-sentry-trace.png)

- **What I found:**
  - **Reading the brief is the slow step.** It took 45 s in the trace above, 351% slower than the average Gemma call (10 s). But the request that starts it returns in **343 ms**, because the analysis runs after the response. The trace shows why Panga can show a live "reading" screen instead of a frozen button.
  - **A new workspace pays a one-time 236 ms** to create its Backboard assistant (`POST /assistants`). Later deals skip that step because the ID is saved in Postgres. The waterfall shows the lookup, the create and the save in order.
  - **The prompt fills 1% of Gemma's 256K context window**, so even a long WhatsApp thread has plenty of room.
  - **A client-simulator turn takes 1–2.5 s**, which is quick enough for a spoken conversation.
- **How it helps me debug:** when something fails, the error lands in Sentry tagged with the step, inside the same trace as the model call and the database queries. So I can tell whether Gemma, Postgres or a partner API was at fault.

### Render: where Panga lives

- **What it is:** a cloud hosting platform.
- **What it does in Panga:** it runs the whole live app: the Next.js site, the four Mastra agents, and the Custom LLM endpoint that the ElevenLabs voice agent calls during a practice call. So Render is the runtime for the agents, not just a host for static pages.
- **How it's wired:** a free web service that builds with `npm ci && npm run build`, checks health at `/api/health` and redeploys on every push to `main`. Node starts with a 400 MB memory cap to fit the 512 MB plan, and the app runs at around 210 MB.

### Temporal: built and tested, not live

- **What it is:** a workflow engine that makes long-running work durable. It survives restarts and retries failed steps.
- **What it does in the code:** one workflow per deal (`dealReview`). It retries the analysis (3 attempts, starting at 5 s). It waits up to 30 days for the practice call, the scope confirmation and your decision. Then, 14 days after the decision, it asks how the project went.
- **The honest status:** the tests run this workflow, long timers included, in seconds on Temporal's time-skipping test server. **The live demo does not use Temporal**, because Temporal Cloud asked for a card and I kept this build at ₹0. Instead, the live app runs the same steps inside the web process. Setting `TEMPORAL_ADDRESS` (plus a key) and `PANGA_EMBEDDED_WORKER=true` starts the worker inside the web server.

## The parts that fought back

Some of the most useful lessons came from things breaking.

1. **Gemma invented quotes.** It would "quote" the client with words the client never wrote. Fix: a matcher that forgives curly quotes and spacing but not words, and that maps the match back to the exact original text. Unmatched quotes get dropped and counted.
2. **"Budget 20-25k" became ₹25,000.** The model kept taking the top of a range. Prompt rule: a range means the lower end. The reply checker learned to read ranges too, with a test.
3. **Deadlines kept turning into work items.** "Before April" isn't a deliverable. The prompt says so, and the dry runs confirm it.
4. **A 900 MB database on a 512 MB server.** Locally, Panga uses PGlite (Postgres compiled to WASM) with pgvector. It's lovely, but on my machine it used about 900 MB the moment it started, far more than the 512 MB Render's free plan allows. The live app uses Tiger Data instead and sits around 220 MB.
5. **Tiger's certificate was "self-signed in the chain".** Newer `node-postgres` treats `sslmode=require` as "verify everything", and Tiger uses its own certificate authority. Every query failed. Fix: read `sslmode=require` the way libpq does (encrypted, certificate not pinned), with a test.
6. **Backboard returned 500 for one word.** Saving preferences failed, but only for some of them. After a few probes I found it: Backboard's API rejects any memory whose metadata has a text field named `value`. Renaming the field fixed it, and old memories still read back.
7. **Temporal wants a worker. Free hosting doesn't do workers.** So the worker runs inside the web server when needed, with the workflow code bundled during the build so the server never has to run webpack at startup. It costs about 70 MB.

## Running it for ₹0

| Piece | Where | Cost |
|---|---|---|
| App | Render free web service | ₹0 |
| Database | Tiger Data free service | ₹0 |
| Model | Gemma on DigitalOcean (trial credit) | well under ₹1 per deal |
| Research, memory, voice, tracing | SerpApi, Backboard, ElevenLabs, Sentry free plans | ₹0 |

## Prize categories

I'm entering the ten categories explained above:

- Best Use of **DigitalOcean**
- Best Use of **Gemma**
- Best Use of **Render**
- Best Use of **ElevenLabs**
- Best Use of **Mastra**
- Best Use of **Tiger Data**
- Best Use of **Backboard**
- Best Use of **SerpApi**
- Best Use of **Sentry Agent Tracing**
- Best Use of **Temporal** (built and tested, but not live; see its section)

Panga doesn't use TabPFN, Tinker, Arduino, Entire, GitHub Copilot, MongoDB Atlas or a .tech domain, so I'm not entering those.

## What's next

- **Laptop mode:** Gemma running locally, so a brief never leaves the freelancer's machine.
- **A contract from the agreed scope:** the final work list, prices and "not included" items, ready to sign.
- **Learning from real outcomes:** if your "simple sites" always run 40% over, Panga should quote you 40% higher before you're tempted not to.

Every freelancer will pick a panga sooner or later. Panga just makes sure you know what you're picking.

**Panga lo. Par soch samajh ke.**
*Pick your panga. Wisely.*

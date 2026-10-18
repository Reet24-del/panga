---
title: "“Simple site hai, 15k mein ho jayega na?” I built Panga so freelancers stop saying yes too fast"
published: false
tags: devchallenge, hf26challenge, opensource, ai
---

<!--
BEFORE PUBLISHING (delete this block):
1. Upload the video to YouTube (unlisted is fine) and replace YOUR_VIDEO_ID below.
2. Drag the images from demo/post-images/ into the DEV editor and replace each IMAGE-… placeholder with the URL DEV gives you.
3. Add a Sentry trace screenshot where it says IMAGE-sentry-trace (sentry.io → panga → Traces → open one "scope-analyst" run).
4. Fill in "My first user" honestly, or delete that section.
5. Cover image: upload demo/post-images/01-hero.png as the post's cover.
-->

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

{% youtube YOUR_VIDEO_ID %}

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

![The work: every item quotes the client, hidden items are marked](IMAGE-02-the-work)

Gemma reads the brief and the chat and lists every piece of work. Panga found **the website from the email and five more jobs in the chat**: UPI fee payments, a student login for notes, weekly online tests, a Hindi version, and topper photos every result season.

The rule that makes this trustworthy: **every item must quote the client word for word, and Panga checks each quote against the original text.** If the model invents a quote, Panga throws the item away. Click a quote and the client's own message lights up on the right.

It also gets the small things right:

- **Hosting** was never mentioned, so it's listed as "nobody asked for this" and **not priced**.
- The **"before April" deadline isn't treated as work**.
- The **₹12,000** came straight out of the email, with the quote it came from.

Unsure what an online test system involves? **What's involved?** runs a live web search with SerpApi and explains it with numbered sources.

### 02 The money: the real hourly rate

![The money: 92 hours, ₹130 an hour, ₹70,000 to be worth it](IMAGE-04-the-money)

All of that work adds up to about **92 hours**. At ₹12,000 that's **₹130 an hour** against a ₹700 minimum. To be worth your time, the full job should be **₹70,000**.

This part is plain TypeScript, not AI. Every number has a **"How?"** that shows its formula, and you can change your rate, revision rounds or buffer and watch everything update. A "what if the small changes never stop?" slider shows the rate sinking further.

### 03 Client from hell: practise the call

![Practice call with the pretend client](IMAGE-05-practice-call)

A pretend client who has read *only this brief* calls you, by text or by voice, and pushes on every gap using his own messages. In the demo I answered the way most of us do, a little too nicely:

> *"Haan ji, notes ka portal bhi bana dunga, no problem."*

When the call ends, the replay shows exactly what that cost:

![Replay: Panga flags the free portal you just promised](IMAGE-06-replay)

That easy "no problem" is flagged as **extra work** you just promised for free. The price talk is flagged too, with a suggestion for pinning each one down. You can add the promise to the work list in one click.

### 04 Your call: take it, change it, or walk

![Three options: ₹12,000 starter, ₹70,000 full scope, or walk away](IMAGE-07-your-call)

Panga lays out three options:

- **Change the deal:** a smaller package that fits the client's ₹12,000, with what's left out written down.
- **Take it, at your price:** everything they asked for, at ₹70,000.
- **Walk away:** a polite no.

Pick one, and it drafts the reply in your tone, **including Hinglish**. It then checks that **every amount in the reply matches its own numbers**, so a hallucinated "₹9,000" can't sneak into a message to your client.

![The drafted reply in Hinglish](IMAGE-08-reply)

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

How each partner earns its place:

- **Gemma 4 on DigitalOcean Serverless Inference:** every model call, through an OpenAI-compatible API. Embeddings (Qwen3) come from the same place.
- **Mastra:** four agents (scope analyst, researcher, client simulator, proposal writer) with per-call instructions and streaming.
- **ElevenLabs:** the voice practice call. The clever bit: the ElevenLabs agent's *Custom LLM* is **Panga's own endpoint**, so ElevenLabs does the listening and speaking while Gemma decides what the client says, grounded in this brief. It also transcribes clients' voice notes (Scribe). And yes, the demo narration is ElevenLabs too.
- **Tiger Data:** Postgres with pgvector. Past projects are found by **hybrid search**: 70% meaning (vector similarity) plus 30% keywords (full-text rank).
- **Backboard:** remembers your minimum rate, tone, work you never include, and every correction you make to an extracted scope. It feeds them to the next brief.
- **SerpApi:** live research with numbered, linked sources. Claims without a source are dropped.
- **Render:** hosts the app on the free plan, and redeploys on every push.
- **Sentry:** Mastra's Sentry exporter traces every agent run and model call (tokens, latency), with custom spans around quote checking and research.

  ![A Sentry trace of one deal analysis](IMAGE-sentry-trace)

- **Temporal:** one durable workflow per deal. It retries analysis, waits for the practice call and your approval, and two weeks later asks how the project went. The tests run those long timers in seconds on Temporal's time-skipping server. *Honest note: the free live demo runs the same steps inside the web app, because Temporal Cloud needs a card and I kept this build at ₹0. Add the keys and one flag, and the worker starts inside the web server.*

**106 automated tests** cover the money maths (including a worked example from the spec), quote matching, the practice call's hidden tags, reply amount checks, the database layer and the deal workflow.

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

## My first user

[Write this honestly before publishing, or delete the section. Who tried Panga on a real deal? What did it find? Did they say they'd pay, and how much? What did they ask for next?]

## Prize categories

- **Best Use of DigitalOcean:** Gemma and the embeddings run on DigitalOcean Serverless Inference, and there's an App Platform spec in the repo (`.do/app.yaml`).
- **Best Use of Gemma:** Gemma 4 does every reasoning step: extraction, research summaries, the pretend client, replays and replies.
- **Best Use of Render:** the live app runs on Render's free plan.
- **Best Use of ElevenLabs:** a voice practice call with Panga as the agent's Custom LLM, Scribe transcription of voice notes, and the demo narration.
- **Best Use of Mastra:** four agents on an open model.
- **Best Use of Tiger Data:** pgvector hybrid search over past projects.
- **Best Use of Backboard:** memory that makes the next extraction better.
- **Best Use of SerpApi:** cited research on unfamiliar requirements.
- **Best Use of Sentry Agent Tracing:** traces of every agent run, with tokens and latency.
- **Best Use of Temporal:** a durable per-deal workflow, built and tested (see the honest note above).

## What's next

- **Laptop mode:** Gemma running locally, so a brief never leaves the freelancer's machine.
- **A contract from the agreed scope:** the final work list, prices and "not included" items, ready to sign.
- **Learning from real outcomes:** if your "simple sites" always run 40% over, Panga should quote you 40% higher before you're tempted not to.

Every freelancer will pick a panga sooner or later. Panga just makes sure you know what you're picking.

**Panga lo. Par soch samajh ke.**
*Pick your panga. Wisely.*

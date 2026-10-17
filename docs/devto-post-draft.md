---
title: Panga: meet your client from hell before you sign
published: false
tags: devchallenge, hf26challenge, opensource, ai
---

<!-- DRAFT. Everything in [square brackets] needs your real material before publishing. Paste the DEV submission template's required headings in if they differ. -->

*This is a submission for the [Hacktoberfest Open-Source AI Challenge: Week 2](https://dev.to/challenges/hacktoberfest-week2-2026-10-12) — theme: Side Hustle.*

## What I built

A client messages a freelancer: *"simple online store, budget ₹15,000."* Three WhatsApp messages later, the "simple store" includes migrating 200 products from Instagram, UPI and card payments, mobile layouts, and "small changes later also, like banners for every sale."

Most freelancers find this out after they've said yes.

**Panga** is a deal room for freelancers who sell websites at fixed prices. It answers one question before you reply: *Lena hai, negotiate karna hai, ya chhodna hai?* (Take it, change the deal, or walk away?)

1. **Dossier.** Paste the brief and the chat (or upload a PDF or a voice note). Gemma lists the work, including what's hidden in the messages. Every item has to quote the client word for word, and Panga checks each quote against the source. When the model invents one, Panga rejects it.
2. **Economics.** What the deal pays per hour, your floor price, and what happens when "small changes" run for three months. Plain code; every number shows its formula.
3. **Client from hell.** A simulated client, built only from this brief, calls you by text or voice and pushes on every gap. Afterwards the replay highlights what you promised by accident ("haan, upload kar denge").
4. **Decision.** A smaller package within the budget, the full scope repriced, or a polite decline, with a reply drafted in your tone. Panga flags any price in the draft it didn't calculate. You send it yourself.

When the project is done, you record how long it really took. The next similar brief shows that lesson.

**Who would pay:** freelancers who quote fixed prices and keep losing hours to scope creep. I'd test a small fee per deal review against a monthly allowance. [Replace with what your first user said about paying.]

## Demo

[Live link: https://YOUR-APP.ondigitalocean.app]

[Screenshot: the dossier with quotes highlighted in the client's messages]

[Video or GIF: a 60-second "Client from hell" call and the replay]

Code: [GitHub link] (MIT)

## Why open innovation matters here

Client briefs are private business details: prices, plans, sometimes customer data. Panga runs **Gemma 4, an open-weight model**, on DigitalOcean infrastructure I control, so the brief never goes to a closed model vendor.

It also changes the economics of the product itself. A deal review makes several model calls. With an open model on serverless inference, that cost stays small enough for a per-deal price that freelancers paid in rupees can afford. [Add your measured cost per review from Sentry.]

And because the model is open, the narrow jobs (reading briefs, playing a client) can be tuned and swapped without asking anyone's permission.

## How I built it

- **Gemma 4 on DigitalOcean Serverless Inference** (`gemma-4-31B-it`) for every model call, through **Mastra** agents: a scope analyst, a researcher, a client simulator and a proposal writer.
- **Quote verification** in plain TypeScript: tolerant of curly quotes and spacing, strict about words. Unmatched quotes are dropped and counted.
- **ElevenLabs** voice: the agent's *Custom LLM* is Panga's own endpoint, so ElevenLabs carries the audio while Gemma decides what the client says. Hidden tags like `[R4]` tie each line to the brief item it presses on and are stripped before they're spoken.
- **Temporal**: one durable workflow per deal. It retries analysis, waits for rehearsals and approval, and two weeks later asks how the project went. The tests run that two-week timer in seconds on Temporal's time-skipping server.
- **Tiger Data** (Postgres + pgvector): past projects matched by meaning and keywords.
- **Backboard**: remembers your rate, tone and the corrections you make, and feeds them to the next extraction.
- **SerpApi**: cited research on unfamiliar requirements.
- **Sentry**: traces of every agent run, with tokens and latency.
- **DigitalOcean App Platform and Spaces** for hosting and private file storage.

[Add one bug you found through Sentry traces and how you fixed it.]

## My first user

[Who tried it, on which real deal, what Panga found, what they said, and whether they'd pay.]

## Prize categories

<!-- Keep only the ones you actually have working, with evidence in the post. -->

- Best Use of DigitalOcean
- Best Use of Gemma
- Best Use of ElevenLabs
- Best Use of Mastra
- Best Use of Temporal
- Best Use of Tiger Data
- Best Use of Backboard
- Best Use of SerpApi
- Best Use of Sentry Agent Tracing
- Best Use of a .tech Domain [if deployed on your .tech domain]

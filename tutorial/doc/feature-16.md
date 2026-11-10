# Governance Dashboard

The **Governance Dashboard** (*AI Governance Center*) is a ready-made web UI on top of the conversation records Smart Workflow keeps in the Ivy repository. Without any external tracing platform, process owners, compliance officers and developers can see which Cases used AI, how many tokens they consumed and with which models — and open any Case to read every agent conversation, check its statistics, and let an AI analyst assess it.

---

> **This builds on [Observability].** The dashboard only *displays* data — it shows the conversations recorded by the **Conversations in Ivy** channel (`AI.Observability.Ivy.Enabled`). Nothing changes in your agents.
>
> **Example used in this guide:** Enable conversation recording, run a few tutorial processes — for example `Feature01.p.json` (invoice summary), `Feature05.p.json` (callable process tools) and `Feature09.p.json` (output guardrail) — then open the dashboard and inspect them.

---

## What you get

| View | Shows | Uses AI? |
| --- | --- | --- |
| **History list** | Every recorded Case → Task → Agent, with tokens, messages and model, filterable | No |
| **Token usage analytics** | KPIs and charts of token usage, models and response times over the last 7 days | No |
| **Conversation detail** | The full conversation of each agent in one Case: system prompt, input, response, tool calls, metadata | No |
| **Analysis report — Statistic** | Per-Case metrics, an A–F grade per agent, and detected anomalies | No |
| **Analysis report — AI Recommendation** | An AI-written assessment: summary, risks, tool usage, reliability, efficiency, recommendations | **Yes** — on demand |

---

## Step 1 — Add the dependency

The dashboard ships as its own Axon Ivy project, `smart-workflow-dashboard`. The tutorial project already declares it in `tutorial/pom.xml`:

```xml
<dependency>
  <groupId>com.axonivy.utils.ai</groupId>
  <artifactId>smart-workflow-dashboard</artifactId>
  <version>14.0.0</version>
  <type>iar</type>
</dependency>
```

Use the same version as your `smart-workflow` dependency. In your own project, add the dependency the same way and let the Designer resolve the project dependencies again.

> **Note:** When you install Smart Workflow from the Axon Ivy Market, the installer imports `smart-workflow-dashboard` as a separate project instead of adding it to your workspace. Either way, the dashboard reads the conversations of the application it is deployed in.

---

## Step 2 — Enable conversation recording

The dashboard is empty until conversations are recorded. Switch on the Ivy channel from [Observability]:

```yaml
Variables:
  AI:
    Observability:
      Ivy:
        # Enable chat history recording for governance audit.
        Enabled: "true"
```

The tutorial project already sets this in `tutorial/config/variables.yaml`, so every tutorial process you run is recorded. In your own project, add it yourself.

Only agent calls made **after** this switch appear in the dashboard — earlier runs were never recorded.

---

## Step 3 — Open the dashboard

Start the **Governance Dashboard** process from the process list (it belongs to the `smart-workflow-dashboard` project). It opens the *AI Governance Center* page with the history list on top and the token usage analytics below.

> **Important:** In 14.0.0 the start is not restricted to a role, and the dashboard shows every recorded conversation of the application — including prompts, responses and tool arguments. Treat access to it like access to the conversation records themselves.

---

## History list

![Governance Dashboard — history list](cms:/Files/Images/feature16-history-list)

The history table groups the records as a tree: **Case → Task → Agent**. Each row shows:

| Column | Meaning |
| --- | --- |
| **Case/Task/Agent** | The Case name, the Task, and the agent's element name |
| **Last updated** | When the most recent conversation in this row was recorded |
| **Messages** | Number of messages exchanged |
| **Tokens** | Tokens consumed |
| **Model** | Model that answered |

Above the table you can filter by:

- **Case** — Case name, ID or description
- **Model** — grouped by provider
- **Date range** — *All time*, *Today*, *Last 7 days*, *Last 30 days* (default: *Last 30 days*)

Click **View details** on a Case to open its conversation detail.

Records are grouped under the agent's **element name**, so give every `AgenticProcessCall` a meaningful name such as `Invoice Summary Agent` — otherwise the tree is hard to read.

---

## Token usage analytics

![Governance Dashboard — token usage analytics](cms:/Files/Images/feature16-usage-analytics)

The analytics section summarises **the last 7 days** of recorded conversations:

- **KPIs:** Total Sessions, Total Tokens, Avg Response Time, Top Model
- **Charts:** Token Usage Over Time, Model Distribution, Input vs Output Tokens per Day, Top Processes by Token Usage, Response Time Distribution (`< 5 s`, `5–10 s`, `10–15 s`, `> 15 s`)

Use it to spot cost drivers — a process that suddenly tops the token chart, or a model you did not expect in the distribution.

> **Note:** The analytics always cover the last 7 days. The Case, model and date filters only apply to the history table above.

---

## Conversation detail

![Governance Dashboard — conversation detail](cms:/Files/Images/feature16-conversation-detail)

The conversation page shows one Case:

- **KPIs** — Task, Total Messages, Total Tokens, Average Duration
- **Agents by Task** — navigation through every Task of the Case and the agents that ran in it
- **One card per agent** with tabs:

| Tab | Content |
| --- | --- |
| **System Prompt** | The system message the agent was configured with |
| **Input** | The user message(s) sent to the model |
| **Response** | What the model answered |
| **Tool Calls (n)** | Each tool call with its input parameters and result |
| **Metadata** | Start time, model, input / output / total tokens, duration |

The **Actions** menu opens **Case Information** — the Case's ID, state, category, creator, creation and finish time, processing time and description, plus a **Process Viewer** of the Case's process. **Export** is shown but not yet available in 14.0.0.

This is the place to answer *"why did the agent decide that?"*: read the exact prompt and input, see which tools it called with which arguments, and what each tool returned.

---

## Analysis report — Statistic

![Governance Dashboard — analysis report, Statistic tab](cms:/Files/Images/feature16-case-statistic)

Below the summary, the collapsible **Analysis Report** panel has two tabs. The **Statistic** tab is computed from the recorded data when the page opens — no AI call, no cost:

- **Overview** — Case, process, number of agents, total tokens
- **Token Usage** — input, output and total tokens, and the largest single call
- **Tool Effectiveness** — total calls, errors, null/empty results, successful calls
- **Agent Breakdown** — per agent: a **grade**, model and finish reason, tokens per message, throughput, share of the Case's tokens and time, a table per tool (calls, success rate, nulls, errors), a table per guardrail (passed, failed, fatal, average ms), and the detected anomalies

### Anomalies

| Anomaly | Detected when |
| --- | --- |
| Excessive duration | The agent conversation took longer than 30 seconds |
| Excessive token usage | The conversation used more than 10,000 tokens |
| Excessive tool calls | The agent made more than 10 tool calls — possible loop |
| Stuck loop | The same tool was called 5 times or more with identical arguments |
| High null result rate | A tool returned null or empty in more than 50% of its calls |
| Truncated output | The response was cut off at the model's length limit |
| Fatal guardrail results | A guardrail ended with a fatal result |

The thresholds are fixed in 14.0.0.

### Agent grade

Each agent starts at 100 points and loses points for problems:

| Problem | Penalty |
| --- | --- |
| Each detected anomaly | −15 |
| Response cut off at the length limit | −20 |
| Each tool error | −10 |
| Each fatal guardrail result | −25 |
| More than 50% of the Case's tokens | −10 |
| More than 50% of the Case's duration | −5 |

| Grade | Score | Meaning |
| --- | --- | --- |
| **A** | 90–100 | Excellent |
| **B** | 75–89 | Good |
| **C** | 60–74 | Fair, needs attention |
| **D** | 40–59 | Poor, investigate issues |
| **F** | 0–39 | Critical, requires immediate action |

---

## Analysis report — AI Recommendation

![Governance Dashboard — analysis report, AI Recommendation tab](cms:/Files/Images/feature16-ai-recommendation)

The **AI Recommendation** tab goes one step further. Click **Generate AI Recommendation** and an AI governance analyst — itself a Smart Workflow agent — reads the Case's statistics and conversations and writes a structured assessment:

| Section | Content |
| --- | --- |
| **Executive Summary** | The Case's AI usage in a few sentences |
| **Risk Assessment** | Operational, Compliance, Cost and Reliability risk, each rated *Low*, *Moderate*, *High* or *Critical* with a reason |
| **Tool Usage Patterns** | Which tools were used, how often, and what stands out |
| **Reliability Concerns** | Anomalies, errors and guardrail events, with a conclusion |
| **Efficiency Opportunities** | Per agent: observations and concrete suggestions |
| **Recommendations** | What to change |

The report is stored per Case in the Ivy repository: opening the Case again shows the last report and when it was generated, and generating again replaces it.

**Things to know:**

- **It costs tokens and uses your default provider.** The analyst runs with `AI.DefaultProvider` and its default model.
- **It sends the Case's conversations to that provider** — prompts, responses, tool calls and guardrail results, not only the metrics. Check that this is acceptable for the data in your Cases.
- **The analyst's own run is recorded too.** With conversation recording on, it appears in the history list like any other agent call.
- **It is an assessment, not a verdict.** Use it to decide where to look; confirm findings in the conversation detail.

---

## Common mistakes

- **Empty dashboard** — `AI.Observability.Ivy.Enabled` is off, or the agents ran before you switched it on.
- **Expecting the analytics to follow the filters** — the analytics always show the last 7 days; the filters apply to the history table only.
- **Unnamed agents** — all agents show up with their default element name and cannot be told apart. Name every `AgenticProcessCall`.
- **Opening the dashboard to everyone** — it exposes all recorded prompts and responses. Decide who may start it before going to production.
- **Generating AI recommendations for sensitive Cases without checking** — the full conversations go to the default provider.

---

## Example process

The dashboard has no tutorial process of its own — it shows the conversations of the other features:

1. Check that `AI.Observability.Ivy.Enabled` is `true` — the tutorial's `variables.yaml` sets it.
2. Run `Feature01.p.json`, `Feature05.p.json` and `Feature09.p.json` from the process list.
3. Start **Governance Dashboard**. The three Cases appear in the history list; open the Feature 05 Case to see its tool calls, and the Feature 09 Case to see the blocking guardrail in the Statistic tab.

---

## See also

- [Observability]
- [Output Guardrail]
- [Callable Process Tools]
- [Circuit Breaker]

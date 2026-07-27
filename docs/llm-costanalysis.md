# LLM Cost Analysis

### Assumptions

Our working assumption is that on average, an article is 2,500 words long, which at 250 words per minute corresponds to a 10-minute read. For LLM cost estimation, we need to consider a token-based view, which at 1 word to 4 tokens corresponds to 10,000 input tokens.

Working assumptions used below:
| Assumption | Value | Notes |
| ------------------------- | ------------------ | ----------------------------------------------------------- |
| Articles per day | 50,000 | Target volume from the assignment brief. |
| Input tokens per article | 10,000 | Long-form article assumption from prior discussion. |
| Output tokens per article | 300 | Roughly enough for a short summary plus sentiment and topics. |

### Model selection — cost / quality / latency

| Model/Service             | Input / Output ($ per 1M tok)              | Fit for this task                                                                                                                                              |
| ------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude Haiku 4.5**      | $1 / $5                                    | Summary + sentiment + tagging is a bounded extraction/classification task well within Haiku's quality range. Cheapest and fastest → best fit at 50k/day scale. |
| **Claude Sonnet 5**       | $3 / $15 ($2/$10 intro through 2026-08-31) | Reach for this only if summary quality on hard/nuanced articles proves insufficient on Haiku. ~3× the cost. Still fast especially if thinking is disabled      |
| **Claude Opus 4.8**       | $5 / $25                                   | Overkill for classification/extraction; reserved for tasks needing deep reasoning. Slower than other models. Not justified here.                               |
| **HF CPU endpoint floor** | $0.03/hr                                   | Public Inference Endpoints pricing.                                                                                                                            |
| **HF T4 GPU floor**       | $0.50/hr                                   | Public Inference Endpoints pricing.                                                                                                                            |
| **HF L4 GPU**             | $0.80/hr                                   | Public Inference Endpoints pricing.                                                                                                                            |
| **HF A10G GPU**           | $1.00/hr                                   | Public Inference Endpoints pricing.                                                                                                                            |

- HF = Hugging Face

**Split-model option:** one could use Haiku for sentiment+tags (pure classification) and Sonnet for summaries (generation). In the case of this brief, given the small arictles being handled, using Haiku alone should provide a satisfactory result in terms of the summary quality and classifications. However more so out of curiosity and likeliness that a normal article would be longer, sometimes more complex, we used Sonnet for summarie, knowing the higher cost per article.
In a real scenario I would recommended trying Haiku (Cheaper Model) and manually analysing the result. This would also prevent us from having to send the article twice. (Half the input tokens). We could then quite possibly use Sonnet for longer articles or even Opus for more localised articles that require some cultural subtext.

We could also add another step, using a model like Opus or models from other vendors, with more thinking capacity, to anlyse a selection of the summaries from time to time, and ensure that the quality we want is present.

### Token cost calculation

$$
\text{Cost per article} = (\text{Input price} \times \frac{\text{Input tokens}}{1{,}000{,}000}) + (\text{Output price} \times \frac{\text{Output tokens}}{1{,}000{,}000})
$$

### Option 1: Only Haiku

Per article:

$$
\text{Cost per article} = (\text{1} \times \frac{\text{10,000}}{1{,}000{,}000}) + (\text{5} \times \frac{\text{300}}{1{,}000{,}000}) = \text{\$0.0115}
$$

At 50,000 articles/day:

- Input cost/day: **$500.00**
- Output cost/day: **$75.00**
- Total cost/day: **$575.00**

Approximate monthly cost: **$17,250.00**

### Option 2: Haiku for Classification, Sonnet for Summary

> Although this is what we implemented, it is overkill for the current situation.

Haiku is used only for sentiment and topic classification, which fits its cost profile well.

Sonnet is used for all summaries because it is the higher-quality generation model in the pair and is better suited to producing coherent 1–2 sentence summaries that preserve nuance.

#### Per article

$$
\text{Cost per classification} = (\text{1} \times \frac{\text{10,000}}{1{,}000{,}000}) + (\text{5} \times \frac{\text{150}}{1{,}000{,}000}) = \text{\$0.01075}
$$

$$
\text{Cost per summary} = (\text{3} \times \frac{\text{10,000}}{1{,}000{,}000}) + (\text{15} \times \frac{\text{150}}{1{,}000{,}000}) = \text{\$0.03225}
$$

#### Per day at 50,000 articles

- Input cost/day: **$500.00** + **$1,500.00**
- Output cost/day: **$37.50** + **$112.50**
- Total cost/day: **$537.50** + **$1,612.50**
- Approximate monthly cost: **$16,125.00** + **$48,375.00** = **$64,500.00**

### Options 1 and 2 - Latency

Classification is usually the fastest part of the pipeline. A reasonable planning estimate is **1.0–2.5 seconds per article** for a single Haiku request, depending on prompt size and concurrency. That makes it suitable for high-throughput async queues and near-real-time classification.

A practical planning estimate for Sonnet summary generation is **2.0–5.0 seconds per article** per request. That makes Sonnet the slower and more expensive stage, but also the one where quality matters most because summary quality is more noticeable to users than topic labels.

### Option 3: Self-hosted open model on CPU or GPU

A self-hosted route replaces Claude with a smaller hosted endpoint or open model served on dedicated compute. Hugging Face Inference Endpoints pricing shows CPU options starting around $0.03/hr and GPU options starting around $0.50/hr for T4, with L4 at $0.80/hr and A10G at $1.00/hr.

This route can look cheaper on raw infrastructure pricing, but it pushes model quality, throughput, batching, scaling, maintenance, and observability onto the application owner. That is the main tradeoff.

#### CPU scenario

CPU can be attractive for very small classification models or offline preprocessing, but it is usually a poor fit for high-volume generative summarization. Hourly cost is low, but latency and throughput are likely to be the bottleneck.

Illustrative single-replica infra cost:

| Instance        | Hourly |  Daily | Monthly (30d) |
| --------------- | -----: | -----: | ------------: |
| 1 vCPU / 2 GB   |  $0.03 |  $0.72 |    $21.60 [4] |
| 2 vCPU / 4 GB   |  $0.07 |  $1.68 |    $50.40 [4] |
| 4 vCPU / 8 GB   |  $0.13 |  $3.12 |    $93.60 [4] |
| 8 vCPU / 16 GB  |  $0.27 |  $6.48 |   $194.40 [4] |
| 16 vCPU / 32 GB |  $0.54 | $12.96 |   $388.80 [4] |

Latency planning assumptions for CPU-hosted summarization/classification:

| Path                          | Assumed latency per article | Comment                                                     |
| ----------------------------- | --------------------------: | ----------------------------------------------------------- |
| Small local classifier only   |                   0.5s–2.0s | Feasible for sentiment/topics, not ideal for summarization. |
| Small local summarizer on CPU |                     5s–20s+ | Often too slow for 50k/day unless heavily parallelized.     |

At 50,000 articles/day, even a 5-second average processing time implies about 69.4 continuous processing hours of work per day, meaning multiple replicas would be required just to keep up. That makes CPU more realistic for cheap preprocessing or classification than for end-to-end enrichment at scale.

#### GPU scenario

GPU-backed endpoints are much more plausible for self-hosted summarization. Based on current Hugging Face pricing, the entry points are approximately $0.50/hr for T4, $0.80/hr for L4, and $1.00/hr for A10G.

Illustrative single-replica infra cost:

| Instance | Hourly |  Daily | Monthly (30d) |
| -------- | -----: | -----: | ------------: |
| T4       |  $0.50 | $12.00 |       $360.00 |
| L4       |  $0.80 | $19.20 |       $576.00 |
| A10G     |  $1.00 | $24.00 |       $720.00 |
| A100     |  $4.00 | $96.00 |     $2,880.00 |

Latency planning assumptions for GPU-hosted open models:

| Path                              | Assumed latency per article | Comment                                      |
| --------------------------------- | --------------------------: | -------------------------------------------- |
| Small instruct model on T4/L4     |                   1.5s–6.0s | Plausible for shorter outputs with batching. |
| Better quality model on A10G/L40S |                   1.0s–4.0s | Better throughput, higher infra cost.        |

These estimates suggest that GPU self-hosting can be dramatically cheaper than Claude API usage on raw infra spend alone, but the comparison is not apples-to-apples because Claude pricing includes managed model quality, availability, scaling, and operational simplicity.

### Production Recommendation

For a fast go live, making use of Haiku would be quick, however costly.

Once that is up and running, and the system is designed in a way to allow vendor selection, we can look to introduce a self hosted model capable of classification and summarization. We can than choose to push articles onto our self-hosted system, while keeping Antropic as a fallback in case of outages and issues, possibly even taking some of the load in case of spikes.

---

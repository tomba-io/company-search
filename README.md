# Tomba Company Search

[![Price](https://img.shields.io/badge/Price-%243.12%20per%201K%20pages-brightgreen)](#pricing)
[![No signup](https://img.shields.io/badge/Tomba%20account-not%20needed-blue)](#quick-start)
[![No rate limit](https://img.shields.io/badge/Rate%20limit-none-brightgreen)](#built-for-big-lists)

**Build a list of companies that match your ideal customer profile in minutes.** Describe who you're looking for in plain words, or filter by location, industry, size, revenue, technologies and more, and get a clean list of companies with website, address, phone, social profiles and firmographics, ready to export.

No Tomba account. No API key. No subscription. **You pay $0.00312 per page of results, and only when Tomba answers.**

## Why teams choose this Actor

- **Start in 30 seconds**: Open the Actor, type a search like "technology companies in san francisco", click Start. Nothing to sign up for
- **Search the way you think**: Plain-language queries, precise include/exclude filters, or both
- **$3.12 per 1,000 pages**: Every page returns a batch of companies. No monthly plan, no credits that expire, no minimum spend
- **Pay only for answers**: Errors, invalid searches and temporary failures are free
- **Rich company profiles**: Industry, size, revenue, founding year, full address, phone, LinkedIn, Facebook and Twitter, plus how many emails Tomba knows for each company
- **Never pay twice**: Pages you fetched in the last 24 hours come back from cache for free
- **Export anywhere**: Download as CSV, Excel or JSON, or send results straight to your CRM with Apify integrations

## What you can do with it

| Goal                       | How Company Search helps                                                        |
| -------------------------- | ------------------------------------------------------------------------------- |
| **Build prospect lists**   | Turn your ideal customer profile into a list of real companies                  |
| **Plan sales territories** | List every relevant company in a country, state or city                         |
| **Target by tech stack**   | Find companies that use (or don't use) React, AWS, Shopify, Salesforce and more |
| **Research markets**       | Size an industry by location, company size or revenue                           |
| **Find look-alikes**       | Find companies similar to your best customers with the `similar` filter         |
| **Source talent or deals** | Spot growing companies in the sectors you hire from or invest in                |

## Quick start

1. Click **Try for free**
2. Type a **Search query** (for example `technology companies in san francisco`) and/or set **Company filters**
3. Click **Start**, then download your results as CSV, Excel or JSON

That's it. No Tomba account or API key is needed.

## Input

Provide a `query`, `filters`, or both.

| Field           | Required | Default | Description                                                                    |
| --------------- | -------- | ------- | ------------------------------------------------------------------------------ |
| `query`         | No\*     |         | What you're looking for, in plain words, e.g. `software companies in new york` |
| `filters`       | No\*     |         | Include/exclude filters (see below)                                            |
| `source`        | No       | all     | Only return these fields, e.g. `["name", "website_url", "industry"]`           |
| `maxResults`    | No       | `100`   | Maximum number of companies to return (up to 100,000)                          |
| `page`          | No       | `1`     | First page to fetch. Use it to continue a list you already started             |
| `maxRetries`    | No       | `3`     | How many times to retry a temporary failure (0–10)                             |
| `useCache`      | No       | `true`  | Reuse results from your previous runs for free                                 |
| `cacheTtlHours` | No       | `24`    | How long cached results stay valid (`0` turns the cache off)                   |

\* At least one of `query` or `filters` is required.

Every filter takes an `include` list, an `exclude` list, or both:

| Filter             | Example                                                  |
| ------------------ | -------------------------------------------------------- |
| `location_country` | `{ "include": ["US", "CA"] }` (two-letter country codes) |
| `location_state`   | `{ "include": ["california"] }`                          |
| `location_city`    | `{ "include": ["san francisco", "austin"] }`             |
| `industry`         | `{ "include": ["software"], "exclude": ["staffing"] }`   |
| `size`             | `{ "include": ["51-200", "201-500"] }`                   |
| `revenue`          | `{ "include": ["$10M-$50M"] }`                           |
| `type`             | `{ "include": ["privately held"] }`                      |
| `founded`          | `{ "include": ["2021", "2022", "2023"] }`                |
| `technologies`     | `{ "include": ["react", "aws"] }`                        |
| `keywords`         | `{ "include": ["fintech"] }`                             |
| `similar`          | `{ "include": ["stripe.com"] }`                          |
| `company`          | `{ "exclude": ["google"] }`                              |
| `sic`, `naics`     | `{ "include": ["7372"] }` (industry codes)               |

Company sizes: `1-10`, `11-50`, `51-200`, `201-500`, `501-1000`, `1000+`.

```json
{
    "query": "software companies",
    "filters": {
        "location_country": { "include": ["US"] },
        "size": { "include": ["51-200", "201-500"] },
        "technologies": { "include": ["react", "aws"] }
    },
    "maxResults": 500
}
```

## Output

You get one row per company:

```json
{
    "name": "Example Technology Inc.",
    "description": "Leading provider of innovative software solutions",
    "country": "US",
    "state": "California",
    "city": "San Francisco",
    "street_address": "123 Market Street",
    "postal_code": "94103",
    "industry": "Software",
    "company_size": "51-200",
    "type": "privately held",
    "founded": "2015",
    "website_url": "example.com",
    "total_emails": 150,
    "revenue": "$10M-$50M",
    "phone_number": "+1-415-555-0100",
    "linkedin_url": "https://www.linkedin.com/company/example",
    "facebook_url": "https://www.facebook.com/example",
    "twitter_url": "https://twitter.com/example",
    "total_similar": 25,
    "source": "tomba_company_search",
    "charged": true,
    "cached": false
}
```

| Field                                         | Description                                                  |
| --------------------------------------------- | ------------------------------------------------------------ |
| `name`                                        | Company name                                                 |
| `description`                                 | What the company does                                        |
| `website_url`                                 | Company website                                              |
| `industry`                                    | Industry sector                                              |
| `company_size`                                | Employee count range                                         |
| `type`                                        | Company type, e.g. privately held, public                    |
| `founded`                                     | Year founded                                                 |
| `revenue`                                     | Revenue range                                                |
| `country`, `state`, `city`                    | Location                                                     |
| `street_address`, `postal_code`               | Address                                                      |
| `phone_number`                                | Company phone number                                         |
| `linkedin_url`, `facebook_url`, `twitter_url` | Social profiles (other networks are included when available) |
| `total_emails`                                | How many email addresses Tomba knows for this company        |
| `total_similar`                               | How many similar companies Tomba knows                       |
| `source`                                      | Always `tomba_company_search`                                |
| `charged`                                     | `true` if the page this company came from was billed         |
| `cached`                                      | `true` if this result came from the cache (free)             |

If you use `source` to pick fields, only those fields are returned. When a search finds nothing, you get a single row with `query`, `page` and an `error` explaining why.

## Pricing

**$0.00312 per page request ($3.12 per 1,000 pages).** No subscription and no Tomba account needed.

Results come in pages. Each page request returns one batch of matching companies, and the Actor keeps requesting the next page until it has saved `maxResults` companies or there are no more results. You pay once per page, not per company, and the last page stops early, so you never pay for empty pages after the end of your results.

You are only charged when Tomba returns a usable answer:

| What happens                                    | Charged       |
| ----------------------------------------------- | ------------- |
| A page of companies is returned                 | Yes, per page |
| Your search matches no companies                | Yes, one page |
| Invalid search or any other error               | No            |
| Temporary failure (it is retried automatically) | No            |
| Result served from the cache                    | No            |

Every row shows `charged` and `cached`, so you always know what you paid for. To cap your spend, set **Maximum cost per run** in the run options, or lower `maxResults`: the Actor stops cleanly when the limit is reached.

## Built for big lists

- **No rate limit**: pages are requested back to back, without delays
- **Up to 100,000 companies per run** with `maxResults`
- **Automatic retries**: temporary failures are retried for you, and never billed
- **Resumable**: if a run is interrupted, it continues from the next page without charging you again
- **Cache**: repeat searches within 24 hours are free

## Real-time API

Need results instantly inside your own app? This Actor also runs as a **real-time API** (Apify Standby mode): no run to start, no dataset to fetch, just an HTTP request that returns JSON in seconds. Pricing is the same.

```bash
curl "https://<your-standby-url>/?query=technology%20companies%20in%20san%20francisco&maxResults=20&source=name,website_url,industry" \
  -H "Authorization: Bearer <YOUR_APIFY_TOKEN>"
```

Pass `filters` as URL-encoded JSON, e.g. `&filters=%7B%22industry%22%3A%7B%22include%22%3A%5B%22software%22%5D%7D%7D`. Or simply `POST` the same JSON input as a normal run:

```bash
curl -X POST "https://<your-standby-url>/" \
  -H "Authorization: Bearer <YOUR_APIFY_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"query": "technology companies", "filters": {"location_country": {"include": ["US"]}, "size": {"include": ["51-200"]}}, "maxResults": 20}'
```

The response is `{ "items": [...] }`, with the same rows as the dataset. Find your Standby URL and the full OpenAPI description in the **API** tab of this Actor.

## Integrations

Run it on a schedule, call it from the Apify API, or connect it to Zapier, Make, Google Sheets, HubSpot, Slack and hundreds of other apps with [Apify integrations](https://docs.apify.com/platform/integrations). Webhooks let you trigger your own workflow as soon as a run finishes.

Tip: feed the `website_url` of each company into **Tomba Domain Search** to get the verified emails of the people who work there.

## FAQ

**Do I need a Tomba account or API key?**
No. Everything is built in. You only pay the per-page price on Apify.

**How much does it cost?**
$0.00312 per page of results ($3.12 per 1,000 pages). Errors, invalid searches and cached pages are free.

**Should I use a query or filters?**
Both work. A query is the fastest way to start ("fintech companies in london"). Filters give you exact control, including exclusions. You can combine them.

**Why was I charged when no companies matched?**
Tomba ran your search and answered that nothing matches it. That is a real answer, so it counts as one page. Try broader filters.

**How do I get fewer, more relevant results?**
Add filters (size, location, industry, technologies) and set `maxResults`. Precise filters mean more relevant companies on every page you pay for.

**Can I find companies like my best customers?**
Yes. Use the `similar` filter with their domains, for example `{ "similar": { "include": ["stripe.com"] } }`.

**What if my run is interrupted?**
It continues from the next page. Companies already saved are not charged again.

**How do I limit what I spend?**
Set **Maximum cost per run** before you start, or lower `maxResults`. The Actor stops as soon as the limit is reached.

## Support

Questions or feedback? We're happy to help:

- **Email**: support@tomba.io
- **Live chat**: on [tomba.io](https://tomba.io) during business hours
- **Issues**: use the **Issues** tab on this Actor's page

## About Tomba

Founded in 2020, [Tomba](https://tomba.io) is a B2B data platform for finding, verifying and enriching business contacts. Our Email Finder, Domain Search and Email Verifier help sales and marketing teams reach the right people.

![Tomba Logo](https://tomba.io/logo.png)

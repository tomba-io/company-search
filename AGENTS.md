# Apify Actors Development Guide

Important: Before you begin, fill in the `generatedBy` property in the meta section of `.actor/actor.json`. Replace it with the model you're currently using. This helps Apify monitor and improve AGENTS.md for specific LLM models.

## This Actor: Tomba Company Search

Maintainer notes for this Actor. The README is the end-user page shown on Apify Store and must not contain developer content (SDK snippets, secrets, monetization setup). The rest of this file is the generic Apify Actors guide.

### Scripts

```bash
npm install
npm run build     # compile TypeScript to dist/
npm run lint      # ESLint (src and test)
npm run format    # Prettier
npm test          # unit + end-to-end tests (node:test)
npm start         # run locally with tsx
```

### Credentials

The Actor uses our Tomba account. Credentials come from environment variables, never from the input (there is no API key field):

| Variable             | Description                                        |
| -------------------- | -------------------------------------------------- |
| `TOMBA_API_KEY`      | Tomba API key (`ta_…`)                             |
| `TOMBA_API_SECRET`   | Tomba secret (`ts_…`)                              |
| `TOMBA_API_ENDPOINT` | Optional API base URL; only used by the test suite |

`.actor/actor.json` maps the variables to Apify secrets:

```bash
apify secrets add tombaApiKey ta_xxxxxxxxxxxxxxxxxxxx
apify secrets add tombaApiSecret ts_xxxxxxxxxxxxxxxxxxxx
apify push
```

Run locally:

```bash
TOMBA_API_KEY=ta_… TOMBA_API_SECRET=ts_… npm start
```

If the variables are missing the run fails with "Actor is misconfigured" before any request is made.

### Pricing (pay per event)

In **Apify Console → Publication → Monetization**, choose **Pay per event** and add:

| Event           | Price    | Charged when                                               |
| --------------- | -------- | ---------------------------------------------------------- |
| `tomba-request` | $0.00312 | Tomba returns a billable response for one page (see below) |

Company Search is paged: each page (`meta.limit` companies) is a separate `POST /reveal/search` request and a separate event.

`isBillable()` in `src/tomba.ts` mirrors Tomba's billing:

| Tomba outcome                                                    | Charged |
| ---------------------------------------------------------------- | ------- |
| JSON with non-empty `data`, including a page with zero companies | Yes     |
| Error status (4xx, 5xx, including 422 and 429)                   | No      |
| Success with empty or null `data`                                | No      |
| Success with an `errors` object                                  | No      |
| Non-JSON body (reported as 502)                                  | No      |
| Cache hit                                                        | No      |

There is no client-side rate limit or delay between pages; 429 and 5xx responses are retried with exponential backoff.

### Architecture

- `src/tomba.ts`: shared helper, identical in every Tomba Actor. It handles credentials, caching (per-Actor `tomba-cache-<actorId>` key-value store; falls back to an in-run cache if it can't be opened), retries with exponential backoff, pay-per-event charging, budget reservation, the concurrency pool and resume state. Do not edit it in one Actor only.
- `src/main.ts`: input handling, paging and output mapping.
    - The run fails early when there is neither a `query` nor `filters`.
    - The request body is `{ query, filters, _source, page }` (`source` input → `_source`; empty values are left out).
    - Pages are fetched sequentially starting at `page`; `maxConcurrency` has no effect here.
    - Paging stops at `maxResults`, at `meta.pages`, at a short page (`< meta.limit`), at a non-billable or empty page, or when the charge limit is reached.
    - One dataset item per company: the Tomba company fields plus `source`, `charged`, `cached`. When the search returns nothing, one item `{ query, page, source, charged, cached, error }` is saved.
    - Resume (batch runs only): finished pages (`TOMBA_STATE`) and the number of companies saved (`COMPANY_SEARCH_PROGRESS`) are persisted, so a resumed run continues at the next page and still honours `maxResults`. In Standby mode this progress is kept in memory for the request only.
- The `tomba` SDK v1.1.1 resolves every call to `{ data, rateLimit }`, where `data` is the response body. Its `.d.ts` types still declare the old return type, so always go through `callTomba()`.

### Tests

- `test/tomba.test.ts`: unit tests for the shared helper (identical in every Actor)
- `test/main.test.ts`: end-to-end tests that run `src/main.ts` against a local mock Tomba API (paging, billing, cache, retries, charge limit and resume, credentials, Standby HTTP API)
- `test/helpers.ts`: mock server and Actor runner (identical in every Actor)

Locally, the Apify SDK prices every event at $1 when `ACTOR_TEST_PAY_PER_EVENT=true`, so the tests use `maxTotalChargeUsd` as an event count.

### Standby mode (real-time API)

`.actor/actor.json` sets `usesStandbyMode: true` and `webServerSchema: ./web_server_schema.json` (OpenAPI 3).

- `src/standby.ts` (shared, identical in every Actor): `runActor()` runs a batch job, or, when `APIFY_META_ORIGIN=STANDBY`, starts an HTTP server on `Actor.config.get('containerPort')`.
    - `GET /` with the `x-apify-container-server-readiness-probe` header, or with no query: readiness / usage.
    - `GET /?…`: input built by `fromQuery()` in `src/main.ts` (`query`, `filters` as a JSON string, `source` as repeated or comma-separated values, `page`, `maxResults`). Invalid `filters` JSON is a `400`.
    - `POST /`: the same JSON input as a batch run.
    - Responses: `200 { items }`, `400` invalid input (`InputError`), `402` max charge limit reached, `404`, `405`.
- `run(input, ctx)` is shared by both modes: `ctx.push()` writes to the dataset in batch runs and to the HTTP response in Standby; `ctx.isDone()`/`ctx.markDone()` persist resume state only in batch runs. `COMPANY_SEARCH_PROGRESS` is only used in batch runs.
- `maxResults` is a local loop condition, never `stop()` (a global flag reserved for the charge limit).
- Caching and pay-per-event charging work the same in both modes.

Try it locally:

```bash
APIFY_META_ORIGIN=STANDBY ACTOR_WEB_SERVER_PORT=8080 TOMBA_API_KEY=ta_… TOMBA_API_SECRET=ts_… npm start
curl "localhost:8080/?query=software%20companies&maxResults=10"
```

### Key-value store schema

`.actor/key_value_store_schema.json` documents the default key-value store records (`INPUT`, `TOMBA_STATE`, `COMPANY_SEARCH_PROGRESS`). The cross-run cache lives in the separate named store `tomba-cache-<actorId>`, one per Actor: under limited permissions an Actor can only open named storages it created itself, so the Tomba Actors must not share one store. If the store can't be opened, the run logs a warning and caches for this run only.

### Memory

`defaultMemoryMbytes` is 256: the Actor only makes HTTP calls, so more memory just costs more.

## What are Apify Actors?

- Actors are serverless programs that run in the cloud. They're inspired by the UNIX philosophy - programs that do one thing well and can be easily combined to build complex systems.
- Actors are programs packaged as Docker images that run in isolated containers

## Core Concepts

- Accept well-defined JSON input
- Perform isolated tasks (web scraping, automation, data processing)
- Produce structured JSON output to datasets and/or store data in key-value stores
- Can run from seconds to hours or even indefinitely
- Persist state and can be restarted

## Do

- accept well-defined JSON input and produce structured JSON output
- use Apify SDK (`apify`) for code running ON Apify platform
- validate input early with proper error handling and fail gracefully
- use CheerioCrawler for static HTML content (10x faster than browsers)
- use PlaywrightCrawler only for JavaScript-heavy sites and dynamic content
- use router pattern (createCheerioRouter/createPlaywrightRouter) for complex crawls
- implement retry strategies with exponential backoff for failed requests
- use proper concurrency settings (HTTP: 10-50, Browser: 1-5)
- set sensible defaults in `.actor/input_schema.json` for all optional fields
- set up output schema in `.actor/output_schema.json`
- clean and validate data before pushing to dataset
- use semantic CSS selectors and fallback strategies for missing elements
- respect robots.txt, ToS, and implement rate limiting with delays when scraping (this Actor calls the Tomba API and needs no client-side rate limit)
- check which tools (cheerio/playwright/crawlee) are installed before applying guidance

## Don't

- do not rely on `Dataset.getInfo()` for final counts on Cloud platform
- do not use browser crawlers when HTTP/Cheerio works (massive performance gains with HTTP)
- do not hard code values that should be in input schema or environment variables
- do not skip input validation or error handling
- do not overload servers - use appropriate concurrency and delays
- do not scrape prohibited content or ignore Terms of Service
- do not store personal/sensitive data unless explicitly permitted
- do not use deprecated options like `requestHandlerTimeoutMillis` on CheerioCrawler (v3.x)
- do not use `additionalHttpHeaders` - use `preNavigationHooks` instead

## Commands

```bash
# Local development
apify run                              # Run Actor locally

# Authentication & deployment
apify login                            # Authenticate account
apify push                             # Deploy to Apify platform

# Help
apify help                             # List all commands
```

## Safety and Permissions

Allowed without prompt:

- read files with `Actor.getValue()`
- push data with `Actor.pushData()`
- set values with `Actor.setValue()`
- enqueue requests to RequestQueue
- run locally with `apify run`

Ask first:

- npm/pip package installations
- apify push (deployment to cloud)
- proxy configuration changes (requires paid plan)
- Dockerfile changes affecting builds
- deleting datasets or key-value stores

## Project Structure

.actor/
├── actor.json # Actor config: name, version, env vars, runtime settings
├── input_schema.json # Input validation & Console form definition
└── output_schema.json # Specifies where an Actor stores its output
src/
├── main.ts # Actor entry point: input, paging, output
└── tomba.ts # Shared Tomba helper (identical in every Tomba Actor)
test/ # node:test unit and end-to-end tests
storage/ # Local storage (mirrors Cloud during development)
├── datasets/ # Output items (JSON objects)
├── key_value_stores/ # Files, config, INPUT
└── request_queues/ # Pending crawl requests
Dockerfile # Container image definition
AGENTS.md # AI agent instructions (this file)

## Actor Input Schema

The input schema defines the input parameters for an Actor. It's a JSON object comprising various field types supported by the Apify platform.

### Structure

```json
{
    "title": "<INPUT-SCHEMA-TITLE>",
    "type": "object",
    "schemaVersion": 1,
    "properties": {
        /* define input fields here */
    },
    "required": []
}
```

### Example

```json
{
    "title": "E-commerce Product Scraper Input",
    "type": "object",
    "schemaVersion": 1,
    "properties": {
        "startUrls": {
            "title": "Start URLs",
            "type": "array",
            "description": "URLs to start scraping from (category pages or product pages)",
            "editor": "requestListSources",
            "default": [{ "url": "https://example.com/category" }],
            "prefill": [{ "url": "https://example.com/category" }]
        },
        "followVariants": {
            "title": "Follow Product Variants",
            "type": "boolean",
            "description": "Whether to scrape product variants (different colors, sizes)",
            "default": true
        },
        "maxRequestsPerCrawl": {
            "title": "Max Requests per Crawl",
            "type": "integer",
            "description": "Maximum number of pages to scrape (0 = unlimited)",
            "default": 1000,
            "minimum": 0
        },
        "proxyConfiguration": {
            "title": "Proxy Configuration",
            "type": "object",
            "description": "Proxy settings for anti-bot protection",
            "editor": "proxy",
            "default": { "useApifyProxy": false }
        },
        "locale": {
            "title": "Locale",
            "type": "string",
            "description": "Language/country code for localized content",
            "default": "cs",
            "enum": ["cs", "en", "de", "sk"],
            "enumTitles": ["Czech", "English", "German", "Slovak"]
        }
    },
    "required": ["startUrls"]
}
```

## Actor Output Schema

The Actor output schema builds upon the schemas for the dataset and key-value store. It specifies where an Actor stores its output and defines templates for accessing that output. Apify Console uses these output definitions to display run results.

### Structure

```json
{
    "actorOutputSchemaVersion": 1,
    "title": "<OUTPUT-SCHEMA-TITLE>",
    "properties": {
        /* define your outputs here */
    }
}
```

### Example

```json
{
    "actorOutputSchemaVersion": 1,
    "title": "Output schema of the files scraper",
    "properties": {
        "files": {
            "type": "string",
            "title": "Files",
            "template": "{{links.apiDefaultKeyValueStoreUrl}}/keys"
        },
        "dataset": {
            "type": "string",
            "title": "Dataset",
            "template": "{{links.apiDefaultDatasetUrl}}/items"
        }
    }
}
```

### Output Schema Template Variables

- `links` (object) - Contains quick links to most commonly used URLs
- `links.publicRunUrl` (string) - Public run url in format `https://console.apify.com/view/runs/:runId`
- `links.consoleRunUrl` (string) - Console run url in format `https://console.apify.com/actors/runs/:runId`
- `links.apiRunUrl` (string) - API run url in format `https://api.apify.com/v2/actor-runs/:runId`
- `links.apiDefaultDatasetUrl` (string) - API url of default dataset in format `https://api.apify.com/v2/datasets/:defaultDatasetId`
- `links.apiDefaultKeyValueStoreUrl` (string) - API url of default key-value store in format `https://api.apify.com/v2/key-value-stores/:defaultKeyValueStoreId`
- `links.containerRunUrl` (string) - URL of a webserver running inside the run in format `https://<containerId>.runs.apify.net/`
- `run` (object) - Contains information about the run same as it is returned from the `GET Run` API endpoint
- `run.defaultDatasetId` (string) - ID of the default dataset
- `run.defaultKeyValueStoreId` (string) - ID of the default key-value store

## Dataset Schema Specification

The dataset schema defines how your Actor's output data is structured, transformed, and displayed in the Output tab in the Apify Console.

### Example

Consider an example Actor that calls `Actor.pushData()` to store data into dataset:

```typescript
import { Actor } from 'apify';
// Initialize the JavaScript SDK
await Actor.init();

/**
 * Actor code
 */
await Actor.pushData({
    numericField: 10,
    pictureUrl: 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png',
    linkUrl: 'https://google.com',
    textField: 'Google',
    booleanField: true,
    dateField: new Date(),
    arrayField: ['#hello', '#world'],
    objectField: {},
});

// Exit successfully
await Actor.exit();
```

To set up the Actor's output tab UI, reference a dataset schema file in `.actor/actor.json`:

```json
{
    "actorSpecification": 1,
    "name": "book-library-scraper",
    "title": "Book Library Scraper",
    "version": "1.0.0",
    "storages": {
        "dataset": "./dataset_schema.json"
    }
}
```

Then create the dataset schema in `.actor/dataset_schema.json`:

```json
{
    "actorSpecification": 1,
    "fields": {},
    "views": {
        "overview": {
            "title": "Overview",
            "transformation": {
                "fields": [
                    "pictureUrl",
                    "linkUrl",
                    "textField",
                    "booleanField",
                    "arrayField",
                    "objectField",
                    "dateField",
                    "numericField"
                ]
            },
            "display": {
                "component": "table",
                "properties": {
                    "pictureUrl": {
                        "label": "Image",
                        "format": "image"
                    },
                    "linkUrl": {
                        "label": "Link",
                        "format": "link"
                    },
                    "textField": {
                        "label": "Text",
                        "format": "text"
                    },
                    "booleanField": {
                        "label": "Boolean",
                        "format": "boolean"
                    },
                    "arrayField": {
                        "label": "Array",
                        "format": "array"
                    },
                    "objectField": {
                        "label": "Object",
                        "format": "object"
                    },
                    "dateField": {
                        "label": "Date",
                        "format": "date"
                    },
                    "numericField": {
                        "label": "Number",
                        "format": "number"
                    }
                }
            }
        }
    }
}
```

### Structure

```json
{
    "actorSpecification": 1,
    "fields": {},
    "views": {
        "<VIEW_NAME>": {
            "title": "string (required)",
            "description": "string (optional)",
            "transformation": {
                "fields": ["string (required)"],
                "unwind": ["string (optional)"],
                "flatten": ["string (optional)"],
                "omit": ["string (optional)"],
                "limit": "integer (optional)",
                "desc": "boolean (optional)"
            },
            "display": {
                "component": "table (required)",
                "properties": {
                    "<FIELD_NAME>": {
                        "label": "string (optional)",
                        "format": "text|number|date|link|boolean|image|array|object (optional)"
                    }
                }
            }
        }
    }
}
```

**Dataset Schema Properties:**

- `actorSpecification` (integer, required) - Specifies the version of dataset schema structure document (currently only version 1)
- `fields` (JSONSchema object, required) - Schema of one dataset object (use JsonSchema Draft 2020-12 or compatible)
- `views` (DatasetView object, required) - Object with API and UI views description

**DatasetView Properties:**

- `title` (string, required) - Visible in UI Output tab and API
- `description` (string, optional) - Only available in API response
- `transformation` (ViewTransformation object, required) - Data transformation applied when loading from Dataset API
- `display` (ViewDisplay object, required) - Output tab UI visualization definition

**ViewTransformation Properties:**

- `fields` (string[], required) - Fields to present in output (order matches column order)
- `unwind` (string[], optional) - Deconstructs nested children into parent object
- `flatten` (string[], optional) - Transforms nested object into flat structure
- `omit` (string[], optional) - Removes specified fields from output
- `limit` (integer, optional) - Maximum number of results (default: all)
- `desc` (boolean, optional) - Sort order (true = newest first)

**ViewDisplay Properties:**

- `component` (string, required) - Only `table` is available
- `properties` (Object, optional) - Keys matching `transformation.fields` with ViewDisplayProperty values

**ViewDisplayProperty Properties:**

- `label` (string, optional) - Table column header
- `format` (string, optional) - One of: `text`, `number`, `date`, `link`, `boolean`, `image`, `array`, `object`

## Key-Value Store Schema Specification

The key-value store schema organizes keys into logical groups called collections for easier data management.

### Example

Consider an example Actor that calls `Actor.setValue()` to save records into the key-value store:

```typescript
import { Actor } from 'apify';
// Initialize the JavaScript SDK
await Actor.init();

/**
 * Actor code
 */
await Actor.setValue('document-1', 'my text data', { contentType: 'text/plain' });

await Actor.setValue(`image-${imageID}`, imageBuffer, { contentType: 'image/jpeg' });

// Exit successfully
await Actor.exit();
```

To configure the key-value store schema, reference a schema file in `.actor/actor.json`:

```json
{
    "actorSpecification": 1,
    "name": "data-collector",
    "title": "Data Collector",
    "version": "1.0.0",
    "storages": {
        "keyValueStore": "./key_value_store_schema.json"
    }
}
```

Then create the key-value store schema in `.actor/key_value_store_schema.json`:

```json
{
    "actorKeyValueStoreSchemaVersion": 1,
    "title": "Key-Value Store Schema",
    "collections": {
        "documents": {
            "title": "Documents",
            "description": "Text documents stored by the Actor",
            "keyPrefix": "document-"
        },
        "images": {
            "title": "Images",
            "description": "Images stored by the Actor",
            "keyPrefix": "image-",
            "contentTypes": ["image/jpeg"]
        }
    }
}
```

### Structure

```json
{
    "actorKeyValueStoreSchemaVersion": 1,
    "title": "string (required)",
    "description": "string (optional)",
    "collections": {
        "<COLLECTION_NAME>": {
            "title": "string (required)",
            "description": "string (optional)",
            "key": "string (conditional - use key OR keyPrefix)",
            "keyPrefix": "string (conditional - use key OR keyPrefix)",
            "contentTypes": ["string (optional)"],
            "jsonSchema": "object (optional)"
        }
    }
}
```

**Key-Value Store Schema Properties:**

- `actorKeyValueStoreSchemaVersion` (integer, required) - Version of key-value store schema structure document (currently only version 1)
- `title` (string, required) - Title of the schema
- `description` (string, optional) - Description of the schema
- `collections` (Object, required) - Object where each key is a collection ID and value is a Collection object

**Collection Properties:**

- `title` (string, required) - Collection title shown in UI tabs
- `description` (string, optional) - Description appearing in UI tooltips
- `key` (string, conditional) - Single specific key for this collection
- `keyPrefix` (string, conditional) - Prefix for keys included in this collection
- `contentTypes` (string[], optional) - Allowed content types for validation
- `jsonSchema` (object, optional) - JSON Schema Draft 07 format for `application/json` content type validation

Either `key` or `keyPrefix` must be specified for each collection, but not both.

## Apify MCP Tools

If MCP server is configured, use these tools for documentation:

- `search-apify-docs` - Search documentation
- `fetch-apify-docs` - Get full doc pages

Otherwise, reference: `@https://mcp.apify.com/`

## Resources

- [docs.apify.com/llms.txt](https://docs.apify.com/llms.txt) - Quick reference
- [docs.apify.com/llms-full.txt](https://docs.apify.com/llms-full.txt) - Complete docs
- [crawlee.dev](https://crawlee.dev) - Crawlee documentation
- [whitepaper.actor](https://raw.githubusercontent.com/apify/actor-whitepaper/refs/heads/master/README.md) - Complete Actor specification

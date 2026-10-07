# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-07

### ⚠ BREAKING CHANGES

- `tombaApiKey` and `tombaApiSecret` inputs were removed. The Actor now uses built-in Tomba credentials from the `TOMBA_API_KEY` / `TOMBA_API_SECRET` environment variables, so users no longer need a Tomba account.

### Features

- Pay-per-event pricing: $0.00312 per billable page request (`tomba-request`); errors and cache hits are free
- No client-side rate limit (removed the 50 req/min limiter); pages are fetched back to back
- Automatic retries with exponential backoff for network errors, 429 and 5xx (`maxRetries`)
- Cross-run result cache (`useCache`, `cacheTtlHours`)
- Resume after migration or restart (continues from the next page)
- Each dataset item now includes `charged` and `cached`; a failed or empty search saves an item with `error`
- Standby mode: real-time HTTP API (`GET /?query=…` or `POST /` with the run input) with an OpenAPI web server schema
- Key-value store schema for `INPUT`, `TOMBA_STATE` and `COMPANY_SEARCH_PROGRESS`
- 256 MB default memory

### Dependencies

- `tomba` upgraded to 1.1.1 (responses are now `{ data, rateLimit }`)
- `apify` upgraded to 3.7.2

### Bug Fixes

- Runs on Apify no longer fail with "Schema validation failed": `phone_number` is a boolean in Tomba's response, and the dataset schema now accepts it (and `null` for every Tomba field)

## [0.0.1] - 2025-11-15

### Added

- Initial release of Tomba Company Search Actor
- Natural language company search functionality
- Advanced filtering by:
    - Location (country, state, city)
    - Industry sector
    - Company size (employee count ranges)
    - Company type
    - Keywords and technologies used
    - Revenue ranges
    - Founded year
    - SIC and NAICS codes
    - Similar companies
- Comprehensive company data including:
    - Company details (name, description, location)
    - Contact information (phone, website)
    - Social media profiles (LinkedIn, Facebook, Twitter)
    - Firmographics (size, revenue, industry, type)
    - Email count
- Pagination support with configurable max results (up to 1000)
- Rate limiting (50 req/min)
- Include/exclude filter options for all criteria
- Custom field selection with `source` parameter
- Input validation and error handling
- Comprehensive README with examples and FAQ
- JSON schemas for input, output, and dataset

### Features

- Integration with Tomba Reveal API
- Automatic pagination handling
- Built-in rate limiting to respect API limits
- Flexible filtering with include/exclude options
- Support for multiple filter combinations
- Scalable up to 1000 results per run

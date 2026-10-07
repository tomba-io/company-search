import { Actor, log } from 'apify';
import type { CompanyFilters } from 'tomba';
import { Reveal } from 'tomba';

import type { RunOptions } from './tomba.js';
import { callTomba, isBillable, logSummary, setupTomba, useRunState } from './tomba.js';

interface ActorInput extends RunOptions {
    query?: string;
    filters?: CompanyFilters;
    source?: string[];
    page?: number;
    maxResults?: number;
}

interface SearchBody {
    data?: { companies?: Record<string, unknown>[] };
    meta?: { total?: number; page?: number; limit?: number; pages?: number };
}

const SOURCE = 'tomba_company_search';

await Actor.init();

const input = (await Actor.getInput<ActorInput>()) ?? {};
const query = input.query?.trim() || undefined;
const filters = input.filters && Object.keys(input.filters).length > 0 ? input.filters : undefined;
if (!query && !filters) {
    await Actor.fail('Input must contain a search "query", "filters", or both.');
}
const {
    source: fields,
    page: startPage = 1,
    maxResults = 100,
    maxConcurrency,
    maxRetries,
    useCache,
    cacheTtlHours,
} = input;
const client = await setupTomba({ maxConcurrency, maxRetries, useCache, cacheTtlHours });
const reveal = new Reveal(client);

// Resume: pages already processed are skipped, and the number of companies already pushed is kept.
const state = await useRunState();
const progress = await Actor.useState<{ pushed: number }>('COMPANY_SEARCH_PROGRESS', { pushed: 0 });
if (Object.keys(state.done).length > 0) {
    log.info(
        `Resuming: ${Object.keys(state.done).length} pages already processed, ${progress.pushed} companies saved.`,
    );
}

const startedAt = Date.now();
let pagesRequested = 0;
log.info('Searching companies', { query, filters, maxResults });

// One query: pages are fetched sequentially, each page is one billable request.
for (let page = Math.max(1, startPage); progress.pushed < maxResults; page++) {
    if (state.done[`page:${page}`]) continue;

    const params = { query, filters, _source: fields?.length ? fields : undefined, page };
    const res = await callTomba('companies-search', params, async () => reveal.companiesSearch(params));
    if (res.skipped) break;
    pagesRequested++;

    const body = res.body as SearchBody | undefined;
    const companies = Array.isArray(body?.data?.companies) ? body.data.companies : [];

    if (!isBillable(res.body) || companies.length === 0) {
        if (progress.pushed === 0) {
            await Actor.pushData({
                query: query ?? null,
                page,
                source: SOURCE,
                charged: res.charged,
                cached: res.cached,
                error: res.error ?? 'No companies found',
            });
        }
        log.info(`Page ${page}: ${res.error ?? 'no companies found'}`);
        state.done[`page:${page}`] = true;
        break;
    }

    const items = companies.slice(0, Math.max(0, maxResults - progress.pushed)).map((company) => ({
        ...company,
        source: SOURCE,
        charged: res.charged,
        cached: res.cached,
    }));
    await Actor.pushData(items);
    progress.pushed += items.length;
    state.done[`page:${page}`] = true;

    const totalPages = body?.meta?.pages;
    log.info(
        `Page ${page}${typeof totalPages === 'number' ? ` of ${totalPages}` : ''}: ${items.length} companies${res.cached ? ' (cached)' : ''}`,
        { total: body?.meta?.total },
    );

    const pageSize = body?.meta?.limit;
    if (typeof totalPages === 'number' && page >= totalPages) break;
    // A short page is the last one: don't pay for an extra empty page.
    if (typeof pageSize === 'number' && companies.length < pageSize) break;
}

log.info(`Total companies saved: ${progress.pushed}`, { pagesRequested });
logSummary('Company Search', 1, startedAt);

await Actor.exit();

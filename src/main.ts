import { Actor, log } from 'apify';
import type { CompanyFilters } from 'tomba';
import { Reveal } from 'tomba';

import { InputError, queryInt, queryList, queryString, runActor } from './standby.js';
import type { RunOptions } from './tomba.js';
import { callTomba, getClient, isBillable } from './tomba.js';

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

/** `filters` query parameter: a JSON object, e.g. `{"industry":{"include":["software"]}}`. */
function parseFilters(value: string | undefined): CompanyFilters | undefined {
    if (value === undefined) return undefined;
    let filters: unknown;
    try {
        filters = JSON.parse(value);
    } catch {
        throw new InputError('Query parameter "filters" must be a JSON object.');
    }
    if (typeof filters !== 'object' || filters === null || Array.isArray(filters)) {
        throw new InputError('Query parameter "filters" must be a JSON object.');
    }
    return filters as CompanyFilters;
}

await runActor<ActorInput>({
    title: 'Company Search',
    count: () => 1,
    fromQuery: (query) => {
        const source = queryList(query, 'source');
        return {
            query: queryString(query, 'query'),
            filters: parseFilters(queryString(query, 'filters')),
            source: source.length ? source : undefined,
            page: queryInt(query, 'page'),
            maxResults: queryInt(query, 'maxResults'),
        };
    },
    run: async (input, { push, isDone, markDone, standby }) => {
        const query = input.query?.trim() || undefined;
        const filters = input.filters && Object.keys(input.filters).length > 0 ? input.filters : undefined;
        if (!query && !filters) {
            throw new InputError('Input must contain a search "query", "filters", or both.');
        }
        const { source: fields, page: startPage = 1, maxResults = 100 } = input;
        const reveal = new Reveal(getClient());

        // Resume (batch runs only): pages already processed are skipped, and the number of companies
        // already pushed is kept. In Standby mode the progress only lives for this request.
        const progress = standby
            ? { pushed: 0 }
            : await Actor.useState<{ pushed: number }>('COMPANY_SEARCH_PROGRESS', { pushed: 0 });
        if (progress.pushed > 0) {
            log.info(`Resuming: ${progress.pushed} companies already saved.`);
        }

        let pagesRequested = 0;
        if (!standby) log.info('Searching companies', { query, filters, maxResults });

        // One query: pages are fetched sequentially, each page is one billable request.
        for (let page = Math.max(1, startPage); progress.pushed < maxResults; page++) {
            if (isDone(`page:${page}`)) continue;

            const params = { query, filters, _source: fields?.length ? fields : undefined, page };
            const res = await callTomba('companies-search', params, async () => reveal.companiesSearch(params));
            if (res.skipped) break;
            pagesRequested++;

            const body = res.body as SearchBody | undefined;
            const companies = Array.isArray(body?.data?.companies) ? body.data.companies : [];

            if (!isBillable(res.body) || companies.length === 0) {
                if (progress.pushed === 0) {
                    await push({
                        query: query ?? null,
                        page,
                        source: SOURCE,
                        charged: res.charged,
                        cached: res.cached,
                        error: res.error ?? 'No companies found',
                    });
                }
                log.info(`Page ${page}: ${res.error ?? 'no companies found'}`);
                markDone(`page:${page}`);
                break;
            }

            const items = companies.slice(0, Math.max(0, maxResults - progress.pushed)).map((company) => ({
                ...company,
                source: SOURCE,
                charged: res.charged,
                cached: res.cached,
            }));
            await push(items);
            progress.pushed += items.length;
            markDone(`page:${page}`);

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
    },
});

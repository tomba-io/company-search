// End-to-end tests: run the Actor against a mock Tomba API.
import assert from 'node:assert/strict';
import { after, afterEach, describe, it } from 'node:test';

import type { MockHandler, MockRequest, MockServer } from './helpers.js';
import { removeStorage, runActor, startMockTomba, startStandbyActor, totalCharges } from './helpers.js';

const PAGE_SIZE = 10;

function company(n: number) {
    return {
        name: `Company ${n}`,
        description: 'Leading provider of innovative software solutions',
        country: 'US',
        state: 'California',
        street_address: '123 Market Street',
        postal_code: '94103',
        industry: 'Software',
        company_size: '51-200',
        type: 'privately held',
        founded: '2015',
        city: 'San Francisco',
        website_url: `company${n}.com`,
        total_emails: 150,
        revenue: '$10M-$50M',
        phone_number: '+1-415-555-0100',
        linkedin_url: `https://www.linkedin.com/company/company${n}`,
        facebook_url: `https://www.facebook.com/company${n}`,
        twitter_url: `https://twitter.com/company${n}`,
        total_similar: 25,
    };
}

/** Number of companies matching each test query (default 25). */
const TOTALS: Record<string, number> = { big: 60, exact: 20, none: 0, nopages: 15 };

interface SearchRequest {
    query?: string;
    filters?: Record<string, unknown>;
    _source?: string[];
    page?: number;
}

/** A realistic paged Companies Search response. */
function searchPage(params: SearchRequest) {
    const query = params.query ?? 'filters';
    const total = TOTALS[query] ?? 25;
    const page = params.page ?? 1;
    const first = (page - 1) * PAGE_SIZE;
    const companies = Array.from({ length: Math.max(0, Math.min(PAGE_SIZE, total - first)) }, (_, i) =>
        company(first + i + 1),
    );
    const pages = Math.ceil(total / PAGE_SIZE);
    return {
        success: true,
        data: { companies },
        meta: {
            total,
            page,
            limit: PAGE_SIZE,
            ...(query === 'nopages' ? {} : { pages }),
            ...(params.filters ? { filters: params.filters } : {}),
        },
    };
}

const body = (req: MockRequest) => req.body as SearchRequest;

/** Default Tomba behaviour. */
const tomba: MockHandler = (req) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.path, '/reveal/search');
    const params = body(req);
    if (params.query === 'empty') return { body: { data: null } };
    if (params.query === 'invalid') return { status: 422, body: { errors: { message: 'Invalid query' } } };
    if (params.query === 'html') return { raw: '<html>Bad gateway</html>' };
    return { body: searchPage(params) };
};

const servers: MockServer[] = [];
const dirs: string[] = [];

async function mock(handler: MockHandler = tomba): Promise<MockServer> {
    const server = await startMockTomba(handler);
    servers.push(server);
    return server;
}

async function run(...args: Parameters<typeof runActor>) {
    const result = await runActor(...args);
    dirs.push(result.storageDir);
    return result;
}

const pagesRequested = (server: MockServer) => server.requests.map((r) => body(r).page);

afterEach(async () => {
    await Promise.all(servers.splice(0).map(async (s) => s.close()));
});

after(async () => {
    await Promise.all(dirs.map(removeStorage));
});

describe('company-search', () => {
    it('returns one item per company and charges one event per billable page', async () => {
        const server = await mock();
        const result = await run({ input: { query: 'tech', maxResults: 10 }, endpoint: server.url });

        assert.equal(result.code, 0, result.output);
        assert.equal(result.items.length, 10);
        assert.deepEqual(result.items[0], {
            ...company(1),
            source: 'tomba_company_search',
            charged: true,
            cached: false,
        });
        assert.deepEqual(server.requests[0].body, { query: 'tech', page: 1 });
        assert.deepEqual(result.chargeCounts, { 'tomba-request': 1 });
    });

    it('sends the built-in credentials to Tomba', async () => {
        const server = await mock();
        await run({ input: { query: 'tech', maxResults: 1 }, endpoint: server.url });
        assert.equal(server.requests[0].headers['x-tomba-key'], 'ta_test_key');
        assert.equal(server.requests[0].headers['x-tomba-secret'], 'ts_test_secret');
    });

    it('trims the query and drops empty filters and fields', async () => {
        const server = await mock();
        await run({
            input: { query: '  tech  ', filters: {}, source: [], maxResults: 1 },
            endpoint: server.url,
        });
        assert.deepEqual(server.requests[0].body, { query: 'tech', page: 1 });
    });

    it('passes filters, fields and the start page to Tomba', async () => {
        const server = await mock();
        const filters = { location_country: { include: ['US'] }, size: { exclude: ['1-10'] } };
        const result = await run({
            input: { filters, source: ['name', 'website_url'], page: 2, maxResults: 5 },
            endpoint: server.url,
        });
        assert.deepEqual(server.requests[0].body, { filters, _source: ['name', 'website_url'], page: 2 });
        assert.equal(result.items[0].name, 'Company 11');
    });

    it('pages until maxResults is reached, one request and one charge per page', async () => {
        const server = await mock();
        const result = await run({ input: { query: 'tech', maxResults: 15 }, endpoint: server.url });
        assert.deepEqual(pagesRequested(server), [1, 2]);
        assert.equal(result.items.length, 15);
        assert.equal(result.items[14].name, 'Company 15');
        assert.deepEqual(result.chargeCounts, { 'tomba-request': 2 });
    });

    it('stops paging at the last page reported by Tomba', async () => {
        const server = await mock();
        const result = await run({ input: { query: 'exact', maxResults: 1000 }, endpoint: server.url });
        // 20 companies, 2 full pages: meta.pages stops paging without requesting an empty page 3.
        assert.deepEqual(pagesRequested(server), [1, 2]);
        assert.equal(result.items.length, 20);
        assert.equal(totalCharges(result), 2);
    });

    it('stops paging at a short page', async () => {
        const server = await mock();
        const result = await run({ input: { query: 'nopages', maxResults: 1000 }, endpoint: server.url });
        assert.deepEqual(pagesRequested(server), [1, 2]);
        assert.equal(result.items.length, 15);
        assert.equal(totalCharges(result), 2);
    });

    it('keeps the companies it already paid for when a later page fails', async () => {
        const server = await mock(async (req) =>
            body(req).page === 2 ? { status: 422, body: { errors: { message: 'Bad page' } } } : tomba(req),
        );
        const result = await run({ input: { query: 'tech', maxResults: 100 }, endpoint: server.url });
        assert.equal(result.code, 0, result.output);
        assert.deepEqual(pagesRequested(server), [1, 2]);
        assert.equal(result.items.length, 10);
        assert.ok(result.items.every((i) => i.charged === true && i.error === undefined));
        assert.equal(totalCharges(result), 1);
    });

    it('charges a search with no matching companies as a negative answer', async () => {
        const server = await mock();
        const result = await run({ input: { query: 'none' }, endpoint: server.url });
        assert.equal(server.requests.length, 1);
        assert.deepEqual(result.items, [
            {
                query: 'none',
                page: 1,
                source: 'tomba_company_search',
                charged: true,
                cached: false,
                error: 'No companies found',
            },
        ]);
        assert.deepEqual(result.chargeCounts, { 'tomba-request': 1 });
    });

    it('does not charge empty data', async () => {
        const server = await mock();
        const result = await run({ input: { query: 'empty' }, endpoint: server.url });
        assert.equal(result.code, 0, result.output);
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].charged, false);
        assert.equal(result.items[0].error, 'No companies found');
        assert.equal(totalCharges(result), 0);
    });

    it('does not charge Tomba error statuses and does not retry them', async () => {
        const server = await mock();
        const result = await run({ input: { query: 'invalid' }, endpoint: server.url });
        assert.equal(result.code, 0, result.output);
        assert.equal(server.requests.length, 1);
        assert.equal(result.items[0].charged, false);
        assert.match(String(result.items[0].error), /422: Invalid query/);
        assert.equal(totalCharges(result), 0);
    });

    it('does not charge a non-JSON body', async () => {
        const server = await mock();
        const result = await run({ input: { query: 'html' }, endpoint: server.url });
        assert.equal(result.items[0].charged, false);
        assert.match(String(result.items[0].error), /Invalid response/);
        assert.equal(totalCharges(result), 0);
    });

    it('retries 429 and 5xx responses, then charges the success once', async () => {
        let calls = 0;
        const server = await mock(async (req) => {
            calls++;
            if (calls === 1)
                return {
                    status: 429,
                    body: { errors: { message: 'Too many requests' } },
                    headers: { 'retry-after': '1' },
                };
            if (calls === 2) return { status: 503, body: {} };
            return tomba(req);
        });
        const result = await run({ input: { query: 'tech', maxResults: 10, maxRetries: 3 }, endpoint: server.url });
        assert.equal(server.requests.length, 3);
        assert.equal(result.items.length, 10);
        assert.equal(result.items[0].charged, true);
        assert.deepEqual(result.chargeCounts, { 'tomba-request': 1 });
    });

    it('serves repeated runs from the cache for free', async () => {
        const server = await mock();
        const input = { query: 'tech', maxResults: 20 };
        const first = await run({ input, endpoint: server.url });
        assert.equal(totalCharges(first), 2);
        const second = await run({ input, endpoint: server.url, storageDir: first.storageDir });

        assert.equal(server.requests.length, 2);
        assert.equal(second.items.length, 20);
        assert.ok(second.items.every((i) => i.cached === true && i.charged === false));
        assert.equal(totalCharges(second), 0);
    });

    it('calls Tomba again when the cache is disabled', async () => {
        const server = await mock();
        const input = { query: 'tech', maxResults: 10, useCache: false };
        const first = await run({ input, endpoint: server.url });
        await run({ input, endpoint: server.url, storageDir: first.storageDir });
        assert.equal(server.requests.length, 2);
    });

    it('stops at the max charge limit and resumes without reprocessing', async () => {
        const server = await mock();
        const input = { query: 'big', maxResults: 100, maxConcurrency: 1, useCache: false };

        // Locally every event costs $1, so a $2 budget allows two billable pages.
        const first = await run({ input, endpoint: server.url, maxTotalChargeUsd: 2 });
        assert.equal(first.code, 0, first.output);
        assert.equal(totalCharges(first), 2);
        assert.deepEqual(pagesRequested(server), [1, 2]);
        assert.equal(first.items.length, 20);

        const second = await run({ input, endpoint: server.url, storageDir: first.storageDir, keepStorage: true });
        assert.equal(second.code, 0, second.output);
        assert.deepEqual(pagesRequested(server), [1, 2, 3, 4, 5, 6]);
        assert.equal(second.items.length, 60);
        assert.equal(new Set(second.items.map((i) => i.name)).size, 60);
        // The charging log is kept with the storage: 2 events from the first run + 4 new ones.
        assert.equal(totalCharges(second), 6);
    });

    it('keeps maxResults across a resumed run', async () => {
        const server = await mock();
        const input = { query: 'big', maxResults: 25, useCache: false };
        const first = await run({ input, endpoint: server.url, maxTotalChargeUsd: 2 });
        assert.equal(first.items.length, 20);
        const second = await run({ input, endpoint: server.url, storageDir: first.storageDir, keepStorage: true });
        assert.deepEqual(pagesRequested(server), [1, 2, 3]);
        assert.equal(second.items.length, 25);
    });

    it('fetches the pages of a search one after another', async () => {
        let active = 0;
        let peak = 0;
        const server = await mock(async (req) => {
            active++;
            peak = Math.max(peak, active);
            await new Promise((r) => {
                setTimeout(r, 50);
            });
            active--;
            return tomba(req);
        });
        await run({ input: { query: 'big', maxResults: 60, maxConcurrency: 10 }, endpoint: server.url });
        assert.equal(server.requests.length, 6);
        assert.equal(peak, 1);
    });

    it('fails without Tomba credentials and never calls the API', async () => {
        const server = await mock();
        const result = await run({ input: { query: 'tech' }, endpoint: server.url, withCredentials: false });
        assert.notEqual(result.code, 0);
        assert.match(result.output, /misconfigured/);
        assert.doesNotMatch(result.output, /ta_test_key|ts_test_secret/);
        assert.equal(server.requests.length, 0);
    });

    it('fails without a query or filters and never calls the API', async () => {
        const server = await mock();
        const result = await run({ input: { query: '   ', filters: {} }, endpoint: server.url });
        assert.notEqual(result.code, 0);
        assert.match(result.output, /query/);
        assert.equal(server.requests.length, 0);
    });
});

describe('company-search standby (real-time API)', () => {
    it('answers the readiness probe and a bare GET with usage info', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        try {
            const probe = await actor.call('/', { headers: { 'x-apify-container-server-readiness-probe': '1' } });
            assert.equal(probe.status, 200);
            const usage = await actor.call('/');
            assert.equal(usage.status, 200);
            assert.match(String(usage.body.usage), /GET/);
            assert.equal(server.requests.length, 0);
        } finally {
            await actor.stop();
        }
    });

    it('searches from GET query parameters and charges one event per page', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        let stopped;
        try {
            const filters = encodeURIComponent(JSON.stringify({ industry: { include: ['software'] } }));
            const res = await actor.call(`/?query=tech&filters=${filters}&source=name,website_url&maxResults=15`);
            assert.equal(res.status, 200);
            const items = res.body.items as Record<string, unknown>[];
            assert.equal(items.length, 15);
            assert.equal(items[14].name, 'Company 15');
            assert.deepEqual(server.requests[0].body, {
                query: 'tech',
                filters: { industry: { include: ['software'] } },
                _source: ['name', 'website_url'],
                page: 1,
            });
            assert.deepEqual(pagesRequested(server), [1, 2]);
        } finally {
            stopped = await actor.stop();
        }
        assert.deepEqual(stopped.chargeCounts, { 'tomba-request': 2 });
    });

    it('accepts a POST with the same JSON input as a normal run', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        try {
            const res = await actor.call('/', {
                body: { filters: { size: { include: ['51-200'] } }, page: 2, maxResults: 5 },
            });
            assert.equal(res.status, 200);
            const items = res.body.items as Record<string, unknown>[];
            assert.equal(items.length, 5);
            assert.equal(items[0].name, 'Company 11');
            assert.deepEqual(pagesRequested(server), [2]);
        } finally {
            await actor.stop();
        }
    });

    it('serves repeated requests from the cache for free', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        let stopped;
        try {
            await actor.call('/?query=tech&maxResults=10');
            const second = await actor.call('/?query=tech&maxResults=10');
            assert.ok((second.body.items as Record<string, unknown>[]).every((i) => i.cached === true));
            assert.equal(server.requests.length, 1);
        } finally {
            stopped = await actor.stop();
        }
        assert.deepEqual(stopped.chargeCounts, { 'tomba-request': 1 });
    });

    it('keeps serving after a request hits maxResults', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        try {
            const first = await actor.call('/?query=big&maxResults=5');
            assert.equal((first.body.items as unknown[]).length, 5);
            const second = await actor.call('/?query=big&maxResults=25');
            assert.equal((second.body.items as unknown[]).length, 25);
            assert.deepEqual(pagesRequested(server), [1, 2, 3]);
        } finally {
            await actor.stop();
        }
    });

    it('rejects invalid input with 400 and unknown paths with 404', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        try {
            assert.equal((await actor.call('/', { body: {} })).status, 400);
            assert.equal((await actor.call('/', { body: 'not json' })).status, 400);
            assert.equal((await actor.call('/?query=tech&maxResults=abc')).status, 400);
            const badFilters = await actor.call('/?filters=notjson');
            assert.equal(badFilters.status, 400);
            assert.match(String(badFilters.body.error), /filters/);
            assert.equal((await actor.call(`/?filters=${encodeURIComponent('[1]')}`)).status, 400);
            assert.equal((await actor.call('/?page=1')).status, 400);
            assert.equal((await actor.call('/nope')).status, 404);
            assert.equal((await actor.call('/', { method: 'DELETE' })).status, 405);
            assert.equal(server.requests.length, 0);
        } finally {
            await actor.stop();
        }
    });

    it('returns 402 once the max charge limit is reached', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url, maxTotalChargeUsd: 1 });
        try {
            const first = await actor.call('/?query=tech&maxResults=30');
            assert.equal(first.status, 200);
            assert.equal((first.body.items as unknown[]).length, 10);
            const second = await actor.call('/?query=other');
            assert.equal(second.status, 402);
            assert.equal(server.requests.length, 1);
        } finally {
            await actor.stop();
        }
    });
});

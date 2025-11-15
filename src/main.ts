// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/)
import { Actor } from 'apify';
import type { Company, CompanyFilters } from 'tomba';
import { Reveal, TombaClient } from 'tomba';

interface ActorInput {
    tombaApiKey: string;
    tombaApiSecret: string;
    query?: string;
    filters?: CompanyFilters;
    source?: string[];
    page?: number;
    maxResults?: number;
}

// Rate limiting configuration
const MAX_REQUESTS_PER_MINUTE = 50;
const MAX_REQUESTS_PER_SECOND = 5;
const MINUTE_IN_MS = 60000;
const SECOND_IN_MS = 1000;

let requestCount = 0;
let lastResetTime = Date.now();

async function rateLimitedRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceReset = now - lastResetTime;

    // Reset counter every minute
    if (timeSinceReset >= MINUTE_IN_MS) {
        requestCount = 0;
        lastResetTime = now;
    }

    // Wait if we've hit the per-minute limit
    if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
        const waitTime = MINUTE_IN_MS - timeSinceReset;
        console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
        await new Promise((resolve) => {
            setTimeout(resolve, waitTime);
        });
        requestCount = 0;
        lastResetTime = Date.now();
    }

    // Add delay between requests to respect per-second limit
    if (requestCount > 0 && requestCount % MAX_REQUESTS_PER_SECOND === 0) {
        await new Promise((resolve) => {
            setTimeout(resolve, SECOND_IN_MS);
        });
    }

    requestCount++;
    return await requestFn();
}

// The init() call configures the Actor for its environment. It's recommended to start every Actor with an init()
await Actor.init();

try {
    // Get input from the Actor
    const input = (await Actor.getInput()) as ActorInput;

    if (!input) {
        throw new Error('No input provided');
    }

    if (!input.tombaApiKey || !input.tombaApiSecret) {
        throw new Error('Tomba API key and secret are required');
    }

    console.log('Starting Tomba Company Search Actor...');
    console.log(`Query: ${input.query || 'No query specified'}`);
    console.log(`Filters: ${JSON.stringify(input.filters || {})}`);

    // Init Tomba
    const client = new TombaClient();
    const reveal = new Reveal(client);
    client.setKey(input.tombaApiKey).setSecret(input.tombaApiSecret);

    const results: Company[] = [];
    const maxResults = input.maxResults || 100;
    let currentPage = input.page || 1;
    let hasMorePages = true;

    while (hasMorePages && results.length < maxResults) {
        const pageToFetch = currentPage;

        try {
            console.log(`Fetching page ${pageToFetch}...`);

            const response = await rateLimitedRequest(async () => {
                return await reveal.companiesSearch({
                    query: input.query,
                    filters: input.filters,
                    _source: input.source,
                    page: pageToFetch,
                });
            });

            if (response && response.data && response.data.companies) {
                const { companies } = response.data;
                console.log(`Found ${companies.length} companies on page ${pageToFetch}`);

                // Add companies to results
                for (const company of companies) {
                    if (results.length >= maxResults) break;

                    results.push({
                        ...company,
                        source: 'tomba_company_search',
                    } as Company);
                }

                // Check if there are more pages
                if (response.meta) {
                    const totalPages = response.meta.pages || 1;
                    const total = response.meta.total || 0;

                    console.log(`Page ${pageToFetch} of ${totalPages} (Total companies: ${total})`);

                    hasMorePages = currentPage < totalPages && results.length < maxResults;
                    currentPage++;
                } else {
                    hasMorePages = false;
                }
            } else {
                console.log('No companies found in response');
                hasMorePages = false;
            }
        } catch (error) {
            console.error(`Error fetching page ${pageToFetch}:`, error);
            hasMorePages = false;
        }
    }

    // Save results to dataset
    if (results.length > 0) {
        await Actor.pushData(results);
    }

    // Log summary
    console.log('=== SUMMARY ===');
    console.log(`Total companies found: ${results.length}`);
    console.log(`Pages processed: ${currentPage - 1}`);
} catch (error) {
    console.error('Actor failed:', error);
    throw error;
}

// Gracefully exit the Actor process. It's recommended to quit all Actors with an exit()
await Actor.exit();

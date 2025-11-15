# Tomba Company Search Actor

Find relevant companies aligned with your ideal customer profile using Tomba's powerful company search API. This Actor lets you search and filter companies by location, industry, size, revenue, technologies used, and many other criteria.

## Features

- **Natural Language Search**: Use simple queries like "technology companies in san francisco"
- **Advanced Filtering**: Filter by location, industry, company size, revenue, and more
- **Rich Company Data**: Get comprehensive information including contact details, social profiles, and firmographics
- **Pagination Support**: Automatically fetch multiple pages of results
- **Rate Limiting**: Built-in rate limiting to respect API limits (50 req/min)
- **Scalable**: Process up to 100000 companies per run

## Input Parameters

### Required Fields

- **Tomba API Key** (`tombaApiKey`): Your Tomba API key from https://app.tomba.io/api
- **Tomba API Secret** (`tombaApiSecret`): Your Tomba API secret from https://app.tomba.io/api

### Optional Fields

- **Search Query** (`query`): Natural language query to search for companies
    - Example: `"technology companies in san francisco"`

- **Company Filters** (`filters`): Advanced filters to refine your search
    - `location_city`: Filter by city (include/exclude)
    - `location_country`: Filter by country using 2-letter ISO country codes (e.g., "US", "GB", "FR") (include/exclude)
    - `location_state`: Filter by state/region (include/exclude)
    - `industry`: Filter by industry sector (include/exclude)
    - `size`: Filter by employee count range (include/exclude)
        - Options: `"1-10"`, `"11-50"`, `"51-200"`, `"201-500"`, `"501-1000"`, `"1000+"`
    - `type`: Filter by company type (include/exclude)
    - `keywords`: Filter by keywords (include/exclude)
    - `founded`: Filter by founding year (include/exclude)
    - `technologies`: Filter by technologies used (include/exclude)
    - `similar`: Filter by similar companies (include/exclude)
    - `revenue`: Filter by revenue range (include/exclude)
    - `sic`: Filter by SIC code (include/exclude)
    - `naics`: Filter by NAICS code (include/exclude)

- **Source Fields** (`source`): Specify which fields to include in the response
    - Example: `["name", "website_url", "industry", "city", "country"]`
    - Leave empty for all fields

- **Starting Page** (`page`): Page number to start from (default: 1)

- **Maximum Results** (`maxResults`): Maximum number of companies to return (default: 100, max: 100000)

## Output

The Actor returns an array of company objects with the following structure:

```json
{
    "name": "Example Technology Inc.",
    "description": "Leading provider of innovative software solutions",
    "country": "United States",
    "state": "California",
    "city": "San Francisco",
    "street_address": "123 Market Street",
    "postal_code": "94103",
    "industry": "Software & Technology",
    "company_size": "51-200",
    "type": "Private",
    "founded": "2015",
    "website_url": "https://example.com",
    "total_emails": 150,
    "revenue": "$10M-$50M",
    "phone_number": "+1-415-555-0100",
    "linkedin_url": "https://www.linkedin.com/company/example",
    "facebook_url": "https://www.facebook.com/example",
    "twitter_url": "https://twitter.com/example",
    "total_similar": 25,
    "source": "tomba_company_search"
}
```

## Usage Examples

### Example 1: Basic Search

```json
{
    "tombaApiKey": "ta_xxxx",
    "tombaApiSecret": "ts_xxxx",
    "query": "technology companies in san francisco",
    "maxResults": 50
}
```

### Example 2: Advanced Filtering

```json
{
    "tombaApiKey": "ta_xxxx",
    "tombaApiSecret": "ts_xxxx",
    "query": "software companies",
    "filters": {
        "location_city": {
            "include": ["san francisco", "new york", "austin"]
        },
        "industry": {
            "include": ["technology", "software"]
        },
        "size": {
            "include": ["51-200", "201-500"]
        },
        "revenue": {
            "include": ["$10M-$50M", "$50M-$100M"]
        }
    },
    "maxResults": 100
}
```

### Example 3: Technology-Based Search

```json
{
    "tombaApiKey": "ta_xxxx",
    "tombaApiSecret": "ts_xxxx",
    "filters": {
        "technologies": {
            "include": ["react", "aws", "kubernetes"]
        },
        "location_country": {
            "include": ["US"]
        },
        "size": {
            "include": ["201-500", "501-1000"]
        }
    },
    "maxResults": 100
}
```

### Example 4: Exclude Specific Criteria

```json
{
    "tombaApiKey": "ta_xxxx",
    "tombaApiSecret": "ts_xxxx",
    "query": "e-commerce companies",
    "filters": {
        "location_country": {
            "include": ["US", "CA"]
        },
        "industry": {
            "exclude": ["consulting", "staffing"]
        },
        "size": {
            "exclude": ["1-10", "11-50"]
        }
    },
    "maxResults": 75
}
```

## Use Cases

### Sales & Lead Generation

- Build targeted prospect lists based on ideal customer profiles
- Find companies using specific technologies for product positioning
- Identify companies in specific locations for territory planning

### Market Research

- Analyze industry trends and company distributions
- Study competitor landscapes in specific markets
- Track company growth patterns by size and revenue

### Recruitment

- Find companies in specific industries for talent sourcing
- Identify growing companies (by size/revenue) for hiring opportunities
- Target companies using specific technologies for technical recruitment

### Investment Research

- Discover emerging companies in specific sectors
- Analyze market concentration by geography and industry
- Identify companies with specific growth indicators

## API Information

This Actor uses the [Tomba Company Search API](https://tomba.io/). To use this Actor, you need:

1. A Tomba account (sign up at https://tomba.io)
2. API credentials from https://app.tomba.io/api
3. Sufficient API credits for company searches

### Rate Limits

The Actor implements rate limiting to comply with Tomba API limits:

- Maximum 50 requests per minute

## Resources

- [Tomba API Documentation](https://docs.tomba.io/)
- [Tomba Company Search API](https://docs.tomba.io/api/reveal#search-companies)
- [Tomba Node SDK](https://github.com/tomba-io/node)
- [Get Tomba API Credentials](https://app.tomba.io/api)

## FAQ

### General Questions

**Q: What is the Tomba Company Search Actor?**
A: The Tomba Company Search Actor is an Apify automation tool that helps you find relevant companies aligned with your ideal customer profile using Tomba's advanced company search API with powerful filtering options.

**Q: Do I need a Tomba account to use this Actor?**
A: Yes, you need a Tomba account and valid API credentials (API key and secret). Sign up at https://tomba.io and get your credentials from https://app.tomba.io/api.

**Q: How much does it cost to use this Actor?**
A: The Actor itself runs on Apify's platform, which has its own pricing. Additionally, you'll need Tomba API credits based on your usage. Check Tomba's pricing at https://tomba.io/pricing for company search costs.

**Q: What are the rate limits?**
A: The Actor implements rate limiting of 50 requests per minute to comply with Tomba's API limits.

### Technical Questions

**Q: How do I search for companies?**
A: You can use either a natural language query (e.g., "technology companies in san francisco") or apply advanced filters for specific criteria like location, industry, company size, revenue, and technologies used.

**Q: What filters are available?**
A: Available filters include: company name, location (country/city/state), industry, company size, type, keywords, founded year, technologies, similar companies, revenue, SIC codes, and NAICS codes. Each filter supports both include and exclude options.

**Q: How do I filter by company size?**
A: Use the `size` filter with options: "1-10", "11-50", "51-200", "201-500", "501-1000", or "1000+". You can include multiple ranges or exclude specific ones.

**Q: Can I search for companies using specific technologies?**
A: Yes! Use the `technologies` filter to find companies using specific tech stacks (e.g., "react", "aws", "kubernetes", "salesforce").

**Q: How does pagination work?**
A: The Actor automatically handles pagination. Set `maxResults` to control how many companies to fetch, and optionally set `page` to start from a specific page number.

**Q: What fields are returned for each company?**
A: Companies include: name, description, location details (country/state/city/address), industry, company size, type, founded year, website URL, total emails, revenue, phone number, social media URLs (LinkedIn/Facebook/Twitter), and number of similar companies.

**Q: Can I customize which fields are returned?**
A: Yes, use the `source` parameter to specify which fields to include in the response. Leave it empty to get all available fields.

**Q: What does the `total_emails` field represent?**
A: This shows the number of email addresses Tomba has found for that company in its database, which can be useful for gauging the company's email presence.

### Search Strategy Questions

**Q: How do I find companies in multiple cities?**
A: Use the `location_city` filter with an include array: `{"include": ["san francisco", "new york", "austin"]}`.

**Q: Can I exclude certain industries?**
A: Yes, use the exclude option in any filter: `{"industry": {"exclude": ["consulting", "staffing"]}}`.

**Q: How do I find recently founded companies?**
A: Use the `founded` filter to include specific years: `{"founded": {"include": ["2020", "2021", "2022", "2023"]}}`.

**Q: Can I search for similar companies to a specific domain?**
A: Yes, use the `similar` filter with a company domain: `{"similar": {"include": ["stripe.com"]}}`.

**Q: What's the difference between SIC and NAICS codes?**
A: SIC (Standard Industrial Classification) and NAICS (North American Industry Classification System) are industry classification systems. NAICS is more modern and detailed, while SIC is older but still widely used.

### Business Use Cases

**Q: How can I use this for sales prospecting?**
A: Filter companies by your ideal customer profile (industry, size, location, technologies) to build targeted prospect lists. The results include contact information like phone numbers and social media profiles.

**Q: Can I use this for competitor research?**
A: Yes, search for companies in your industry and location, or use the `similar` filter to find companies similar to specific competitors.

**Q: Is this useful for recruitment?**
A: Absolutely! Filter by industry and technologies to find companies where your ideal candidates might work, then use the company information for targeted outreach.

**Q: How can investors use this Actor?**
A: Investors can discover emerging companies in specific sectors, analyze market concentration, identify companies with growth indicators (size, revenue, founding date), and research industry trends.

**Q: Can I track companies in my territory?**
A: Yes, use location filters (country, state, city) to find all relevant companies in your sales territory and keep your CRM updated.

**Q: How do I find companies by revenue range?**
A: Use the `revenue` filter with ranges like "$10M-$50M", "$50M-$100M", etc. You can include multiple ranges or exclude specific ones.

## Keywords

company search, business intelligence, lead generation, market research, sales prospecting, recruitment, investment research, Tomba API, Apify Actor, data enrichment, company filtering, technology stack, firmographics, business data

## Support

If you need any help, have questions, or encounter any issues while using Tomba.io, please don't hesitate to reach out to our support team. You can contact us via:

- **Email**: support@tomba.io
- **Live chat**: Available on the Tomba.io website during business hours

## Contributing

We welcome contributions to improve this actor. Please feel free to submit issues, feature requests, or pull requests to help make this tool even better for the community.

## About Tomba

Founded in 2020, Tomba prides itself on being the most reliable, accurate, and in-depth source of email address data available anywhere. We process terabytes of data to produce our Email finder API.

![Tomba Logo](https://tomba.io/logo.png)

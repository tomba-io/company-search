# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

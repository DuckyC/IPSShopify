# IPS → Shopify Inventory Sync

A CLI tool that synchronises stock levels from an **IPS (Ideal POS)** SQL Server database into **Shopify** via the Shopify Admin GraphQL API.

## What it does

On each run the tool:

1. Reads current stock levels from the IPS `IPSTransaction` SQL Server database
2. Fetches all inventory items from Shopify for a given location
3. Skips items with no SKU or that are archived
4. Skips IPS items with negative stock (logs a warning instead)
5. Updates Shopify inventory quantities where IPS and Shopify differ
6. Marks any untracked Shopify inventory items as tracked

Optionally, it can export a CSV of IPS items that have no matching Shopify listing (see `--create-csv` below).

## Requirements

- [Bun](https://bun.sh) v1.x
- Network access to an IPS SQL Server instance (default instance name: `IDEALSQL`, database: `IPSTransaction`)
- A Shopify store with a private app access token that has `read_inventory` and `write_inventory` permissions

## Installation

```bash
bun install
```

## Configuration

On first run a `config.json` file is created from `config.default.json`. Edit it before running again:

```json
{
  "log_level": "info",
  "shopify": {
    "shop_url": "your-store.myshopify.com",
    "access_token": "shpat_...",
    "location_id": "gid://shopify/Location/123456789"
  },
  "ips": {
    "database": {
      "server": "localhost",
      "options": {
        "instanceName": "IDEALSQL",
        "database": "IPSTransaction",
        "trustServerCertificate": true,
        "encrypt": false
      },
      "authentication": {
        "type": "default",
        "options": {
          "userName": "your-sql-user",
          "password": "your-sql-password"
        }
      }
    }
  },
  "create_csv_with_pos_items_not_in_shopify_file_location": null
}
```

`config.json` is gitignored — never commit it as it contains credentials.

| Field | Description |
|---|---|
| `log_level` | `debug`, `info`, `warn`, or `error` |
| `shopify.shop_url` | Your `.myshopify.com` domain (no `https://`) |
| `shopify.access_token` | Shopify Admin API access token |
| `shopify.location_id` | Shopify location GID to sync inventory against |
| `ips.database` | [tedious](https://tediousjs.github.io/tedious/) `ConnectionConfiguration` object |
| `create_csv_with_pos_items_not_in_shopify_file_location` | Directory path for CSV output (only needed with `--create-csv`) |

## Usage

**Sync inventory:**

```bash
bun run index.ts
```

**Export a CSV of IPS items missing from Shopify:**

```bash
bun run index.ts --create-csv
```

The CSV is written to the directory set in `create_csv_with_pos_items_not_in_shopify_file_location` with a timestamped filename, e.g. `pos_items_not_in_shopify_2024-01-15T10-30-00-000Z.csv`.

## Project structure

| File | Purpose |
|---|---|
| `index.ts` | Entry point — orchestrates the sync |
| `ips-db.ts` | Reads stock levels from IPS SQL Server |
| `shopify.ts` | Shopify GraphQL client wrapper |
| `config.ts` | Loads and merges `config.json` over defaults |
| `config.default.json` | Default/template configuration |
| `logging.ts` | Logger setup |

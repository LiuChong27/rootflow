# Download Center Setup

This document covers the extra setup required for RootFlow's paid PDF download center.

## 1. Upload the new cloud functions

Upload these functions under `uniCloud-aliyun/cloudfunctions/`:

- `getDownloadCatalog`
- `createPurchaseOrder`
- `createDownloadTickets`
- `confirmDownloadSuccess`
- `listDownloadOrders`

They depend on the shared helpers under `common/rootflow-shared`.

## 2. Initialize the new database collections

After uploading the latest `uniCloud-aliyun/database` directory in HBuilderX, confirm these new collections exist:

- `rf_download_assets`
- `rf_download_entitlements`
- `rf_download_orders`
- `rf_download_tickets`

## 3. Prepare the A-Z asset manifest

If your PDFs are stored locally as `A.pdf ... Z.pdf`, generate a starter manifest with:

```bash
node scripts/build-download-assets-manifest.mjs --inputDir <pdf-folder> --version 2026.04 --output logs/download-assets-manifest.json
```

Then fill in the real `fileId` values after uploading the PDFs to your shared `uniCloud` storage space.

If one letter is split into multiple PDFs, keep one row per actual file and give each row a unique `assetKey`, for example:

- `pdf-b`
- `pdf-b-other`
- `pdf-b-wood`

If one PDF covers multiple letters, set `coveredLetters`, for example:

```json
{
  "assetKey": "pdf-u-w",
  "letter": "u",
  "coveredLetters": ["u", "w"],
  "title": "U&W.pdf"
}
```

## 4. Upload PDFs to cloud storage

Recommended storage layout:

- `rootflow/pdfs/v1/A.pdf`
- `rootflow/pdfs/v1/B.pdf`
- ...
- `rootflow/pdfs/v1/Z.pdf`

For each uploaded PDF, persist the corresponding `fileId` into `rf_download_assets`.
This repo now includes:

- `logs/download-assets-manifest.json`
- `logs/rf_download_assets.import.json`
- `logs/rf_download_assets.import.jsonl`
- `logs/rf_download_assets.import.lines.json`

Both files contain the latest filled `fileId` mappings for your current upload batch.

When importing into the `rf_download_assets` collection from HBuilderX or the uniCloud console, use the `jsonl` file instead of the JSON array file:

- import with `logs/rf_download_assets.import.jsonl`
- keep `logs/rf_download_assets.import.json` only as a readable/editable source file

The importer expects line-delimited JSON, which means one JSON object per line. Importing the array file may fail with a generic `INTERNAL_ERROR`.

If your HBuilderX version only allows selecting `.json` or `.csv` files, use:

- `logs/rf_download_assets.import.lines.json`

This file has a `.json` extension for the file picker, but its content is still line-delimited JSON for uniCloud import.

## 5. Payment adapter mode

`uniCloud-aliyun/cloudfunctions/common/rootflow-config/index.js` now exposes:

- `downloads.paymentMode`
- `downloads.iosPurchaseEnabled`
- `downloads.ticketExpireSeconds`
- `downloads.purchaseUnavailableReason`

Current implementation notes:

- `paymentMode: "disabled"` keeps purchase buttons visible but unavailable.
- `paymentMode: "dev-auto-fulfill"` grants the selected entitlement immediately for internal testing.

The business order, entitlement, and download-ticket plumbing is in place, but a real paid flow still requires your shared `uniCloud` space to provide the actual payment adapter and callback handling you want to use in production.

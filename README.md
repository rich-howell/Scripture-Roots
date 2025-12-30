<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run the app locally

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Update local data files if needed:
   `public/data/people.json`, `public/data/children.json`, `public/data/aliases.json`, `public/data/details/*.json`, `public/data/root.json`
3. Run the app:
   `npm run dev`

## Data Sources

People and relationship data is derived from theographic-bible-metadata (CC BY-SA 4.0):
- https://github.com/robertrouse/theographic-bible-metadata

The data includes Easton's Bible Dictionary entries and KJV verse references from that dataset.
NIV text is not included.

To regenerate the local JSON files, run:
`python scripts/build-theographic-data.py`

# Google Sheets Integration Setup Guide

This guide explains how to set up Google Sheets as your product database.

## 📋 Step 1: Create Your Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it (e.g., "Mr. Vegetable & Fruits Products")

## 📊 Step 2: Set Up Column Headers

In **Row 1**, add these exact column headers:

| id | name | category | image | price_250g | price_500g | price_1kg | price_2kg |
|---|---|---|---|---|---|---|---|
| tomato | Tomato | Vegetable | images/tomato.jpg | 10 | 20 | 40 | 80 |

### Column Descriptions:

- **id**: Unique identifier (lowercase, no spaces, e.g., "tomato", "red-apple")
- **name**: Product display name (e.g., "Tomato", "Red Apple")
- **category**: Either "Vegetable" or "Fruit"
- **image**: Image path (e.g., "images/tomato.jpg")
- **price_250g**: Price in INR for 250g
- **price_500g**: Price in INR for 500g
- **price_1kg**: Price in INR for 1kg
- **price_2kg**: Price in INR for 2kg

## 🔓 Step 3: Make Sheet Public

1. Click **Share** button (top right)
2. Click **Change to anyone with the link**
3. Set permission to **Viewer**
4. Click **Done**

⚠️ **Important**: The sheet must be publicly viewable for the website to access it.

## 🔑 Step 4: Get Your Sheet ID

1. Look at your Google Sheets URL:
   ```
   https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit
   ```
2. Copy the part between `/d/` and `/edit` - that's your Sheet ID

Example:
- URL: `https://docs.google.com/spreadsheets/d/1ABC123xyz456/edit`
- Sheet ID: `1ABC123xyz456`

## ⚙️ Step 5: Configure the Website

1. Open `google-sheets-loader.js` in a text editor
2. Find this line:
   ```javascript
   sheetId: '<YOUR_SHEET_ID>',
   ```
3. Replace `<YOUR_SHEET_ID>` with your actual Sheet ID
4. Find this line:
   ```javascript
   sheetName: 'Sheet1',
   ```
5. Replace `'Sheet1'` with your sheet name if different (check the tab name at the bottom)

## ✅ Step 6: Test

1. Open your website in a browser
2. Go to the Products page
3. Check browser console (F12) for messages:
   - ✅ "Products loaded from Google Sheets" = Success!
   - ℹ️ "Using hardcoded products..." = Google Sheets not configured or unavailable

## 📝 Example Sheet Data

Here's a sample row to help you format your data:

```
tomato | Tomato | Vegetable | images/tomato.jpg | 10 | 20 | 40 | 80
```

## 🆘 Troubleshooting

### Products not loading from Google Sheets?

1. **Check Sheet ID**: Make sure it's correct in `google-sheets-loader.js`
2. **Check Sheet Name**: Make sure it matches the tab name (case-sensitive)
3. **Check Public Access**: Sheet must be "Anyone with the link" → Viewer
4. **Check Column Headers**: Must be exactly: id, name, category, image, price_250g, price_500g, price_1kg, price_2kg
5. **Check Browser Console**: Open Developer Tools (F12) and look for error messages

### Fallback to Hardcoded Products

If Google Sheets fails, the website automatically uses products from `products.js`. This ensures your site always works!

## 🔄 Adding New Products

Simply add a new row in your Google Sheet with all required columns. The website will automatically show the new product after refreshing the page.

## 📱 Updating Prices

Edit the price columns in your Google Sheet. Changes appear on the website immediately (users may need to refresh).

---

**Note**: The website will work with hardcoded products from `products.js` if Google Sheets is not configured. This ensures your site is always functional.


# Shree Pasupatinath Hardware - Credit Khata & Daily Sales

A simple, fast, 100% offline local web application for your hardware shop running at **`http://localhost:3001`**.

---

## Main Features

### Price List
- Open **PRICE LIST** from the top navigation to browse all 301 products, grouped into 31 categories.
- Search by product name, number, price, or category; choose a category chip to filter the list.
- Add, edit, or delete products and prices. The price list contains no credit-entry action buttons.

### Credit Customers (Khata)
- **Strictly NO Rate & NO Total**: Clean ledger tracking only items taken on credit.
- **Fields**: Date (BS), Item Name, Unit (`bag`, `pic`, `kg`, `length`, etc.), Quantity, Driver Name, Vehicle Number, Remarks.
- **Features**: Excel-style spreadsheet sheet per customer, quick search, **PDF** and native **Excel (.xlsx)** export, and **Print**. PDF and print layouts repeat clear headings and fit long notes across readable pages.
- **Search Sales & Credit**: Use the top navigation search button to search Sales + Credit together, or select Sales only or Credit only. Filter results to all dates, today, or a BS date range. Search by product, buyer/customer, date, quantity, unit, price, or remarks; credit entries also include driver and vehicle details. Search results show matched quantities grouped by unit; sales additionally show total sales value. Credit results link back to the customer's khata, and product searches allow small spelling differences.
- **Search within Credit Khata**: The customer directory includes a separate all-credit search for customer name, item, date, quantity, unit, driver, vehicle, and remarks. It opens matching entries in the credit-only search results.
- **Organized Credit Khata directory**: Customer-name search and all-entry khata search are separated into labeled panels, with sorting/report controls in their own toolbar and customer creation in its own section. The layout stacks cleanly on smaller screens.
- **Customer directory sorting**: The directory shows each khata's last-modified date in Nepali (BS), while sorting by the actual modification timestamp. Sort customers by last modification or by the number of credit items; click the active option again to reverse its order.
- **Data storage**: The customer directory is stored in `data/customers.json`. Each person's credit entries are stored separately in `data/records/<customer name>.json`; edit and delete only update that person's record file.
- **Items Catalog**: Search and add catalog items directly to the credit entry sheet. Type a new unit in the Unit field to save it for later use in this browser.
- **Date Range Export**: Filter credit records and export the selected date range.

### Daily Sales & Chart (Separated Feature)
- **Product Sales with Pricing**: Record daily sales with Buyer / Customer, Product Name, editable Unit, Quantity, Rate (Rs.), and auto-computed Total (`Quantity × Rate`). The Buyer / Customer field suggests the next `CUSTOMER N` number based on existing daily sales and remains editable. Units default from the most-used unit in your existing credit and sales records, with item-name detection as a fallback.
- **Daily Sales Summary**: The dashboard's Today's Sales card totals records for the current Nepali (BS) date only. Product charts and ranking summaries are labeled as all-time.
- **Product Sales Charts ("Which product is selling")**:
  - **Bar Chart**: Visual ranking of top products with toggle between Quantity sold and Revenue (Rs.).
  - **Product Share Chart**: Donut chart showing percentage share of products.
  - **Ranking Table**: Visual progress bars, units sold, total revenue, and transaction count. Sales and credit product analytics group by both product name and unit, so (for example) BALWA by BAG and BALWA by TIP appear separately instead of combining incompatible quantities.
  - **Daily Sales Ledger**: View sales grouped by date or as one flat list; sort by latest modification or quantity in either direction; filter to today or a date range; and export **PDF** or **Excel (.xlsx)**. PDF exports can be grouped by date with daily subtotals or shown as one list; Excel keeps both views in the workbook.
  - **Sales Invoices**: Open the invoice list from the daily sales ledger. Items entered together for the same customer and date are combined into one print-ready invoice headed **HARDWARE PASAL**, with each item's unit, quantity, and rate plus a combined total. Invoices are grouped by date and searchable by customer, item, amount, and other invoice details; matching text is highlighted, with optional BS date-range filters.

---

## ⌨️ Fast Keyboard Shortcuts & Rapid POS Entry

- **Global Navigation**:
  - `F1` or `Alt + 1`: Switch to **Credit Customers (Khata)**
  - `F2` or `Alt + 2`: Switch to **Daily Sales & Chart**
  - `/`: Focus search input (Search customers or daily sales)
  - `Ctrl + S`: Quick-save active form
  - `Esc`: Close modals, autocomplete dropdowns, forms, or return to customer directory

- **Daily Sales Rapid Workflow**:
  1. Type **Product Name** &rarr; press **Enter**.
  2. Select **Unit** &rarr; press **Enter**.
  3. Type **Quantity** &rarr; press **Enter**.
  4. Type **Rate** &rarr; press **Enter** &rarr; product is added to the sale! The form clears and focus jumps back to **Product Name** ready for the next product!
  5. When you have no more products to add, press **Enter** on the empty **Product Name** box &rarr; focus moves to the optional payment/delivery note.
  6. Add a note if needed, then press **Enter** &rarr; all staged products are saved, a success chime plays, and the screen resets ready for the next customer!
- **Arrow Keys**: Navigate credit entry cells and rows, and move between daily sales fields. Up/Down continue to navigate autocomplete suggestions when they are open.
- **Credit Khata Entry**: Press `Enter` through the date, driver, vehicle, and item fields. Use the arrow keys to move between item columns and rows; pressing `Enter` on an empty item name focuses Save.
- **Numeric Keypad**: Numpad digits and decimal input work in quantity and rate fields even when Num Lock is off, without changing your keyboard's Num Lock setting. Numpad arrow keys continue to navigate in non-numeric fields.
- Clicking **Credit Customers (Khata)** opens the customer directory and focuses its search. After searching and selecting a customer, that customer's ledger opens with Driver Name focused.
- **Item Units**: Credit and sale units default to the most-used unit for that exact item in your existing records (with item-name detection as a fallback). Both fields are editable; custom units you enter are saved for future suggestions.

- **Audio Feedback**:
  - Automatically plays a crisp success chime on save (100% offline using browser Web Audio API).

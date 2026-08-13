const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const XLSX = require('xlsx');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const db = new sqlite3.Database('./shop.db', (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to SQLite database.');
});

db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_title TEXT,
    qty INTEGER,
    total_price REAL,
    cost_price REAL,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

const workbook = XLSX.readFile('items-inventory.xlsx');
const sheetName = workbook.SheetNames[0];
const itemsData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

app.get('/', (req, res) => {
    const search = req.query.search ? req.query.search.toLowerCase() : '';
    let collections = [...new Set(itemsData.map(item => item.CollectionName))];
    
    if (search) {
        const matchedItems = itemsData.filter(item => 
            (item.TitleKhmer && item.TitleKhmer.toLowerCase().includes(search)) ||
            (item.TitleEnglish && item.TitleEnglish.toLowerCase().includes(search))
        );
        return res.render('search-results', { search, matchedItems });
    }

    res.render('index', { collections });
});

app.get('/collection/:name', (req, res) => {
    const collectionName = req.params.name;
    const filteredItems = itemsData.filter(item => item.CollectionName === collectionName);
    res.render('products', { collectionName, items: filteredItems });
});

app.post('/checkout', (req, res) => {
    const cartItems = JSON.parse(req.body.cartData || '[]');
    if (cartItems.length === 0) return res.redirect('/');

    const stmt = db.prepare(`INSERT INTO orders (item_title, qty, total_price, cost_price) VALUES (?, ?, ?, ?)`);
    
    cartItems.forEach(item => {
        const totalPrice = item.salePrice * item.qty;
        const totalCost = item.unitCost * item.qty;
        stmt.run(item.title, item.qty, totalPrice, totalCost);
    });
    
    stmt.finalize((err) => {
        if (err) console.error(err);
        res.render('success');
    });
});

app.get('/admin/dashboard', (req, res) => {
    db.all(`SELECT * FROM orders ORDER BY order_date DESC`, [], (err, orders) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Database error");
        }

        let totalRevenue = orders.reduce((sum, order) => sum + order.total_price, 0);
        let totalCost = orders.reduce((sum, order) => sum + order.cost_price, 0);
        let netProfit = totalRevenue - totalCost;

        res.render('dashboard', { orders, totalRevenue, totalCost, netProfit });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});

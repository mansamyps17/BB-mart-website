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

// ១. ទំព័រដើម បង្ហាញបញ្ជី Collection Names ទាំងអស់
app.get('/', (req, res) => {
    // ទាញយកឈ្មោះ Collection មិនឱ្យជាន់គ្នា
    const collections = [...new Set(itemsData.map(item => item.CollectionName))];
    res.render('index', { collections });
});

// ២. ទំព័របង្ហាញទំនិញតាម Collection នីមួយៗ
app.get('/collection/:name', (req, res) => {
    const collectionName = req.params.name;
    // ត្រងយកតែទំនិញណាដែលស្ថិតក្នុង Collection នោះ
    const filteredItems = itemsData.filter(item => item.CollectionName === collectionName);
    res.render('products', { collectionName, items: filteredItems });
});

// ទទួលការបញ្ជាទិញ
app.post('/buy', (req, res) => {
    const { title, salePrice, unitCost, qty } = req.body;
    const totalPrice = salePrice * qty;
    const totalCost = unitCost * qty;

    db.run(`INSERT INTO orders (item_title, qty, total_price, cost_price) VALUES (?, ?, ?, ?)`,
        [title, qty, totalPrice, totalCost], (err) => {
            if (err) {
                console.error(err);
                return res.send("เกิดข้อผิดพลาดในการสั่งซื้อ");
            }
            res.redirect('/success');
        });
});

app.get('/success', (req, res) => {
    res.send(`<h2 style="font-family:sans-serif; text-align:center; margin-top:50px;">🎉 ការបញ្ជាទិញរបស់អ្នកបានជោគជ័យ! <a href="/">ត្រឡប់ក្រោយទៅទំព័រដើម</a></h2>`);
});

// ៣. ទំព័រ Dashboard
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
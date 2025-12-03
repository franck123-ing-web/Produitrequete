const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 8000;

app.use(cors());

const db = new sqlite3.Database('./database.db', (err) => {
  if (err) console.error(err.message);
  else console.log('Connected to SQLite database.');
});

db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.run(`CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  image TEXT,
  category TEXT,
  rating_rate REAL,
  rating_count INTEGER
)`);

async function insertRandomUsers() {
  try {
    const urls = [1, 2, 3, 4, 5].map(() => axios.get('https://randomuser.me/api/'));
    const results = await Promise.all(urls);
    const users = results.map(r => r.data.results[0]);

    users.forEach(u => {
      const username = u.login.username;
      const password = u.login.password;
      const email = u.email;

      db.run(
        `INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, 0)`,
        [username, email, password],
        (err) => { if (err) console.error(err.message); }
      );
    });

    console.log('Inserted 5 random users into database.');
  } catch (err) {
    console.error('Error inserting users:', err.message);
  }
}

async function insertProductsFromAPI() {
  try {
    const response = await axios.get('https://fakestoreapi.com/products');
    const products = response.data;

    products.forEach(p => {
      const title = p.title.replace(/'/g, "''");
      const description = p.description.replace(/'/g, "''");
      const category = p.category.replace(/'/g, "''");

      db.run(
        `INSERT INTO products (title, description, price, image, category, rating_rate, rating_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, description, p.price, p.image, category, p.rating.rate, p.rating.count],
        (err) => { if (err) console.error('Error inserting product:', err.message); }
      );
    });

    console.log(`Inserted ${products.length} products into database.`);
  } catch (err) {
    console.error('Error fetching products:', err.message);
  }
}

app.get('/generate-users', async (req, res) => {
  await insertRandomUsers();
  res.json({ success: true, message: 'Generated 5 random users' });
});

app.get('/generate-products', async (req, res) => {
  await insertProductsFromAPI();
  res.json({ success: true, message: 'Products generated' });
});

app.get('/products/search', (req, res) => {
  const searchTerm = req.query.q || '';
  const searchPattern = `%${searchTerm}%`;

  const query = `
    SELECT id, title, description, price, image, category, rating_rate, rating_count
    FROM products
    WHERE title LIKE ? OR description LIKE ? OR category LIKE ?`;

  db.all(query, [searchPattern, searchPattern, searchPattern], (err, rows) => {
    if (err) {
      console.error('SQL Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/products', (req, res) => {
  db.all('SELECT id, title, description, price, image, category, rating_rate, rating_count FROM products', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/products/:id', (req, res) => {
  const productId = req.params.id;

  const query = `
    SELECT id, title, description, price, image, category, rating_rate, rating_count 
    FROM products 
    WHERE id = ?`;

  db.get(query, [productId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || {});
  });
});

app.get('/', (req, res) => {
  res.send('Hello Ipssi v2!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

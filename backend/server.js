const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error("[DB] Connection error:", err.message);
  } else {
    console.log('[DB] Connected to SQLite');
  }
});

db.serialize(() => {
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
});

async function insertRandomUsers() {
  try {
    const requests = Array(5).fill(null).map(() => axios.get('https://randomuser.me/api/'));
    const results = await Promise.all(requests);

    const users = results.map(r => r.data.results[0]);

    return Promise.all(
      users.map(u =>
        new Promise((resolve, reject) => {
          const query = `
            INSERT INTO users (username, email, password, is_admin)
            VALUES (?, ?, ?, 0)
          `;

          db.run(query, [u.login.username, u.email, u.login.password], (err) => {
            if (err) {
              if (err.message.includes("UNIQUE constraint failed")) {
                console.log("[DB] Duplicate user skipped");
                return resolve();
              }
              return reject(err);
            }
            resolve();
          });
        })
      )
    );
  } catch (err) {
    console.error("[USERS] Error:", err.message);
    throw err;
  }
}

async function insertProductsFromAPI() {
  try {
    const { data } = await axios.get('https://fakestoreapi.com/products');

    return Promise.all(
      data.map(p =>
        new Promise((resolve, reject) => {
          const query = `
            INSERT INTO products (title, description, price, image, category, rating_rate, rating_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;

          db.run(query, [
            p.title,
            p.description,
            p.price,
            p.image,
            p.category,
            p.rating.rate,
            p.rating.count
          ], (err) => {
            if (err) return reject(err);
            resolve();
          });
        })
      )
    );
  } catch (err) {
    console.error("[PRODUCTS] Fetch error:", err.message);
    throw err;
  }
}

app.get('/generate-users', async (req, res) => {
  try {
    await insertRandomUsers();
    res.json({ success: true, message: "5 users inserted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/generate-products', async (req, res) => {
  try {
    await insertProductsFromAPI();
    res.json({ success: true, message: "Products inserted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/products/search', (req, res) => {
  const search = `%${(req.query.q || "").trim()}%`;

  const query = `
    SELECT id, title, description, price, image, category, rating_rate, rating_count
    FROM products
    WHERE title LIKE ? OR description LIKE ? OR category LIKE ?
  `;

  db.all(query, [search, search, search], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/products', (req, res) => {
  db.all(
    `SELECT id, title, description, price, image, category, rating_rate, rating_count FROM products`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  db.get(
    `SELECT * FROM products WHERE id = ?`,
    [id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "Product not found" });
      res.json(row);
    }
  );
});

app.get('/', (req, res) => res.send("Hello Ipssi v3 — API Ready!"));

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

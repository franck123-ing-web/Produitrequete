const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 8000;

app.use(cors());


function sanitize(input) {
  if (typeof input !== "string") return input;

  return input
    .replace(/'/g, "''")   
    .replace(/--/g, "")    
    .replace(/;/g, "")     
    .replace(/\*/g, "")    
    .trim();
}


const db = new sqlite3.Database('./database.db', (err) => {
  if (err) console.error(err.message);
  else console.log('Connected to SQLite database.');
});


db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.run(`
CREATE TABLE IF NOT EXISTS products (
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
      const username = sanitize(u.login.username);
      const password = sanitize(u.login.password);
      const email = sanitize(u.email);

      const query = `
        INSERT INTO users (username, email, password, is_admin)
        VALUES ('${username}', '${email}', '${password}', 0)
      `;

      db.run(query, (err) => {
        if (err) console.error("User insert error:", err.message);
      });
    });

    console.log("Inserted 5 random users.");
  } catch (err) {
    console.error("Error inserting users:", err.message);
  }
}

async function insertProductsFromAPI() {
  try {
    const response = await axios.get('https://fakestoreapi.com/products');
    const products = response.data;

    products.forEach(p => {
      const title = sanitize(p.title);
      const description = sanitize(p.description);
      const category = sanitize(p.category);
      const image = sanitize(p.image);

      const query = `
        INSERT INTO products (title, description, price, image, category, rating_rate, rating_count)
        VALUES ('${title}', '${description}', ${p.price}, '${image}', '${category}', ${p.rating.rate}, ${p.rating.count})
      `;

      db.run(query, (err) => {
        if (err) console.error("Product insert error:", err.message);
      });
    });

    console.log("Products inserted:", products.length);
  } catch (err) {
    console.error("Error fetching products:", err.message);
  }
}

app.get('/generate-users', async (req, res) => {
  await insertRandomUsers();
  res.json({ success: true, message: "Generated 5 random users" });
});

app.get('/generate-products', async (req, res) => {
  await insertProductsFromAPI();
  res.json({ success: true, message: "Products generated" });
});


app.get('/products/search', (req, res) => {
  const raw = req.query.q || "";
  const search = sanitize(raw);

  const query = `
    SELECT id, title, description, price, image, category, rating_rate, rating_count
    FROM products
    WHERE title LIKE '%${search}%'
       OR description LIKE '%${search}%'
       OR category LIKE '%${search}%'
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("SQL search error:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});


app.get('/products', (req, res) => {
  db.all(`
    SELECT id, title, description, price, image, category, rating_rate, rating_count
    FROM products
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


app.get('/products/:id', (req, res) => {
  let id = sanitize(req.params.id);

  
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  const query = `
    SELECT id, title, description, price, image, category, rating_rate, rating_count
    FROM products
    WHERE id = ${id}
  `;

  db.get(query, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || {});
  });
});


app.get('/', (req, res) => {
  res.send("Hello Ipssi v2!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(cors());
const port = 8000;


const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.db',
  logging: console.log 
});


function sanitize(input) {
  if (typeof input !== "string") return input;
  return input
    .replace(/'/g, "''")
    .replace(/--/g, "")
    .replace(/;/g, "")
    .trim();
}


const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  is_admin: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
  timestamps: false
});

const Product = sequelize.define('Product', {
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING },
  price: { type: DataTypes.FLOAT, allowNull: false },
  image: { type: DataTypes.STRING },
  category: { type: DataTypes.STRING },
  rating_rate: { type: DataTypes.FLOAT },
  rating_count: { type: DataTypes.INTEGER }
}, {
  timestamps: false
});


sequelize.sync().then(() => {
  console.log("Database synchronized.");
});


async function insertRandomUsers() {
  try {
    const calls = Array(5).fill(0).map(() => axios.get('https://randomuser.me/api/'));
    const results = await Promise.all(calls);

    for (const r of results) {
      const u = r.data.results[0];
      await User.create({
        username: sanitize(u.login.username),
        email: sanitize(u.email),
        password: sanitize(u.login.password),
        is_admin: 0
      });
    }

    console.log("Inserted 5 random users.");
  } catch (err) {
    console.error("User insert error:", err);
  }
}


async function insertProductsFromAPI() {
  try {
    const response = await axios.get("https://fakestoreapi.com/products");

    for (const p of response.data) {
      await Product.create({
        title: sanitize(p.title),
        description: sanitize(p.description),
        price: p.price,
        image: sanitize(p.image),
        category: sanitize(p.category),
        rating_rate: p.rating.rate,
        rating_count: p.rating.count
      });
    }

    console.log("Inserted products.");
  } catch (err) {
    console.error("Product insert error:", err.message);
  }
}

app.get('/generate-users', async (req, res) => {
  await insertRandomUsers();
  res.json({ message: "5 random users added" });
});

app.get('/generate-products', async (req, res) => {
  await insertProductsFromAPI();
  res.json({ message: "Products added" });
});

app.get('/products/search', async (req, res) => {
  const q = sanitize(req.query.q || "");

  const query = `
      SELECT * FROM Products
      WHERE title LIKE '%${q}%' 
      OR description LIKE '%${q}%'
      OR category LIKE '%${q}%'
  `;

  try {
    const results = await sequelize.query(query, { type: Sequelize.QueryTypes.SELECT });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/products', async (req, res) => {
  try {
    const products = await Product.findAll();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/products/:id', async (req, res) => {
  let id = sanitize(req.params.id);

  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const query = `
    SELECT * FROM Products WHERE id = ${id}
  `;

  try {
    const result = await sequelize.query(query, { type: Sequelize.QueryTypes.SELECT });
    res.json(result[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



app.get('/', (req, res) => {
  res.send("Hello ORM version!");
});


app.listen(port, () => {
  console.log("Server running on port " + port);
});

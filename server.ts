import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import bodyParser from "body-parser";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("quickbite.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category_id INTEGER,
    image_url TEXT,
    available INTEGER DEFAULT 1,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    table_number TEXT,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    menu_item_id INTEGER,
    quantity INTEGER,
    price REAL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    mobile TEXT,
    email TEXT,
    photo_url TEXT
  );
`);

// Seed data if empty
const categoriesToAdd = ["Burgers", "Pizza", "Momos", "Sandwiches", "Cakes", "Beverages", "Tea", "Pasta", "Noodles", "Icecream", "Chinese Platters", "Salads"];
const checkCategory = db.prepare("SELECT * FROM categories WHERE name = ?");
const insertCategory = db.prepare("INSERT INTO categories (name) VALUES (?)");

categoriesToAdd.forEach(cat => {
  if (!checkCategory.get(cat)) {
    insertCategory.run(cat);
  }
});

const menuItemCount = db.prepare("SELECT COUNT(*) as count FROM menu_items").get() as { count: number };
if (menuItemCount.count === 0) {
  const insertMenuItem = db.prepare("INSERT INTO menu_items (name, description, price, category_id, image_url) VALUES (?, ?, ?, ?, ?)");
  insertMenuItem.run("Classic Cheeseburger", "Juicy beef patty with cheddar cheese and crispy fries", 199, 1, "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=90&w=1280");
  insertMenuItem.run("Steamed Momos", "Delicious vegetable steamed momos with spicy chutney", 149, 3, "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?auto=format&fit=crop&q=90&w=1280");
  insertMenuItem.run("Garden Fresh Pizza", "Loaded with tomatoes, basil, and fresh mozzarella", 399, 2, "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&q=90&w=1280");
  insertMenuItem.run("Triple Decker Club Sandwich", "Layers of chicken, egg, cheese, and fresh veggies", 249, 4, "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=90&w=1280");
  insertMenuItem.run("Pizza Style Open Sandwich", "Grilled bread topped with pizza sauce, veggies, and melted cheese", 199, 4, "https://images.unsplash.com/photo-1509482560494-4126f8225994?auto=format&fit=crop&q=90&w=1280");
  insertMenuItem.run("Fast Food Theme Cake", "Custom birthday cake featuring mini burger and fries decorations", 599, 5, "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=90&w=1280");
  insertMenuItem.run("Double Espresso", "Rich and intense dark roast espresso", 99, 6, "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&q=90&w=1280");
  insertMenuItem.run("Caramel Macchiato", "Layered espresso with steamed milk and caramel drizzle", 149, 6, "https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&q=90&w=1280");
  insertMenuItem.run("Classic Cappuccino", "Balanced espresso, steamed milk, and thick foam", 129, 6, "https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&q=90&w=1280");
  insertMenuItem.run("Flat White", "Smooth micro-foam poured over a double shot of espresso", 139, 6, "https://images.unsplash.com/photo-1459755486867-b55449bb39ff?auto=format&fit=crop&q=90&w=1280");
  insertMenuItem.run("Chocolate Lava Cake", "Warm cake with melting heart", 179, 5, "https://picsum.photos/seed/cake/1280/720");
}

// Ensure new categories have at least one item
const itemsToAdd = [
  { name: "Masala Tea", description: "Aromatic spiced tea with milk and ginger", price: 49, categoryName: "Tea", image_url: "https://images.unsplash.com/photo-1544787210-228394c3d3e0?auto=format&fit=crop&q=90&w=1280" },
  { name: "White Sauce Pasta", description: "Creamy penne pasta with mushrooms and herbs", price: 299, categoryName: "Pasta", image_url: "https://images.unsplash.com/photo-1645112481338-351070724812?auto=format&fit=crop&q=90&w=1280" },
  { name: "Hakka Noodles", description: "Stir-fried noodles with crunchy vegetables", price: 249, categoryName: "Noodles", image_url: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&q=90&w=1280" },
  { name: "Vanilla Ice Cream", description: "Classic creamy vanilla bean ice cream", price: 99, categoryName: "Icecream", image_url: "https://images.unsplash.com/photo-1570197788417-0e82375c9371?auto=format&fit=crop&q=90&w=1280" },
  { name: "Chinese Platter", description: "Assorted platter with Manchurian, Fried Rice, and Spring Rolls", price: 449, categoryName: "Chinese Platters", image_url: "https://images.unsplash.com/photo-1512058560366-cd2427ffaa6d?auto=format&fit=crop&q=90&w=1280" },
  { name: "Greek Salad", description: "Fresh cucumbers, tomatoes, olives, and feta cheese", price: 199, categoryName: "Salads", image_url: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&q=90&w=1280" },
  
  // Cakes
  { name: "Red Velvet Heart Cake", description: "Rich red velvet layers with cream cheese frosting and heart decor", price: 699, categoryName: "Cakes", image_url: "https://images.unsplash.com/photo-1586788680434-30d324671ff6?auto=format&fit=crop&q=90&w=1280" },
  { name: "Black Forest Gateau", description: "Chocolate sponge with cherries, whipped cream, and chocolate shavings", price: 599, categoryName: "Cakes", image_url: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=90&w=1280" },
  { name: "Strawberry Lemon Cake", description: "Zesty lemon sponge with fresh strawberry filling", price: 649, categoryName: "Cakes", image_url: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&q=90&w=1280" },
  { name: "Fresh Fruit Cake", description: "Vanilla sponge topped with a variety of seasonal fresh fruits", price: 549, categoryName: "Cakes", image_url: "https://images.unsplash.com/photo-1519340333755-56e9c1d04579?auto=format&fit=crop&q=90&w=1280" },
  { name: "Pineapple Cream Cake", description: "Light and airy cake with pineapple chunks and fresh cream", price: 499, categoryName: "Cakes", image_url: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=90&w=1280" },

  // Sandwiches
  { name: "Ham & Cheese Deli", description: "Premium ham with melted swiss cheese and pickles", price: 199, categoryName: "Sandwiches", image_url: "https://images.unsplash.com/photo-1521390188846-e2a3a97453a0?auto=format&fit=crop&q=90&w=1280" },
  { name: "Grilled Chicken Pesto", description: "Grilled chicken breast with basil pesto and sun-dried tomatoes", price: 249, categoryName: "Sandwiches", image_url: "https://images.unsplash.com/photo-1539252554452-da6245023e95?auto=format&fit=crop&q=90&w=1280" },
  { name: "Paneer Tikka Sandwich", description: "Spiced paneer cubes with mint chutney in grilled bread", price: 199, categoryName: "Sandwiches", image_url: "https://images.unsplash.com/photo-1567234669003-dce7a7a88821?auto=format&fit=crop&q=90&w=1280" },

  // Momos
  { name: "Spinach Green Momos", description: "Healthy spinach-infused dough with vegetable filling", price: 149, categoryName: "Momos", image_url: "https://images.unsplash.com/photo-1534422298391-e4f8c170db76?auto=format&fit=crop&q=90&w=1280" },
  { name: "Crispy Fried Momos", description: "Deep-fried golden momos served with spicy mayo", price: 179, categoryName: "Momos", image_url: "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?auto=format&fit=crop&q=90&w=1280" },

  // Pizza
  { name: "Classic Margherita", description: "Simple and elegant with tomato sauce, mozzarella, and basil", price: 349, categoryName: "Pizza", image_url: "https://images.unsplash.com/photo-1574071318508-1cdbad80ad38?auto=format&fit=crop&q=90&w=1280" },
  { name: "Spicy Paneer Pizza", description: "Tandoori paneer, capsicum, and onions with spicy sauce", price: 399, categoryName: "Pizza", image_url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=90&w=1280" },
  { name: "Pepperoni Feast", description: "Loaded with premium pepperoni and extra mozzarella", price: 449, categoryName: "Pizza", image_url: "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&q=90&w=1280" },

  // Burgers
  { name: "Loaded Bacon Burger", description: "Beef patty with crispy bacon, egg, and BBQ sauce", price: 249, categoryName: "Burgers", image_url: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&q=90&w=1280" },
  { name: "Garden Veggie Burger", description: "Handmade vegetable patty with avocado and sprouts", price: 199, categoryName: "Burgers", image_url: "https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&q=90&w=1280" },
  { name: "Crispy Chicken Burger", description: "Breaded chicken fillet with spicy mayo and lettuce", price: 249, categoryName: "Burgers", image_url: "https://images.unsplash.com/photo-1513185158878-8d8c182b013d?auto=format&fit=crop&q=90&w=1280" },
  { name: "Double Cheese Melt", description: "Two beef patties with triple layers of melted cheddar", price: 299, categoryName: "Burgers", image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=90&w=1280" }
];

const checkItem = db.prepare("SELECT * FROM menu_items WHERE name = ?");
const insertItem = db.prepare("INSERT INTO menu_items (name, description, price, category_id, image_url) VALUES (?, ?, ?, ?, ?)");
const getCategoryId = db.prepare("SELECT id FROM categories WHERE name = ?");

itemsToAdd.forEach(item => {
  if (!checkItem.get(item.name)) {
    const cat = getCategoryId.get(item.categoryName) as { id: number };
    if (cat) {
      insertItem.run(item.name, item.description, item.price, cat.id, item.image_url);
    }
  }
});

// Ensure at least one profile exists
const profileCount = db.prepare("SELECT COUNT(*) as count FROM profiles").get() as { count: number };
if (profileCount.count === 0) {
  db.prepare("INSERT INTO profiles (name, mobile, email) VALUES (?, ?, ?)").run("", "", "");
}

// Update existing Unsplash images to 720p quality (1280px)
db.prepare(`
  UPDATE menu_items 
  SET image_url = REPLACE(REPLACE(image_url, 'w=1000', 'w=1280'), 'q=80', 'q=90')
  WHERE image_url LIKE '%images.unsplash.com%'
`).run();

// Update existing Picsum images to 720p quality (1280x720)
db.prepare(`
  UPDATE menu_items 
  SET image_url = REPLACE(image_url, '400/300', '1280/720')
  WHERE image_url LIKE '%picsum.photos%'
`).run();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(bodyParser.json());

  // Profile Endpoints
  app.get("/api/profile", (req, res) => {
    const profile = db.prepare("SELECT * FROM profiles LIMIT 1").get();
    res.json(profile || { name: "", mobile: "", email: "", photo_url: "" });
  });

  app.post("/api/profile", (req, res) => {
    const { name, mobile, email, photo_url } = req.body;
    db.prepare("UPDATE profiles SET name = ?, mobile = ?, email = ?, photo_url = ? WHERE id = (SELECT id FROM profiles LIMIT 1)").run(name, mobile, email, photo_url);
    res.json({ success: true });
  });

  // API Routes
  app.get("/api/categories", (req, res) => {
    const categories = db.prepare("SELECT * FROM categories").all();
    res.json(categories);
  });

  app.get("/api/menu", (req, res) => {
    const menu = db.prepare(`
      SELECT m.*, c.name as category_name 
      FROM menu_items m 
      JOIN categories c ON m.category_id = c.id
    `).all();
    res.json(menu);
  });

  app.post("/api/orders", (req, res) => {
    const { customer_name, table_number, items, total } = req.body;
    
    const insertOrder = db.prepare("INSERT INTO orders (customer_name, table_number, total) VALUES (?, ?, ?)");
    const result = insertOrder.run(customer_name, table_number, total);
    const orderId = result.lastInsertRowid;

    const insertOrderItem = db.prepare("INSERT INTO order_items (order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?)");
    for (const item of items) {
      insertOrderItem.run(orderId, item.id, item.quantity, item.price);
    }

    res.json({ id: orderId, status: 'pending' });
  });

  app.get("/api/orders", (req, res) => {
    const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all() as any[];
    
    const ordersWithItems = orders.map(order => {
      const items = db.prepare(`
        SELECT oi.*, m.name, m.image_url 
        FROM order_items oi 
        JOIN menu_items m ON oi.menu_item_id = m.id 
        WHERE oi.order_id = ?
      `).all(order.id);
      return { ...order, items };
    });
    
    res.json(ordersWithItems);
  });

  app.get("/api/orders/:id", (req, res) => {
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    
    const items = db.prepare(`
      SELECT oi.*, m.name 
      FROM order_items oi 
      JOIN menu_items m ON oi.menu_item_id = m.id 
      WHERE oi.order_id = ?
    `).all(req.params.id);
    
    res.json({ ...order, items });
  });

  app.patch("/api/orders/:id/status", (req, res) => {
    const { status } = req.body;
    db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, req.params.id);
    res.json({ success: true });
  });

  // Menu Management
  app.post("/api/menu", (req, res) => {
    const { name, description, price, category_id, image_url } = req.body;
    const result = db.prepare(`
      INSERT INTO menu_items (name, description, price, category_id, image_url) 
      VALUES (?, ?, ?, ?, ?)
    `).run(name, description, price, category_id, image_url);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/menu/:id", (req, res) => {
    const { name, description, price, category_id, image_url } = req.body;
    db.prepare(`
      UPDATE menu_items 
      SET name = ?, description = ?, price = ?, category_id = ?, image_url = ? 
      WHERE id = ?
    `).run(name, description, price, category_id, image_url, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/menu/:id", (req, res) => {
    db.prepare("DELETE FROM menu_items WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Admin Stats
  app.get("/api/admin/stats", (req, res) => {
    const totalOrders = db.prepare("SELECT COUNT(*) as count FROM orders").get() as any;
    const totalRevenue = db.prepare("SELECT SUM(total) as total FROM orders").get() as any;
    const recentOrders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 5").all() as any[];
    
    const ordersWithItems = recentOrders.map(order => {
      const items = db.prepare(`
        SELECT oi.*, m.name 
        FROM order_items oi 
        JOIN menu_items m ON oi.menu_item_id = m.id 
        WHERE oi.order_id = ?
      `).all(order.id);
      return { ...order, items };
    });
    
    res.json({
      totalOrders: totalOrders.count,
      totalRevenue: totalRevenue.total || 0,
      recentOrders: ordersWithItems
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

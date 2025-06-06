console.log("🔥 LOADED server.js from:", __filename);


const express      = require('express');
const cors         = require('cors');
const bodyParser   = require('body-parser');
const mysql        = require('mysql2');
const app          = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));


const db = mysql.createConnection({
  host: 'localhost', user: 'root', password: 'dbms', database: 'nutrition_app'
});
db.connect(err => {
  if (err) { console.error(err); process.exit(1); }
  console.log('✅ MySQL connected');
});

app.get('/recipes', (req, res) => {
  db.query('SELECT * FROM recipes', (e,r)=> e? res.status(500).send(e):res.send(r));
});
app.post('/recipes', (req, res) => {
  const { recipe_name, category, cooking_time, instructions, calories, protein, carbs, fats } = req.body;
  db.query(
    `INSERT INTO recipes 
       (recipe_name, category, cooking_time, instructions, calories, protein, carbs, fats)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [recipe_name, category, cooking_time, instructions, calories, protein, carbs, fats],
    (e, result)=> e? res.status(500).send(e): res.send({ id: result.insertId })
  );
});
app.put('/recipes/:id', (req, res) => {
  const { recipe_name, category, cooking_time, instructions, calories, protein, carbs, fats } = req.body;
  db.query(
    `UPDATE recipes
     SET recipe_name=?,category=?,cooking_time=?,instructions=?,calories=?,protein=?,carbs=?,fats=?
     WHERE recipe_id=?`,
    [recipe_name,category,cooking_time,instructions,calories,protein,carbs,fats, req.params.id],
    e=> e? res.status(500).send(e): res.send({})
  );
});
app.delete('/recipes/:id', (req, res) => {
  db.query('DELETE FROM recipes WHERE recipe_id=?', [req.params.id],
    e=> e? res.status(500).send(e): res.send({})
  );
});
app.post('/ingredients', (req, res) => {
  const { name, category, calories_per_unit } = req.body;
  db.query(
    'INSERT INTO ingredients(name,category,calories_per_unit) VALUES(?,?,?)',
    [name, category, calories_per_unit],
    (e, result)=> e? res.status(500).send(e): res.send({ id: result.insertId })
  );
});
app.get('/ingredients', (req, res) => {
  db.query('SELECT * FROM ingredients', (e, rows)=> e? res.status(500).send(e): res.send(rows));
});
app.put('/ingredients/:id', (req, res) => {
  const { name, category, calories_per_unit } = req.body;
  db.query(
    `UPDATE ingredients SET name=?,category=?,calories_per_unit=? WHERE ingredient_id=?`,
    [name, category, calories_per_unit, req.params.id],
    e=> e? res.status(500).send(e): res.send({})
  );
});
app.delete('/ingredients/:id', (req, res) => {
  db.query('DELETE FROM ingredients WHERE ingredient_id=?', [req.params.id],
    e=> e? res.status(500).send(e): res.send({})
  );
});
app.post('/users', (req, res) => {
  const { name, email, password, age, weight, fitness_goal, dietary_restrictions } = req.body;

  const insertUser = `
    INSERT INTO users (name, email, password, age, weight, fitness_goal, dietary_restrictions)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(insertUser, [name, email, password, age, weight, fitness_goal, dietary_restrictions], (err, result) => {
    if (err) {
      console.error('❌ User insert error:', err);
      return res.status(500).json({ error: 'User creation failed' });
    }

    const newUserId = result.insertId;
    console.log('✅ New user ID:', newUserId);

    // STEP 1: Retrieve all matching ingredient_ids in one go
    const pantryItems = ['Garlic', 'Salt', 'Tomato', 'Rice'];
    const getIngredientsSql = `
      SELECT ingredient_id, name FROM ingredients
      WHERE name IN (${pantryItems.map(() => '?').join(',')})
    `;

    db.query(getIngredientsSql, pantryItems, (ingErr, rows) => {
      if (ingErr) {
        console.error('❌ Ingredient lookup failed:', ingErr);
        return res.status(500).json({ error: 'Pantry setup failed' });
      }

      if (rows.length === 0) {
        return res.status(500).json({ error: 'No matching ingredients found' });
      }

      const insertValues = rows.map(row => [newUserId, row.ingredient_id, '100g']);

      db.query(
        'INSERT INTO user_pantry (user_id, ingredient_id, quantity_available) VALUES ?',
        [insertValues],
        (pErr) => {
          if (pErr) {
            console.error('⚠️ Pantry insert failed:', pErr);
            return res.status(500).json({ error: 'User created but pantry failed' });
          }

          res.json({ user_id: newUserId });
        }
      );
    });
  });
});

app.post('/login', (req, res) => {
  console.log('🔐 /login body:', req.body);
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const sql = `
    SELECT
      user_id,
      name,
      fitness_goal,
      dietary_restrictions
    FROM users
    WHERE email = ?
      AND password = ?
    LIMIT 1
  `;

  db.query(sql, [email, password], (err, rows) => {
    if (err) {
      console.error('❌ Login error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (rows.length === 0) {
      console.log('🔒 Invalid login:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('✅ Login success:', rows[0]);
    // Return the user WITHOUT the password
    res.json(rows[0]);
  });
});
app.get('/users', (req, res) => {
  db.query('SELECT user_id,name,email FROM users', (e, rows)=> e?res.status(500).send(e):res.send(rows));
});
app.get('/pantry', (req, res) => {
  const uid = req.query.user_id;
  db.query(
    `SELECT up.ingredient_id, up.quantity_available,
            i.name AS ingredient_name
     FROM user_pantry AS up
     JOIN ingredients AS i ON up.ingredient_id=i.ingredient_id
     WHERE up.user_id=?`,
    [uid],
    (e, rows)=> e?res.status(500).send(e):res.send(rows)
  );
});
app.put('/pantry/:id', (req, res) => {
  const { quantity_available } = req.body;
  db.query(
    'UPDATE user_pantry SET quantity_available=? WHERE ingredient_id=? AND user_id=?',
    [quantity_available, req.params.id, req.query.user_id],
    e=> e?res.status(500).send(e):res.send({})
  );
});
app.post('/pantry', (req, res) => {
  const { user_id, ingredient_id, quantity_available } = req.body;
  if (!user_id || !ingredient_id || !quantity_available) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const sql = `
    INSERT INTO user_pantry (user_id, ingredient_id, quantity_available)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE quantity_available = VALUES(quantity_available)
  `;

  db.query(sql, [user_id, ingredient_id, quantity_available], (err, result) => {
    if (err) {
      console.error('❌ Error inserting pantry item:', err);
      return res.status(500).json({ error: 'Failed to insert pantry item' });
    }
    res.json({ success: true });
  });
});

app.delete('/pantry/:id', (req, res) => {
  const { user_id } = req.query;
  db.query(
    'DELETE FROM user_pantry WHERE ingredient_id=? AND user_id=?',
    [req.params.id, user_id],
    e=> e?res.status(500).send(e):res.send({})
  );
});
app.post('/stores', (req, res) => {
  const { name, location, online_ordering } = req.body;
  db.query(
    'INSERT INTO grocery_stores(name,location,online_ordering) VALUES(?,?,?)',
    [name,location,online_ordering],
    (e,r)=> e?res.status(500).send(e):res.send({ id: r.insertId })
  );
});
app.get('/stores', (req, res) => {
  db.query('SELECT * FROM grocery_stores', (e,r)=> e?res.status(500).send(e):res.send(r));
});
app.put('/stores/:id', (req, res) => {
  const { name, location, online_ordering } = req.body;
  db.query(
    'UPDATE grocery_stores SET name=?,location=?,online_ordering=? WHERE store_id=?',
    [name,location,online_ordering,req.params.id],
    e=> e?res.status(500).send(e):res.send({})
  );
});
app.delete('/stores/:id', (req, res) => {
  db.query('DELETE FROM grocery_stores WHERE store_id=?', [req.params.id],
    e=> e?res.status(500).send(e):res.send({})
  );
});
app.post('/items', (req, res) => {
  const { store_id, ingredient_id, price, availability } = req.body;
  db.query(
    'INSERT INTO grocery_items(store_id,ingredient_id,price,availability) VALUES(?,?,?,?)',
    [store_id,ingredient_id,price,availability],
    (e,r)=> e?res.status(500).send(e):res.send({ id: r.insertId })
  );
});
app.get('/items', (req, res) => {
  db.query(
    `SELECT gi.store_id, gi.ingredient_id, gi.price, gi.quantity, gi.availability,
            s.name AS store_name, i.name AS ingredient_name
     FROM grocery_items AS gi
     JOIN grocery_stores AS s  ON gi.store_id=s.store_id
     JOIN ingredients    AS i  ON gi.ingredient_id=i.ingredient_id`,
    (e,r)=> e?res.status(500).send(e):res.send(r)
  );
});

app.put('/items/:id', (req, res) => {
  const { price, availability } = req.body;
  db.query(
    'UPDATE grocery_items SET price=?,availability=? WHERE ingredient_id=? AND store_id=?',
    [price, availability, req.params.id, req.query.store_id],
    e=> e?res.status(500).send(e):res.send({})
  );
});
app.delete('/items/:id', (req, res) => {
  db.query(
    'DELETE FROM grocery_items WHERE ingredient_id=? AND store_id=?',
    [req.params.id, req.query.store_id],
    e=> e?res.status(500).send(e):res.send({})
  );
});
app.get('/recommendations', (req, res) => {
  const userId = +req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'Missing user_id' });

  // 1) grab dietary filter
  db.query(
    'SELECT dietary_restrictions FROM users WHERE user_id = ?',
    [userId],
    (uErr, uRows) => {
      if (uErr) return res.status(500).send(uErr);
      const diet = (uRows[0]?.dietary_restrictions || '').toLowerCase();

      // 2) subqueries for total vs matched ingredients
      const sql = `
        SELECT
          r.recipe_id,
          r.recipe_name,
          r.category,
          r.instructions,
          r.cooking_time,
          r.calories,
          r.protein,
          r.carbs,
          r.fats,
          COALESCE(m.matched, 0)   AS matched_ings,
          t.total_ings
        FROM recipes AS r

        -- total ingredients per recipe
        JOIN (
          SELECT recipe_id, COUNT(*) AS total_ings
          FROM recipe_ingredients
          GROUP BY recipe_id
        ) AS t
          ON t.recipe_id = r.recipe_id

        -- how many that user has
        LEFT JOIN (
          SELECT ri.recipe_id, COUNT(*) AS matched
          FROM recipe_ingredients AS ri
          JOIN user_pantry     AS up
            ON up.ingredient_id = ri.ingredient_id
            AND up.user_id      = ?
          GROUP BY ri.recipe_id
        ) AS m
          ON m.recipe_id = r.recipe_id

        ORDER BY matched DESC, r.recipe_name
        LIMIT 10;
      `;

      db.query(sql, [userId], (rErr, rows) => {
        if (rErr) return res.status(500).send(rErr);

        // 3) map & apply dietary filter if needed
        const recs = rows
          .map(r => ({
            recipe_id:    r.recipe_id,
            recipe_name:  r.recipe_name,
            category:     r.category,
            instructions: r.instructions,
            cooking_time: r.cooking_time,
            calories:     r.calories,
            protein:      r.protein,
            carbs:        r.carbs,
            fats:         r.fats,
            match_percent: Math.round((r.matched_ings / r.total_ings) * 100)
          }))
          .filter(r => {
            if (diet.includes('vegan') && r.category.toLowerCase() !== 'vegan') {
              return false;
            }
            return true;
          });

        res.json(recs);
      });
    }
  );
});

const PORT = 3000;
app.listen(PORT, ()=> console.log(`🚀 Listening on http://localhost:${PORT}`));

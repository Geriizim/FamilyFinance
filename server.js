import crypto from 'crypto';
import express from 'express';
import pg from 'pg';

const { Pool } = pg;

const app = express();
const port = process.env.PORT || 8080;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const ensureSchema = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        fingerprint TEXT UNIQUE NOT NULL,
        transaction_date DATE NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        balance NUMERIC,
        category TEXT,
        currency TEXT,
        card_holder TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
};

const buildFingerprint = (transaction) => {
  const payload = [
    transaction.date,
    transaction.description,
    transaction.amount,
    transaction.balance,
    transaction.currency,
    transaction.cardHolder
  ]
    .map((value) => (value === undefined || value === null ? '' : String(value)))
    .join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
};

app.use(express.json({ limit: '5mb' }));
app.use(express.static('.'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/transactions/bulk', async (req, res) => {
  const transactions = Array.isArray(req.body) ? req.body : [];
  if (!transactions.length) {
    res.status(400).json({ error: 'No transactions provided' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const values = [];
    const placeholders = transactions
      .map((transaction, index) => {
        const fingerprint = buildFingerprint(transaction);
        const baseIndex = index * 8;
        values.push(
          fingerprint,
          transaction.date,
          transaction.description,
          transaction.amount,
          transaction.balance,
          transaction.category,
          transaction.currency,
          transaction.cardHolder
        );
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8})`;
      })
      .join(', ');

    const query = `
      INSERT INTO transactions (
        fingerprint,
        transaction_date,
        description,
        amount,
        balance,
        category,
        currency,
        card_holder
      )
      VALUES ${placeholders}
      ON CONFLICT (fingerprint)
      DO UPDATE SET
        category = EXCLUDED.category,
        balance = EXCLUDED.balance,
        updated_at = NOW();
    `;

    await client.query(query, values);
    await client.query('COMMIT');
    res.json({ saved: transactions.length });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to save transactions' });
  } finally {
    client.release();
  }
});

app.get('/api/transactions', async (req, res) => {
  const month = req.query.month;
  const params = [];
  let whereClause = '';

  if (month) {
    params.push(`${month}-01`);
    params.push(`${month}-01`);
    whereClause = 'WHERE transaction_date >= $1 AND transaction_date < ($2::date + INTERVAL \'1 month\')';
  }

  try {
    const result = await pool.query(
      `SELECT id, transaction_date, description, amount, balance, category, currency, card_holder
       FROM transactions
       ${whereClause}
       ORDER BY transaction_date DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

ensureSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`FamilyFinance server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
  });

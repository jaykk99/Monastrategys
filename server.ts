import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Connection, PublicKey } from "@solana/web3.js";
import admin from "firebase-admin";
import fs from "fs";
import crypto from "crypto";
import Binance from 'binance-api-node';
import rateLimit from 'express-rate-limit';

// Initialize Firebase Admin
try {
  admin.initializeApp();
} catch (e) {
  console.log("Firebase admin initialization failed, might need credentials.");
}

const PROTOCOL_ADDRESS = "MonacoV7ProtocolAddressPlaceholder123456789"; // Replace with actual address
const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = process.env.ENCRYPTION_SECRET!; // Must be 32 bytes

function encrypt(text: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(text: string) {
  const [ivHex, authTagHex, encrypted] = text.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY, 'hex'), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Simple in-memory trade tracking to prevent spam
const activeTrades = new Set<string>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Rate limiting for trade endpoint
  const tradeLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many trade requests, please try again later.'
  });

  // Middleware to authenticate user via Firebase ID Token
  const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      (req as any).user = decodedToken;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };

  // API route to verify Solana transaction
  app.post("/api/verify-tx", async (req, res) => {
    const { txHash, userId, planRequested } = req.body;

    if (!txHash || !userId || !planRequested) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const connection = new Connection("https://api.mainnet-beta.solana.com");
      const tx = await connection.getTransaction(txHash, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        return res.status(404).json({ error: "Transaction not found on mainnet" });
      }

      if (tx.meta?.err) {
        return res.status(400).json({ error: "Transaction failed on chain" });
      }

      if (admin.apps.length > 0) {
        const db = admin.firestore();
        await db.collection('users').doc(userId).update({
          plan: planRequested
        });
        await db.collection('payment_verifications').add({
          userId,
          txHash,
          planRequested,
          status: 'verified',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        return res.json({ success: true, message: "Transaction verified and plan updated." });
      } else {
        return res.json({ success: true, message: "Transaction verified. Awaiting admin approval." });
      }

    } catch (error: any) {
      console.error("Error verifying transaction:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // API route to generate API key
  app.post("/api/generate-api-key", authenticate, async (req, res) => {
    const userId = (req as any).user.uid;
    const db = admin.firestore();
    
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.plan !== 'PRO') {
      return res.status(403).json({ error: 'Only PRO users can generate API keys' });
    }

    const apiKey = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    await db.collection('api_keys').doc(userId).set({
      userId,
      keyHash,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ apiKey });
  });

  // API route to save exchange keys
  app.post("/api/save-exchange-keys", authenticate, async (req, res) => {
    const userId = (req as any).user.uid;
    const { exchange, apiKey, apiSecret, maxPositionSize, riskPerTrade, stopLossPercent, takeProfitPercent } = req.body;
    
    if (!exchange || !apiKey || !apiSecret) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const encryptedKey = encrypt(apiKey);
    const encryptedSecret = encrypt(apiSecret);

    const db = admin.firestore();
    await db.collection('exchange_keys').doc(userId).set({
      exchange,
      apiKey: encryptedKey,
      apiSecret: encryptedSecret,
      maxPositionSize: parseFloat(maxPositionSize) || 0,
      riskPerTrade: parseFloat(riskPerTrade) || 0,
      stopLossPercent: parseFloat(stopLossPercent) || 0,
      takeProfitPercent: parseFloat(takeProfitPercent) || 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true });
  });

  // API route to trigger trade
  app.post("/api/trade", tradeLimiter, async (req, res) => {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      return res.status(401).json({ error: 'Missing API key' });
    }

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const db = admin.firestore();
    const apiKeyDoc = await db.collection('api_keys').where('keyHash', '==', keyHash).get();

    if (apiKeyDoc.empty) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const userId = apiKeyDoc.docs[0].id;
    
    // Retrieve and decrypt exchange keys
    const exchangeKeyDoc = await db.collection('exchange_keys').doc(userId).get();
    if (!exchangeKeyDoc.exists) {
      return res.status(404).json({ error: 'Exchange keys not found' });
    }

    const data = exchangeKeyDoc.data()!;
    const decryptedApiKey = decrypt(data.apiKey);
    const decryptedApiSecret = decrypt(data.apiSecret);

    // Trigger trade logic
    const { symbol, side, quantity } = req.body;
    
    // Risk Management Checks
    if (data.maxPositionSize > 0 && quantity > data.maxPositionSize) {
      return res.status(400).json({ error: 'Quantity exceeds max position size' });
    }

    // Fail-safe: Check if trade is already in progress for this symbol
    const tradeKey = `${userId}:${symbol}`;
    if (activeTrades.has(tradeKey)) {
      return res.status(429).json({ error: 'Trade already in progress for this symbol' });
    }
    activeTrades.add(tradeKey);

    try {
      if (data.exchange === 'binance') {
        const client = Binance({
          apiKey: decryptedApiKey,
          apiSecret: decryptedApiSecret,
        });

        // Execute Market Trade
        const order = await client.order({
          symbol: symbol,
          side: side,
          quantity: quantity.toString(),
          type: 'MARKET',
        });
        
        console.log(`Trade executed for user ${userId}:`, order);
        res.json({ success: true, order });
      } else {
        res.status(400).json({ error: 'Unsupported exchange' });
      }
    } catch (error: any) {
      console.error(`Trade execution failed for user ${userId}:`, error);
      res.status(500).json({ error: error.message });
    } finally {
      activeTrades.delete(tradeKey);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

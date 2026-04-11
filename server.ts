import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Connection } from "@solana/web3.js";
import admin from "firebase-admin";

// Initialize Firebase Admin
try {
  admin.initializeApp();
} catch (e) {
  console.log("Firebase admin initialization failed, might need credentials.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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

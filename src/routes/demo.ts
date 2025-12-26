// ==========================================
// ROUTES DEMO
// Validation et accès via liens temporaires
// ==========================================

import { Router } from "express";
import { db } from "../db";
import { accesTemporaires, agences } from "../schema";
import { eq, and } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "onlytrack-super-secret";

// ==========================================
// GET /api/demo/validate/:token
// Valider un lien de démo
// ==========================================
router.get("/validate/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Chercher l'accès temporaire
    const [acces] = await db
      .select()
      .from(accesTemporaires)
      .where(eq(accesTemporaires.token, token))
      .limit(1);

    if (!acces) {
      return res.status(404).json({ error: "Lien non trouvé" });
    }

    if (!acces.actif) {
      return res.status(403).json({ error: "Ce lien a été révoqué" });
    }

    if (acces.dateExpiration && new Date(acces.dateExpiration) < new Date()) {
      return res.status(403).json({ error: "Ce lien a expiré" });
    }

    // Récupérer le nom de l'agence
    const [agence] = await db
      .select({ nom: agences.nom })
      .from(agences)
      .where(eq(agences.id, acces.agenceId))
      .limit(1);

    res.json({
      nom: acces.nom,
      agenceNom: agence?.nom || "Agence",
      dateExpiration: acces.dateExpiration,
    });
  } catch (error) {
    console.error("Erreur validation token démo:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ==========================================
// POST /api/demo/access/:token
// Accéder à l'app via le lien de démo
// ==========================================
router.post("/access/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Chercher l'accès temporaire
    const [acces] = await db
      .select()
      .from(accesTemporaires)
      .where(eq(accesTemporaires.token, token))
      .limit(1);

    if (!acces) {
      return res.status(404).json({ error: "Lien non trouvé" });
    }

    if (!acces.actif) {
      return res.status(403).json({ error: "Ce lien a été révoqué" });
    }

    if (acces.dateExpiration && new Date(acces.dateExpiration) < new Date()) {
      return res.status(403).json({ error: "Ce lien a expiré" });
    }

    // Créer un JWT pour l'accès démo
    const demoToken = jwt.sign(
      {
        type: "demo",
        accesId: acces.id,
        agenceId: acces.agenceId,
        nom: acces.nom,
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Définir le cookie de session démo
    res.cookie("demo_token", demoToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/", // Important: cookie disponible sur toutes les routes
      maxAge: 24 * 60 * 60 * 1000, // 24 heures
    });

    res.json({ message: "Accès autorisé", agenceId: acces.agenceId });
  } catch (error) {
    console.error("Erreur accès démo:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;

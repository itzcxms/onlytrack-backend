// ==========================================
// ROUTES AUTH ADMIN
// Authentification séparée pour les admins
// ==========================================

import { Router } from "express";
import { db } from "../db";
import { superAdmins } from "../schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "onlytrack-super-secret";
const SALT_ROUNDS = 10;

// ==========================================
// POST /api/admin/auth/connexion
// Connexion admin
// ==========================================
router.post("/connexion", async (req, res) => {
  try {
    const { email, motDePasse } = req.body;

    if (!email || !motDePasse) {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }

    // Chercher l'admin
    const [admin] = await db
      .select()
      .from(superAdmins)
      .where(eq(superAdmins.email, email.toLowerCase()))
      .limit(1);

    if (!admin) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    if (!admin.actif) {
      return res.status(401).json({ error: "Ce compte a été désactivé" });
    }

    // Vérifier le mot de passe
    const motDePasseValide = await bcrypt.compare(motDePasse, admin.motDePasse);
    if (!motDePasseValide) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    // Mettre à jour la dernière connexion
    await db
      .update(superAdmins)
      .set({ derniereConnexion: new Date() })
      .where(eq(superAdmins.id, admin.id));

    // Générer un token JWT admin
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        type: "admin",
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Définir le cookie
    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    });

    res.json({
      message: "Connexion réussie",
      admin: {
        id: admin.id,
        email: admin.email,
        nom: admin.nom,
        prenom: admin.prenom,
      },
    });
  } catch (error: any) {
    console.error("Erreur connexion admin:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ==========================================
// POST /api/admin/auth/deconnexion
// Déconnexion admin
// ==========================================
router.post("/deconnexion", (req, res) => {
  res.clearCookie("admin_token");
  res.json({ message: "Déconnexion réussie" });
});

// ==========================================
// GET /api/admin/auth/moi
// Récupérer les infos de l'admin connecté
// ==========================================
router.get("/moi", async (req, res) => {
  try {
    const token = req.cookies.admin_token;

    if (!token) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (decoded.type !== "admin") {
      return res.status(401).json({ error: "Token invalide" });
    }

    const [admin] = await db
      .select({
        id: superAdmins.id,
        email: superAdmins.email,
        nom: superAdmins.nom,
        prenom: superAdmins.prenom,
        actif: superAdmins.actif,
      })
      .from(superAdmins)
      .where(eq(superAdmins.id, decoded.id))
      .limit(1);

    if (!admin || !admin.actif) {
      res.clearCookie("admin_token");
      return res.status(401).json({ error: "Compte non trouvé ou désactivé" });
    }

    res.json(admin);
  } catch (error) {
    res.clearCookie("admin_token");
    res.status(401).json({ error: "Token invalide" });
  }
});

// ==========================================
// Middleware pour protéger les routes admin
// ==========================================
export async function requireAdmin(req: any, res: any, next: any) {
  try {
    const token = req.cookies.admin_token;

    if (!token) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (decoded.type !== "admin") {
      return res.status(401).json({ error: "Accès non autorisé" });
    }

    const [admin] = await db
      .select()
      .from(superAdmins)
      .where(eq(superAdmins.id, decoded.id))
      .limit(1);

    if (!admin || !admin.actif) {
      return res.status(401).json({ error: "Compte non trouvé ou désactivé" });
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ error: "Token invalide" });
  }
}

export default router;

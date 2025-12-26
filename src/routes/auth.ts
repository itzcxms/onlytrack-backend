// ==========================================
// ROUTES D'AUTHENTIFICATION
// Inscription, connexion, déconnexion, vérification email
// ==========================================

import { Router } from "express";
import { db } from "../db";
import { agences, utilisateurs, sessions, invitations } from "../schema";
import {
  hashPassword,
  verifyPassword,
  generateJWT,
  generateToken,
  validatePassword,
  hashToken,
} from "../lib/auth";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../middleware/auth";
import { z } from "zod";

const router = Router();

// ==========================================
// SCHÉMAS DE VALIDATION
// ==========================================

const inscriptionSchema = z
  .object({
    prenom: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
    nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
    email: z.string().email("Email invalide"),
    password: z
      .string()
      .min(8, "Le mot de passe doit contenir au moins 8 caractères"),
    confirmPassword: z.string(),
    nomAgence: z
      .string()
      .min(2, "Le nom de l'agence doit contenir au moins 2 caractères"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

const connexionSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string(),
});

// ==========================================
// POST /api/auth/inscription
// Créer un nouveau compte owner avec son agence
// ==========================================
router.post("/inscription", async (req, res) => {
  try {
    // Validation des données
    const data = inscriptionSchema.parse(req.body);

    // Validation force du mot de passe
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // Vérifier si l'email existe déjà
    const [existingUser] = await db
      .select()
      .from(utilisateurs)
      .where(eq(utilisateurs.email, data.email))
      .limit(1);

    if (existingUser) {
      return res.status(400).json({ error: "Cet email est déjà utilisé" });
    }

    // Créer l'agence
    const agenceId = crypto.randomUUID();
    await db.insert(agences).values({
      id: agenceId,
      nom: data.nomAgence,
      plan: "free",
      dateCreation: new Date(),
    });

    // Hash du mot de passe
    const motDePasseHash = await hashPassword(data.password);

    // Générer token de vérification
    const tokenVerification = generateToken();

    // Créer l'utilisateur owner
    const userId = crypto.randomUUID();
    await db.insert(utilisateurs).values({
      id: userId,
      prenom: data.prenom,
      nom: data.nom,
      email: data.email,
      motDePasseHash,
      role: "owner",
      agenceId,
      emailVerifie: false, // On pourrait mettre TRUE en dev pour simplifier les tests
      tokenVerification,
      dateCreation: new Date(),
      actif: true,
    });

    // TODO: Envoyer l'email de vérification
    // await sendVerificationEmail(data.email, tokenVerification);

    console.log(
      `✉️  Email de vérification (DEV): http://localhost:5000/api/auth/verifier-email/${tokenVerification}`,
    );

    res.status(201).json({
      message: "Compte créé avec succès ! Vérifiez votre email.",
      // En dev, on retourne le token pour faciliter les tests
      dev: {
        verificationUrl: `/api/auth/verifier-email/${tokenVerification}`,
      },
    });
  } catch (error: any) {
    console.error("Erreur inscription:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Données invalides",
        details: error.errors,
      });
    }

    res.status(500).json({ error: "Erreur lors de la création du compte" });
  }
});

// ==========================================
// POST /api/auth/connexion
// Authentifier un utilisateur et créer une session
// ==========================================
router.post("/connexion", async (req, res) => {
  try {
    // Validation
    const { email, password } = connexionSchema.parse(req.body);

    // Trouver l'utilisateur
    const [user] = await db
      .select()
      .from(utilisateurs)
      .where(eq(utilisateurs.email, email))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await verifyPassword(password, user.motDePasseHash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    // Vérifier que l'email est vérifié
    if (!user.emailVerifie) {
      return res.status(403).json({
        error: "Veuillez vérifier votre email avant de vous connecter",
        needsEmailVerification: true,
      });
    }

    // Vérifier que le compte est actif
    if (!user.actif) {
      return res.status(403).json({ error: "Compte désactivé" });
    }

    // Générer le JWT
    const token = generateJWT({
      userId: user.id,
      agenceId: user.agenceId,
      role: user.role as "owner" | "member" | "model",
    });

    // Créer la session en base
    const sessionId = crypto.randomUUID();
    const tokenHash = hashToken(token);
    const dateExpiration = new Date();
    dateExpiration.setDate(dateExpiration.getDate() + 7); // 7 jours

    await db.insert(sessions).values({
      id: sessionId,
      utilisateurId: user.id,
      tokenHash,
      dateCreation: new Date(),
      dateExpiration,
      adresseIp: req.ip || null,
      userAgent: req.get("user-agent") || null,
    });

    // Mettre à jour la dernière connexion
    await db
      .update(utilisateurs)
      .set({ derniereConnexion: new Date() })
      .where(eq(utilisateurs.id, user.id));

    // Définir le cookie sécurisé
    res.clearCookie("demo_token"); // Effacer le cookie démo s'il existe
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // HTTPS uniquement en prod
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours en millisecondes
    });

    res.json({
      message: "Connexion réussie",
      user: {
        id: user.id,
        prenom: user.prenom,
        nom: user.nom,
        email: user.email,
        role: user.role,
        agenceId: user.agenceId,
      },
    });
  } catch (error: any) {
    console.error("Erreur connexion:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Données invalides",
        details: error.errors,
      });
    }

    res.status(500).json({ error: "Erreur lors de la connexion" });
  }
});

// ==========================================
// POST /api/auth/deconnexion
// Déconnecter l'utilisateur
// ==========================================
router.post("/deconnexion", authenticate, async (req, res) => {
  try {
    const token = req.cookies.auth_token;

    if (token) {
      const tokenHash = hashToken(token);

      // Supprimer la session de la base
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    }

    // Effacer le cookie
    res.clearCookie("auth_token");
    res.clearCookie("demo_token"); // Aussi effacer le cookie démo

    res.json({ message: "Déconnexion réussie" });
  } catch (error) {
    console.error("Erreur déconnexion:", error);
    res.status(500).json({ error: "Erreur lors de la déconnexion" });
  }
});

// ==========================================
// GET /api/auth/verifier-email/:token
// Vérifier l'email d'un utilisateur
// ==========================================
router.get("/verifier-email/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Trouver l'utilisateur avec ce token
    const [user] = await db
      .select()
      .from(utilisateurs)
      .where(
        and(
          eq(utilisateurs.tokenVerification, token),
          eq(utilisateurs.emailVerifie, false),
        ),
      )
      .limit(1);

    if (!user) {
      return res.status(400).json({
        error: "Token de vérification invalide ou déjà utilisé",
      });
    }

    // Vérifier que le token n'est pas expiré (24h)
    const tokenAge = Date.now() - new Date(user.dateCreation).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 heures

    if (tokenAge > maxAge) {
      return res.status(400).json({
        error: "Token de vérification expiré. Demandez un nouvel email.",
      });
    }

    // Marquer l'email comme vérifié
    await db
      .update(utilisateurs)
      .set({
        emailVerifie: true,
        tokenVerification: null,
      })
      .where(eq(utilisateurs.id, user.id));

    res.json({
      message:
        "Email vérifié avec succès ! Vous pouvez maintenant vous connecter.",
      success: true,
    });
  } catch (error) {
    console.error("Erreur vérification email:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la vérification de l'email" });
  }
});

// ==========================================
// GET /api/auth/moi
// Récupérer les informations de l'utilisateur connecté
// ==========================================
router.get("/moi", authenticate, async (req, res) => {
  try {
    // Si c'est un utilisateur démo, retourner les infos virtuelles
    if (req.user?.isDemo) {
      return res.json({
        id: req.user.id,
        prenom: req.user.demoNom || "Visiteur",
        nom: "Demo",
        email: req.user.email,
        role: req.user.role,
        agenceId: req.user.agenceId,
        emailVerifie: true,
        dateCreation: new Date().toISOString(),
        derniereConnexion: new Date().toISOString(),
        isDemo: true,
      });
    }

    const [user] = await db
      .select({
        id: utilisateurs.id,
        prenom: utilisateurs.prenom,
        nom: utilisateurs.nom,
        email: utilisateurs.email,
        role: utilisateurs.role,
        agenceId: utilisateurs.agenceId,
        emailVerifie: utilisateurs.emailVerifie,
        dateCreation: utilisateurs.dateCreation,
        derniereConnexion: utilisateurs.derniereConnexion,
      })
      .from(utilisateurs)
      .where(eq(utilisateurs.id, req.user!.id))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    res.json(user);
  } catch (error) {
    console.error("Erreur récupération utilisateur:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ==========================================
// PUT /api/auth/profil
// Mettre à jour le profil utilisateur
// ==========================================
router.put("/profil", authenticate, async (req, res) => {
  try {
    const { prenom, nom } = req.body;

    if (!prenom || !nom) {
      return res.status(400).json({ error: "Prénom et nom requis" });
    }

    if (prenom.length < 2 || nom.length < 2) {
      return res.status(400).json({ error: "Le prénom et le nom doivent contenir au moins 2 caractères" });
    }

    await db
      .update(utilisateurs)
      .set({ prenom, nom })
      .where(eq(utilisateurs.id, req.user!.id));

    res.json({ message: "Profil mis à jour", prenom, nom });
  } catch (error) {
    console.error("Erreur mise à jour profil:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

// ==========================================
// GET /api/auth/compte
// Récupérer les informations complètes du compte (user + agence)
// ==========================================
router.get("/compte", authenticate, async (req, res) => {
  try {
    const [user] = await db
      .select({
        id: utilisateurs.id,
        prenom: utilisateurs.prenom,
        nom: utilisateurs.nom,
        email: utilisateurs.email,
        role: utilisateurs.role,
        agenceId: utilisateurs.agenceId,
      })
      .from(utilisateurs)
      .where(eq(utilisateurs.id, req.user!.id))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    const [agence] = await db
      .select({
        nom: agences.nom,
        plan: agences.plan,
        statutAbonnement: agences.statutAbonnement,
        dateCreation: agences.dateCreation,
      })
      .from(agences)
      .where(eq(agences.id, user.agenceId))
      .limit(1);

    res.json({
      user,
      agence: agence || null,
    });
  } catch (error) {
    console.error("Erreur récupération compte:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;

// ==========================================
// MIDDLEWARE D'AUTHENTIFICATION
// Vérifie les JWT et charge les informations utilisateur
// ==========================================

import { Request, Response, NextFunction } from "express";
import { verifyJWT, type JWTPayload } from "../lib/auth";
import { db } from "../db";
import { utilisateurs, sessions, accesTemporaires } from "../schema";
import { eq, and, gt } from "drizzle-orm";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "onlytrack-super-secret";

// Étendre les types Express pour inclure user et agenceId
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: "owner" | "member" | "model";
        agenceId: string;
        isDemo?: boolean;
        demoNom?: string;
      };
      agenceId?: string;
    }
  }
}

/**
 * Middleware d'authentification
 * Vérifie le JWT dans le cookie et charge l'utilisateur
 * Supporte aussi les tokens démo pour l'accès temporaire
 * Ajoute `req.user` et `req.agenceId` à la requête
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // D'abord essayer le token démo
    const demoToken = req.cookies.demo_token;
    if (demoToken) {
      try {
        const decoded = jwt.verify(demoToken, JWT_SECRET) as any;
        
        if (decoded.type === "demo") {
          // Vérifier que l'accès est toujours valide
          const [acces] = await db
            .select()
            .from(accesTemporaires)
            .where(eq(accesTemporaires.id, decoded.accesId))
            .limit(1);
          
          if (acces && acces.actif && (!acces.dateExpiration || new Date(acces.dateExpiration) > new Date())) {
            // Créer un utilisateur virtuel pour l'accès démo
            req.user = {
              id: `demo-${acces.id}`,
              email: acces.email || "demo@onlytrack.io",
              role: "member", // Lecture seule
              agenceId: acces.agenceId,
              isDemo: true,
              demoNom: acces.nom,
            };
            req.agenceId = acces.agenceId;
            return next();
          }
        }
      } catch (e) {
        // Token démo invalide, continuer avec l'auth normale
      }
    }

    // Ensuite essayer le token utilisateur normal
    const token = req.cookies.auth_token;

    if (!token) {
      return res
        .status(401)
        .json({ error: "Non authentifié - Token manquant" });
    }

    // Vérifier le JWT
    const payload = verifyJWT(token);

    if (!payload) {
      return res
        .status(401)
        .json({ error: "Non authentifié - Token invalide" });
    }

    // Vérifier que la session existe et est valide
    const [session] = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.utilisateurId, payload.userId),
          gt(sessions.dateExpiration, new Date()),
        ),
      )
      .limit(1);

    if (!session) {
      return res.status(401).json({ error: "Session expirée" });
    }

    // Charger l'utilisateur complet
    const [user] = await db
      .select()
      .from(utilisateurs)
      .where(eq(utilisateurs.id, payload.userId))
      .limit(1);

    if (!user || !user.actif) {
      return res
        .status(401)
        .json({ error: "Utilisateur inactif ou inexistant" });
    }

    // Ajouter les infos utilisateur à la requête
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as "owner" | "member" | "model",
      agenceId: user.agenceId,
    };
    req.agenceId = user.agenceId;

    next();
  } catch (error: any) {
    console.error("Erreur d'authentification:", error);
    return res
      .status(500)
      .json({ error: "Erreur serveur lors de l'authentification" });
  }
}

/**
 * Middleware pour vérifier les rôles requis
 * À utiliser APRÈS le middleware authenticate
 * @param roles - Liste des rôles autorisés
 */
export function requireRole(...roles: Array<"owner" | "member" | "model">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Accès refusé - Rôle insuffisant",
        requiredRoles: roles,
        yourRole: req.user.role,
      });
    }

    next();
  };
}

/**
 * Middleware optionnel qui charge l'utilisateur si authentifié
 * mais ne rejette pas si non authentifié
 * Utile pour les routes qui fonctionnent avec ou sans auth
 */
export async function authenticateOptional(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = req.cookies.auth_token;

    if (!token) {
      return next();
    }

    const payload = verifyJWT(token);

    if (!payload) {
      return next();
    }

    const [user] = await db
      .select()
      .from(utilisateurs)
      .where(eq(utilisateurs.id, payload.userId))
      .limit(1);

    if (user && user.actif) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role as "owner" | "member" | "model",
        agenceId: user.agenceId,
      };
      req.agenceId = user.agenceId;
    }

    next();
  } catch (error) {
    // Erreur silencieuse, on continue sans auth
    next();
  }
}

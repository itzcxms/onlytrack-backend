// ==========================================
// UTILITAIRES D'AUTHENTIFICATION
// Gestion du hashing, JWT, et génération de tokens
// ==========================================

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// Nombre de rounds pour bcrypt (12 = équilibre sécurité/performance)
const SALT_ROUNDS = 12;

// Secret JWT (doit être dans .env en production)
const JWT_SECRET =
  process.env.JWT_SECRET || "secret-de-developpement-a-changer";

// Durée de validité du JWT (7 jours)
const JWT_EXPIRATION = "7d";

// ==========================================
// HASHING DE MOTS DE PASSE
// ==========================================

/**
 * Hash un mot de passe avec bcrypt
 * @param password - Mot de passe en clair
 * @returns Mot de passe hashé
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Vérifie si un mot de passe correspond au hash
 * @param password - Mot de passe en clair à vérifier
 * @param hash - Hash stocké en base de données
 * @returns true si le mot de passe correspond
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// ==========================================
// GÉNÉRATION DE TOKENS
// ==========================================

/**
 * Génère un token aléatoire sécurisé
 * Utilisé pour vérification email, reset password, invitations
 * @param length - Longueur du token en bytes (défaut: 32)
 * @returns Token hexadécimal
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Génère un mot de passe aléatoire sécurisé
 * Format: 3 lettres majuscules + 3 chiffres + 2 caractères spéciaux + 4 lettres minuscules
 * Exemple: "Kp7@xY2#mQ9!"
 * @returns Mot de passe sécurisé
 */
export function generateSecurePassword(): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "@#$%&*!?";

  const getRandom = (chars: string, count: number): string => {
    return Array.from(
      { length: count },
      () => chars[crypto.randomInt(0, chars.length)],
    ).join("");
  };

  // Construire le mot de passe
  const parts = [
    getRandom(uppercase, 3),
    getRandom(numbers, 3),
    getRandom(special, 2),
    getRandom(lowercase, 4),
  ];

  // Mélanger les parties pour plus de sécurité
  const password = parts.join("").split("");
  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join("");
}

// ==========================================
// JWT (JSON WEB TOKENS)
// ==========================================

export interface JWTPayload {
  userId: string;
  agenceId: string;
  role: "owner" | "member" | "model";
}

/**
 * Génère un JWT pour un utilisateur
 * @param payload - Données de l'utilisateur à inclure dans le token
 * @returns JWT signé
 */
export function generateJWT(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRATION,
  });
}

/**
 * Vérifie et décode un JWT
 * @param token - JWT à vérifier
 * @returns Payload décodé ou null si invalide
 */
export function verifyJWT(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Hash un token pour le stocker en base de données
 * (pour les sessions, on stocke pas le JWT en clair)
 * @param token - Token à hasher
 * @returns Hash SHA256 du token
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ==========================================
// VALIDATION DE MOT DE PASSE
// ==========================================

/**
 * Valide la force d'un mot de passe
 * Règles: minimum 8 caractères, au moins 1 majuscule, 1 chiffre, 1 caractère spécial
 * @param password - Mot de passe à valider
 * @returns Object avec isValid et message d'erreur si invalide
 */
export function validatePassword(password: string): {
  isValid: boolean;
  error?: string;
} {
  if (password.length < 8) {
    return {
      isValid: false,
      error: "Le mot de passe doit contenir au moins 8 caractères",
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      error: "Le mot de passe doit contenir au moins une majuscule",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      error: "Le mot de passe doit contenir au moins un chiffre",
    };
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      isValid: false,
      error: "Le mot de passe doit contenir au moins un caractère spécial",
    };
  }

  return { isValid: true };
}

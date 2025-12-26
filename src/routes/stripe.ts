// ==========================================
// ROUTES STRIPE
// Gestion des abonnements et paiements
// ==========================================

import { Router } from "express";
import Stripe from "stripe";
import { db } from "../db";
import { agences, utilisateurs } from "../schema";
import { eq } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

const router = Router();

// Initialiser Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// ==========================================
// GET /api/stripe/config
// Retourner la clé publique Stripe
// ==========================================
router.get("/config", (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

// ==========================================
// POST /api/stripe/create-checkout
// Créer une session de paiement Stripe
// ==========================================
router.post("/create-checkout", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const agenceId = req.agenceId!;

    // Récupérer l'utilisateur et l'agence
    const [user] = await db
      .select()
      .from(utilisateurs)
      .where(eq(utilisateurs.id, userId))
      .limit(1);

    const [agence] = await db
      .select()
      .from(agences)
      .where(eq(agences.id, agenceId))
      .limit(1);

    if (!user || !agence) {
      return res.status(404).json({ error: "Utilisateur ou agence non trouvé" });
    }

    // Créer ou récupérer le customer Stripe
    let customerId = agence.idAbonnementStripe;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.prenom} ${user.nom}`,
        metadata: {
          agenceId: agenceId,
          userId: userId,
        },
      });
      customerId = customer.id;
    }

    // Créer la session de checkout avec trial de 3 jours
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "OnlyTrack",
              description: "Abonnement mensuel",
            },
            unit_amount: 4900, // 49€ en cents
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      subscription_data: {
        trial_period_days: 3,
        metadata: {
          agenceId: agenceId,
        },
      },
      success_url: `${req.headers.origin || "http://localhost:5000"}/?success=true`,
      cancel_url: `${req.headers.origin || "http://localhost:5000"}/pricing?canceled=true`,
      metadata: {
        agenceId: agenceId,
        userId: userId,
      },
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("Erreur création checkout:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// POST /api/stripe/webhook
// Recevoir les événements Stripe
// ==========================================
router.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  
  // Note: En production, vérifier la signature avec STRIPE_WEBHOOK_SECRET
  // Pour le dev, on accepte tous les événements
  
  try {
    const event = req.body;

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const agenceId = session.metadata?.agenceId;
        
        if (agenceId) {
          // Activer l'abonnement premium
          await db
            .update(agences)
            .set({
              plan: "premium",
              statutAbonnement: "actif",
              idAbonnementStripe: session.customer,
            })
            .where(eq(agences.id, agenceId));
          
          console.log(`✅ Agence ${agenceId} passée en Premium`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        // Trouver l'agence par customer ID
        const [agence] = await db
          .select()
          .from(agences)
          .where(eq(agences.idAbonnementStripe, customerId))
          .limit(1);
        
        if (agence) {
          // Suspendre l'abonnement (pas supprimer les données)
          await db
            .update(agences)
            .set({
              plan: "free",
              statutAbonnement: "annule",
            })
            .where(eq(agences.id, agence.id));
          
          console.log(`⚠️ Agence ${agence.id} abonnement annulé`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        
        // Trouver l'agence par customer ID
        const [agence] = await db
          .select()
          .from(agences)
          .where(eq(agences.idAbonnementStripe, customerId))
          .limit(1);
        
        if (agence) {
          // Suspendre le compte en attente de paiement
          await db
            .update(agences)
            .set({
              statutAbonnement: "suspendu",
            })
            .where(eq(agences.id, agence.id));
          
          console.log(`🔴 Agence ${agence.id} suspendue (paiement échoué)`);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        
        // Trouver l'agence par customer ID
        const [agence] = await db
          .select()
          .from(agences)
          .where(eq(agences.idAbonnementStripe, customerId))
          .limit(1);
        
        if (agence) {
          // Réactiver le compte
          await db
            .update(agences)
            .set({
              plan: "premium",
              statutAbonnement: "actif",
            })
            .where(eq(agences.id, agence.id));
          
          console.log(`✅ Agence ${agence.id} paiement reçu`);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("Erreur webhook Stripe:", error);
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// POST /api/stripe/portal
// Accès au portail client Stripe
// ==========================================
router.post("/portal", authenticate, async (req, res) => {
  try {
    const agenceId = req.agenceId!;

    const [agence] = await db
      .select()
      .from(agences)
      .where(eq(agences.id, agenceId))
      .limit(1);

    if (!agence?.idAbonnementStripe) {
      return res.status(400).json({ error: "Aucun abonnement actif" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: agence.idAbonnementStripe,
      return_url: `${req.headers.origin || "http://localhost:5000"}/`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("Erreur portail Stripe:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GET /api/stripe/status
// Vérifier le statut d'abonnement
// ==========================================
router.get("/status", authenticate, async (req, res) => {
  try {
    const agenceId = req.agenceId!;

    const [agence] = await db
      .select({
        plan: agences.plan,
        statutAbonnement: agences.statutAbonnement,
      })
      .from(agences)
      .where(eq(agences.id, agenceId))
      .limit(1);

    if (!agence) {
      return res.status(404).json({ error: "Agence non trouvée" });
    }

    // Un compte est premium si:
    // - Le plan est "premium" ET
    // - Le statut n'est PAS "suspendu" ou "annule"
    const isPremium = agence.plan === "premium" && 
      agence.statutAbonnement !== "suspendu" && 
      agence.statutAbonnement !== "annule";

    res.json({
      plan: agence.plan,
      status: agence.statutAbonnement,
      isPremium,
    });
  } catch (error: any) {
    console.error("Erreur statut abonnement:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// POST /api/stripe/verify-payment
// Vérifier et synchroniser le statut de paiement (pour dev sans webhooks)
// ==========================================
router.post("/verify-payment", authenticate, async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    console.log(`🔍 Vérification paiement pour agence: ${agenceId}`);

    const [agence] = await db
      .select()
      .from(agences)
      .where(eq(agences.id, agenceId))
      .limit(1);

    if (!agence) {
      console.log(`❌ Agence non trouvée: ${agenceId}`);
      return res.status(404).json({ error: "Agence non trouvée" });
    }

    console.log(`📊 État actuel: plan=${agence.plan}, statut=${agence.statutAbonnement}, stripeId=${agence.idAbonnementStripe}`);

    // Si déjà premium, pas besoin de vérifier
    if (agence.plan === "premium" && agence.statutAbonnement === "actif") {
      console.log(`✅ Déjà premium`);
      return res.json({ 
        success: true, 
        message: "Abonnement déjà actif",
        plan: "premium",
        status: "actif"
      });
    }

    // Si on a un customer ID Stripe, vérifier les abonnements actifs
    if (agence.idAbonnementStripe) {
      console.log(`🔎 Vérification abonnement customer: ${agence.idAbonnementStripe}`);
      const subscriptions = await stripe.subscriptions.list({
        customer: agence.idAbonnementStripe,
        limit: 5,
      });

      console.log(`📋 Abonnements trouvés: ${subscriptions.data.length}`);
      
      for (const sub of subscriptions.data) {
        console.log(`  - Sub ${sub.id}: status=${sub.status}`);
        if (sub.status === "active" || sub.status === "trialing") {
          // Mettre à jour le plan en premium
          await db
            .update(agences)
            .set({
              plan: "premium",
              statutAbonnement: "actif",
            })
            .where(eq(agences.id, agenceId));

          console.log(`✅ Agence ${agenceId} synchronisée - Premium activé`);
          
          return res.json({
            success: true,
            message: "Abonnement activé avec succès",
            plan: "premium",
            status: "actif"
          });
        }
      }
    }

    // Chercher les sessions de checkout récentes
    console.log(`🔎 Recherche sessions checkout...`);
    const sessions = await stripe.checkout.sessions.list({
      limit: 20,
    });

    console.log(`📋 Sessions trouvées: ${sessions.data.length}`);

    for (const session of sessions.data) {
      console.log(`  - Session ${session.id}: agenceId=${session.metadata?.agenceId}, status=${session.status}, payment=${session.payment_status}, customer=${session.customer}`);
      
      // Vérifier si c'est une session pour cette agence qui est complète
      if (session.metadata?.agenceId === agenceId && session.status === "complete") {
        // Mettre à jour avec le customer ID (pour trial, payment_status peut être "no_payment_required")
        await db
          .update(agences)
          .set({
            plan: "premium",
            statutAbonnement: "actif",
            idAbonnementStripe: session.customer as string,
          })
          .where(eq(agences.id, agenceId));

        console.log(`✅ Agence ${agenceId} synchronisée via session ${session.id} - Premium activé`);
        
        return res.json({
          success: true,
          message: "Abonnement activé avec succès",
          plan: "premium",
          status: "actif"
        });
      }
    }

    console.log(`❌ Aucun paiement trouvé pour ${agenceId}`);
    return res.json({ 
      success: false, 
      message: "Aucun paiement trouvé",
      plan: agence.plan,
      status: agence.statutAbonnement
    });
  } catch (error: any) {
    console.error("Erreur vérification paiement:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

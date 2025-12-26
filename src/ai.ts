// Reference: blueprint:javascript_openai_ai_integrations
import OpenAI from "openai";
import type { IStorage } from "./storage";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
if (
  !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
  !process.env.AI_INTEGRATIONS_OPENAI_API_KEY
) {
  console.warn(
    "Replit AI integration not fully configured. AI features may not work.",
  );
}

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export async function analyzeWithAI(
  prompt: string,
  storage?: IStorage,
  workspaceId?: string,
): Promise<string> {
  try {
    // Detect question type and gather relevant context
    let contextData = "";
    const lowerPrompt = prompt.toLowerCase();

    // Only query database if storage and workspace are provided
    if (storage && workspaceId) {
      // Questions about inspirations
      if (
        lowerPrompt.includes("inspiration") ||
        lowerPrompt.includes("créer une inspiration") ||
        lowerPrompt.includes("ajouter une inspiration")
      ) {
        contextData = `\n\nInstructions pour créer une inspiration:\n1. Aller dans l'onglet "Inspiration" dans la barre latérale\n2. Cliquer sur le bouton "+ Ajouter une inspiration"\n3. Remplir les champs: sélectionner un modèle, choisir la plateforme (Instagram, TikTok, YouTube, etc.), entrer l'URL du contenu\n4. Optionnellement, ajouter des notes et les métriques (vues, likes, commentaires)\n5. Cliquer sur "Ajouter" pour enregistrer`;
      }

      // Questions about posts/analytics
      if (
        lowerPrompt.includes("post") ||
        lowerPrompt.includes("vue") ||
        lowerPrompt.includes("like") ||
        lowerPrompt.includes("engagement")
      ) {
        try {
          const models = await storage.getModeles();

          // Get posts for all models
          const allPostsPromises = models.map((model) =>
            storage.getPostsAnalyticsByModele(model.id),
          );
          const postsArrays = await Promise.all(allPostsPromises);
          const posts = postsArrays.flat();

          // Extract timeframe if mentioned
          let daysBack = 30; // default
          if (
            lowerPrompt.includes("7 jours") ||
            lowerPrompt.includes("7j") ||
            lowerPrompt.includes("semaine")
          ) {
            daysBack = 7;
          } else if (
            lowerPrompt.includes("15 jours") ||
            lowerPrompt.includes("15j")
          ) {
            daysBack = 15;
          } else if (
            lowerPrompt.includes("30 jours") ||
            lowerPrompt.includes("30j") ||
            lowerPrompt.includes("mois")
          ) {
            daysBack = 30;
          }

          // Filter posts by timeframe
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - daysBack);
          const recentPosts = posts.filter(
            (p: any) => new Date(p.datePublication) >= cutoffDate,
          );

          // Build context with actual data
          contextData = `\n\nDonnées analytics disponibles (${daysBack} derniers jours):\n`;
          recentPosts.forEach((post: any, idx: number) => {
            const model = models.find((m) => m.id === post.modeleId);
            contextData += `Post ${idx + 1}: ${post.vues} vues, ${post.likes} likes, ${post.commentaires} commentaires, ${post.engagement}% engagement (Modèle: ${model?.nom || "N/A"}, Date: ${new Date(post.datePublication).toLocaleDateString("fr-FR")})\n`;
          });

          if (lowerPrompt.includes("plus") && lowerPrompt.includes("vue")) {
            const topByViews = [...recentPosts].sort(
              (a: any, b: any) => (b.vues || 0) - (a.vues || 0),
            )[0];
            if (topByViews) {
              const model = models.find((m) => m.id === topByViews.modeleId);
              contextData += `\n✨ Top post par vues: ${topByViews.vues} vues (${model?.nom || "N/A"}, ${new Date(topByViews.datePublication).toLocaleDateString("fr-FR")})`;
            }
          }
        } catch (error) {
          console.error("Error fetching analytics data:", error);
        }
      }

      // Questions about models
      if (
        lowerPrompt.includes("modèle") ||
        lowerPrompt.includes("model") ||
        lowerPrompt.includes("performant")
      ) {
        try {
          const models = await storage.getModeles();
          contextData = `\n\nModèles disponibles:\n`;
          models.forEach((model) => {
            contextData += `- ${model.nom}: ${model.abonnes} followers, ${model.engagement}% engagement, ${model.revenus}€ de revenus\n`;
          });
        } catch (error) {
          console.error("Error fetching models:", error);
        }
      }

      // Questions about revenue/accounting
      if (
        lowerPrompt.includes("revenu") ||
        lowerPrompt.includes("chiffre") ||
        lowerPrompt.includes("argent") ||
        lowerPrompt.includes("gagné") ||
        lowerPrompt.includes("earn")
      ) {
        try {
          const transactions = await storage.getTransactions();
          const models = await storage.getModeles();

          const total = transactions.reduce((sum, t) => sum + t.montant, 0);
          const thisWeek = transactions.filter((t) => {
            const tDate = new Date(t.date);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return tDate >= weekAgo;
          });
          const weekRevenue = thisWeek.reduce((sum, t) => sum + t.montant, 0);

          contextData = `\n\nDonnées de revenus:\nRevenu total: ${total.toFixed(2)}€\nRevenu de la semaine dernière: ${weekRevenue.toFixed(2)}€\nNombre de transactions: ${transactions.length}\n`;

          // Check if asking about specific model
          for (const model of models) {
            if (lowerPrompt.includes(model.nom.toLowerCase())) {
              const modelTransactions = transactions.filter(
                (t) => t.modeleId === model.id,
              );
              const modelWeekTransactions = thisWeek.filter(
                (t) => t.modeleId === model.id,
              );
              const modelTotal = modelTransactions.reduce(
                (sum, t) => sum + t.montant,
                0,
              );
              const modelWeek = modelWeekTransactions.reduce(
                (sum, t) => sum + t.montant,
                0,
              );
              contextData += `\n📊 Revenus de ${model.nom}:\n- Total: ${modelTotal.toFixed(2)}€\n- Cette semaine: ${modelWeek.toFixed(2)}€\n- Transactions: ${modelTransactions.length}`;
              break;
            }
          }
        } catch (error) {
          console.error("Error fetching transactions:", error);
        }
      }

      // Questions about team
      if (
        lowerPrompt.includes("équipe") ||
        lowerPrompt.includes("team") ||
        lowerPrompt.includes("membre")
      ) {
        try {
          const teamMembers = await storage.getEquipe();
          if (
            lowerPrompt.includes("ajouter") ||
            lowerPrompt.includes("créer")
          ) {
            contextData = `\n\nPour ajouter un membre à l'équipe:\n1. Aller dans l'onglet "Équipe"\n2. Cliquer sur "+ Ajouter un membre"\n3. Entrer le nom, le rôle personnalisé et le pourcentage de revenu\n4. Cliquer sur "Ajouter"`;
          } else {
            contextData = `\n\nMembres de l'équipe (${teamMembers.length}):\n`;
            teamMembers.forEach((member) => {
              contextData += `- ${member.nom} (${member.role}): ${member.pourcentage}% de revenu, ${member.revenus}€ générés, ${member.taches || 0} tâches\n`;
            });
          }
        } catch (error) {
          console.error("Error fetching team members:", error);
          contextData = `\n\nPour ajouter un membre à l'équipe:\n1. Aller dans l'onglet "Équipe"\n2. Cliquer sur "+ Ajouter un membre"\n3. Entrer le nom, le rôle personnalisé et le pourcentage de revenu\n4. Cliquer sur "Ajouter"`;
        }
      }
    }

    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    console.log("[AI] Sending query to GPT-5:", prompt.substring(0, 100));
    console.log("[AI] Context data length:", contextData.length);

    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant IA expert en analyse de données pour des agences OnlyFans Management (OFM). Tu fournis des insights précis et actionnables en français. Tu réponds de manière concise et claire. Quand des données sont fournies, utilise-les pour donner des réponses précises.",
        },
        {
          role: "user",
          content: prompt + contextData,
        },
      ],
      max_completion_tokens: 1000,
    });

    const response = completion.choices[0]?.message?.content;
    console.log(
      "[AI] Response received:",
      response ? response.substring(0, 100) : "EMPTY",
    );

    if (!response || response.trim() === "") {
      console.error("[AI] Empty response from OpenAI");
      return "Désolé, je n'ai pas pu générer de réponse. Pouvez-vous reformuler votre question?";
    }

    return response;
  } catch (error: any) {
    console.error("[AI] Analysis Error:", error.message || error);
    console.error("[AI] Full error:", error);
    return "Erreur lors de l'analyse IA. Veuillez réessayer.";
  }
}

export async function rankByPerformance(
  items: any[],
  metric: string,
): Promise<any[]> {
  try {
    const prompt = `Analyse ces données et classe-les par performance selon le critère "${metric}". Retourne uniquement un JSON array avec les items triés du meilleur au moins bon: ${JSON.stringify(items)}`;

    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant IA qui analyse et classe des données. Retourne uniquement du JSON valide.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2000,
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return result.items || items;
  } catch (error) {
    console.error("AI Ranking Error:", error);
    return items;
  }
}

export async function summarizeRevenue(transactions: any[]): Promise<string> {
  try {
    const prompt = `Analyse ces transactions et fournis un résumé concis des revenus: ${JSON.stringify(transactions)}. Inclus le total, la moyenne, et les tendances principales.`;

    const response = await analyzeWithAI(prompt);
    return response;
  } catch (error) {
    console.error("Revenue Summary Error:", error);
    return "Impossible de générer un résumé.";
  }
}

export async function analyzeContent(contents: any[]): Promise<any[]> {
  try {
    const prompt = `Analyse ces contenus et attribue un score de performance de 0 à 100 pour chacun: ${JSON.stringify(contents)}. Retourne un JSON avec les scores.`;

    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant IA spécialisé dans l'analyse de contenu pour réseaux sociaux. Retourne du JSON valide.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2000,
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return result.scores || contents;
  } catch (error) {
    console.error("Content Analysis Error:", error);
    return contents;
  }
}


import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResult } from "../types";

/**
 * Tenta extrair e parsear o JSON de uma string de forma segura.
 */
const parseGeminiResponse = (text: string) => {
  try {
    // Remove markdown e espaços extras
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    // Fallback: procura o primeiro { e o último }
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        throw new Error("Formato JSON inválido na resposta da IA.");
      }
    }
    throw new Error("Não foi possível localizar dados estruturados na resposta.");
  }
};

export const extractTripNumber = async (base64Pdf: string): Promise<ExtractionResult> => {
  try {
    // Inicialização direta conforme diretrizes: assume-se que process.env.API_KEY está disponível
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Pdf,
            },
          },
          {
            text: 'Extraia o NÚMERO DA VIAGEM deste documento. Retorne EXCLUSIVAMENTE um JSON no formato: {"tripNumber": "valor"}. Se não encontrar, use null.',
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tripNumber: {
              type: Type.STRING,
              description: "O número identificador da viagem.",
              nullable: true
            }
          },
          required: ["tripNumber"]
        },
        // Desativa o pensamento para maior velocidade em tarefas de extração simples
        thinkingConfig: { thinkingBudget: 0 }
      },
    });

    // Acesso direto à propriedade .text conforme diretrizes
    const responseText = response.text;
    if (!responseText) {
      throw new Error("A IA retornou uma resposta vazia.");
    }

    const data = parseGeminiResponse(responseText);
    
    if (data.tripNumber) {
      return {
        tripNumber: String(data.tripNumber).trim(),
        success: true
      };
    }

    return {
      tripNumber: null,
      success: false,
      error: "Número da viagem não localizado no arquivo."
    };

  } catch (error: any) {
    console.error("Erro no processamento Gemini:", error);
    
    // Tratamento amigável de erros de ambiente e API
    let userFriendlyError = "Erro ao analisar o documento.";
    
    if (error.message?.includes("API_KEY") || error.status === 403) {
      userFriendlyError = "Erro de autenticação: Verifique a API_KEY no Netlify.";
    } else if (error.status === 429) {
      userFriendlyError = "Limite de cota excedido. Tente novamente em instantes.";
    } else if (error.message?.includes("fetch")) {
      userFriendlyError = "Falha de conexão com o serviço de IA.";
    }

    return {
      tripNumber: null,
      success: false,
      error: userFriendlyError
    };
  }
};

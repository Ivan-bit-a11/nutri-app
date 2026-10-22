# IA opcional (gratuita) — NutriFlow

© Ivan Mbalame

Nesta versão a IA está **desactivada**. O sistema funciona sem qualquer chave.

## Se quiser activar mais tarde (opção gratuita: Groq)

1. Crie conta em https://console.groq.com (há plano gratuito com limites diários).
2. Crie uma API key.
3. No código, a rota `app/api/copilot/route.ts` teria de voltar a usar `streamText` com o SDK da Groq (ex. `@ai-sdk/openai` apontando para a base URL da Groq).
4. Variável de ambiente: `GROQ_API_KEY=...`

Alternativas com free tier: Google AI Studio (Gemini), OpenRouter (modelos free limitados).

**Não é obrigatório** para usar NutriFlow: pacientes, consultas, pagamentos e planos funcionam sem IA.

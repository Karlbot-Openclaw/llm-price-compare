export default async function handler(req, res) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
  const HF_TOKEN = process.env.HF_TOKEN;

  const results = [];

  // Fetch from OpenRouter
  if (OPENROUTER_API_KEY) {
    try {
      const orRes = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      if (orRes.ok) {
        const orData = await orRes.json();
        (orData.data || []).forEach(m => {
          const pricing = m.pricing || {};
          results.push({
            provider: 'OpenRouter',
            model: m.id || m.name,
            context_length: m.context_length || null,
            prompt_price: pricing.prompt ? parseFloat(pricing.prompt) * 1_000_000 : null,
            completion_price: pricing.completion ? parseFloat(pricing.completion) * 1_000_000 : null,
            description: m.description || ''
          });
        });
      } else {
        console.warn('OpenRouter API error:', orRes.status, await orRes.text());
      }
    } catch (e) {
      console.error('OpenRouter fetch error:', e);
    }
  }

  // Fetch from Together AI
  if (TOGETHER_API_KEY) {
    try {
      const togetherRes = await fetch('https://api.together.xyz/v1/models', {
        headers: {
          'Authorization': `Bearer ${TOGETHER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      if (togetherRes.ok) {
        const togetherData = await togetherRes.json();
        const models = togetherData.data || togetherData || [];
        models.forEach(m => {
          // Together may not return pricing; set to null if missing
          const pricing = m.pricing || {};
          results.push({
            provider: 'Together AI',
            model: m.id || m.name,
            context_length: m.max_model_len || m.context_length || null,
            prompt_price: pricing.prompt ? parseFloat(pricing.prompt) * 1_000_000 : null,
            completion_price: pricing.completion ? parseFloat(pricing.completion) * 1_000_000 : null,
            description: m.description || ''
          });
        });
      } else {
        console.warn('Together API error:', togetherRes.status, await togetherRes.text());
      }
    } catch (e) {
      console.error('Together AI fetch error:', e);
    }
  }

  // Add Hugging Face static list (popular models with approximate pricing)
  // Note: HF pricing is per-inference; we map approximate per-1M token rates based on typical provider costs.
  if (HF_TOKEN) {
    // We could optionally call HF API to list models, but pricing is not standardized; use curated list.
    const hfModels = [
      { id: 'meta-llama/Llama-3.3-70B-Instruct', context: 128000, prompt: 0.0, completion: 0.0, desc: 'Llama 3.3 70B Instruct (open weights, free on Hugging Face)' },
      { id: 'mistralai/Mistral-7B-Instruct-v0.2', context: 32768, prompt: 0.0, completion: 0.0, desc: 'Mistral 7B Instruct (open weights)' },
      { id: 'gpt2', context: 1024, prompt: 0.0, completion: 0.0, desc: 'GPT-2 (open, small)' },
      // Add more as needed
    ];
    hfModels.forEach(m => {
      results.push({
        provider: 'Hugging Face',
        model: m.id,
        context_length: m.context,
        prompt_price: m.prompt,
        completion_price: m.completion,
        description: m.desc
      });
    });
  }

  res.setHeader('Cache-Control', 's-maxage:60, stale-while-revalidate');
  return res.status(200).json({ models: results });
}

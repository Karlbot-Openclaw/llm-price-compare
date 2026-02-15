export default async function handler(req, res) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;

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
            prompt_price: pricing.prompt ? parseFloat(pricing.prompt) * 1_000_000 : null, // convert from per-token to per-1M
            completion_price: pricing.completion ? parseFloat(pricing.completion) * 1_000_000 : null,
            description: m.description || ''
          });
        });
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
        (togetherData.data || []).forEach(m => {
          const pricing = m.pricing || {};
          results.push({
            provider: 'Together AI',
            model: m.id || m.name,
            context_length: m.context_length || null,
            prompt_price: pricing.prompt ? parseFloat(pricing.prompt) * 1_000_000 : null,
            completion_price: pricing.completion ? parseFloat(pricing.completion) * 1_000_000 : null,
            description: m.description || ''
          });
        });
      }
    } catch (e) {
      console.error('Together AI fetch error:', e);
    }
  }

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  return res.status(200).json({ models: results });
}

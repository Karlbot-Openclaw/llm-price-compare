// Known mappings from OpenRouter model ID prefix to GitHub repos (for star counts)
const GITHUB_REPO_MAP = {
  // Explicit overrides
  'meta-llama/Llama-3.3-70B-Instruct': { owner: 'meta-llama', repo: 'llama' },
  'mistralai/Mistral-7B-Instruct-v0.2': { owner: 'mistralai', repo: 'mistral-src' },
  'qwen/Qwen3-Max-Thinking': { owner: 'QwenLM', repo: 'Qwen' },
  // Add more as needed
};

// Heuristic: based on provider and model ID fragments
function detectGitHubRepo(modelId, provider) {
  const id = (modelId || '').toLowerCase();
  const prov = (provider || '').toLowerCase();

  // Meta Llama
  if (prov.includes('meta-llama') || id.includes('llama')) {
    return { owner: 'meta-llama', repo: 'llama' };
  }
  // Mistral
  if (prov.includes('mistralai') || id.includes('mistral')) {
    return { owner: 'mistralai', repo: 'mistral-src' };
  }
  // Qwen
  if (prov.includes('qwen') || id.includes('qwen')) {
    return { owner: 'QwenLM', repo: 'Qwen' };
  }
  // Google? gemma, etc.
  if (prov.includes('google') || id.includes('gemma')) {
    return { owner: 'google', repo: 'gemma' };
  }
  if (prov.includes('deepseek') || id.includes('deepseek')) {
    return { owner: 'deepseek-ai', repo: 'DeepSeek-V3' }; // not sure, approximate
  }
  // Add more patterns as needed
  return null;
}

// Groq model pricing (per 1M tokens) – approximate based on public rates
const GROQ_PRICING = {
  'llama2-70b-4096': { prompt: 0.10, completion: 0.10 }, // example; update with actual
  'mixtral-8x7b-32768': { prompt: 0.10, completion: 0.10 },
  'gemma2-9b-it': { prompt: 0.10, completion: 0.10 },
  // default fallback
  'default': { prompt: null, completion: null }
};

function getGroqPricing(modelId) {
  const key = modelId?.split(':')[0] || modelId; // e.g., "llama2-70b-4096"
  return GROQ_PRICING[key] || GROQ_PRICING['default'];
}

export default async function handler(req, res) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
  const HF_TOKEN = process.env.HF_TOKEN;
  const GITHUB_PAT = process.env.GITHUB_PAT;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

  const results = [];

  async function fetchGitHubStars(owner, repo) {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}`;
      const headers = { 'Accept': 'application/vnd.github+json' };
      if (GITHUB_PAT) {
        headers['Authorization'] = `Bearer ${GITHUB_PAT}`;
      }
      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = await response.json();
        return data.stargazers_count || 0;
      } else {
        console.warn(`GitHub stars fetch failed for ${owner}/${repo}: ${response.status}`);
      }
    } catch (e) {
      console.error(`GitHub stars fetch error for ${owner}/${repo}:`, e.message);
    }
    return null;
  }

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
        const models = orData.data || [];
        const promises = models.map(async (m) => {
          const pricing = m.pricing || {};
          let stars = null;
          let hfLikes = null;
          const modelId = m.id || m.name;

          // Determine GitHub repo
          let ghRepo = GITHUB_REPO_MAP[modelId];
          if (!ghRepo) {
            ghRepo = detectGitHubRepo(modelId, m.id?.split('/')[0] || '');
          }
          if (ghRepo) {
            stars = await fetchGitHubStars(ghRepo.owner, ghRepo.repo);
          }

          // Hugging Face likes if there's a HF ID
          const hfId = m.hugging_face_id;
          if (hfId && HF_TOKEN) {
            try {
              const hfRes = await fetch(`https://huggingface.co/api/models/${hfId}`, {
                headers: { 'Authorization': `Bearer ${HF_TOKEN}` }
              });
              if (hfRes.ok) {
                const hfData = await hfRes.json();
                hfLikes = hfData.likes || 0;
              }
            } catch (e) {
              console.error(`HF likes fetch error for ${hfId}:`, e.message);
            }
          }

          return {
            provider: 'OpenRouter',
            model: modelId,
            context_length: m.context_length || null,
            prompt_price: pricing.prompt ? parseFloat(pricing.prompt) * 1_000_000 : null,
            completion_price: pricing.completion ? parseFloat(pricing.completion) * 1_000_000 : null,
            description: m.description || '',
            stars,
            hf_likes: hfLikes
          };
        });
        const orResults = await Promise.all(promises);
        results.push(...orResults);
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
          const pricing = m.pricing || {};
          results.push({
            provider: 'Together AI',
            model: m.id || m.name,
            context_length: m.max_model_len || m.context_length || null,
            prompt_price: pricing.prompt ? parseFloat(pricing.prompt) * 1_000_000 : null,
            completion_price: pricing.completion ? parseFloat(pricing.completion) * 1_000_000 : null,
            description: m.description || '',
            stars: null,
            hf_likes: null
          });
        });
      } else {
        console.warn('Together API error:', togetherRes.status, await togetherRes.text());
      }
    } catch (e) {
      console.error('Together AI fetch error:', e);
    }
  }

  // Fetch from Groq
  if (GROQ_API_KEY) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      if (groqRes.ok) {
        const groqData = await groqRes.json();
        const models = groqData.data || [];
        models.forEach(m => {
          const pricing = getGroqPricing(m.id);
          results.push({
            provider: 'Groq',
            model: m.id,
            context_length: m.context_length || null,
            prompt_price: pricing.prompt,
            completion_price: pricing.completion,
            description: m.description || '',
            stars: null,
            hf_likes: null
          });
        });
      } else {
        console.warn('Groq API error:', groqRes.status, await groqRes.text());
      }
    } catch (e) {
      console.error('Groq fetch error:', e);
    }
  }

  // Fetch from Replicate
  if (REPLICATE_API_TOKEN) {
    try {
      const replicateRes = await fetch('https://api.replicate.com/v1/models', {
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      if (replicateRes.ok) {
        const repData = await replicateRes.json();
        const models = repData.results || [];
        models.forEach(m => {
          // Replicate pricing is per second; no token pricing in this endpoint.
          // We'll leave prices null for now, could calculate from version hardware config later.
          results.push({
            provider: 'Replicate',
            model: `${m.owner?.username}/${m.name}`,
            context_length: null,
            prompt_price: null,
            completion_price: null,
            description: m.description || '',
            stars: null,
            hf_likes: null
          });
        });
      } else {
        console.warn('Replicate API error:', replicateRes.status, await replicateRes.text());
      }
    } catch (e) {
      console.error('Replicate fetch error:', e);
    }
  }

  // Add Hugging Face static list (with likes if token available)
  if (HF_TOKEN) {
    const hfModels = [
      { id: 'meta-llama/Llama-3.3-70B-Instruct', context: 128000, prompt: 0.0, completion: 0.0, desc: 'Llama 3.3 70B Instruct (open weights, free on Hugging Face)' },
      { id: 'mistralai/Mistral-7B-Instruct-v0.2', context: 32768, prompt: 0.0, completion: 0.0, desc: 'Mistral 7B Instruct (open weights)' },
      { id: 'gpt2', context: 1024, prompt: 0.0, completion: 0.0, desc: 'GPT-2 (open, small)' },
    ];
    for (const m of hfModels) {
      let hfLikes = null;
      try {
        const hfRes = await fetch(`https://huggingface.co/api/models/${m.id}`, {
          headers: { 'Authorization': `Bearer ${HF_TOKEN}` }
        });
        if (hfRes.ok) {
          const hfData = await hfRes.json();
          hfLikes = hfData.likes || 0;
        }
      } catch (e) {
        console.error(`HF likes fetch error for ${m.id}:`, e.message);
      }
      results.push({
        provider: 'Hugging Face',
        model: m.id,
        context_length: m.context,
        prompt_price: m.prompt,
        completion_price: m.completion,
        description: m.desc,
        stars: null,
        hf_likes: hfLikes
      });
    }
  }

  res.setHeader('Cache-Control', 's-maxage:60, stale-while-revalidate');
  return res.status(200).json({ models: results });
}

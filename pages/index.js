import { useEffect, useState } from 'react';

type Model = {
  provider: string;
  model: string;
  context_length: number | null;
  prompt_price: number | null;
  completion_price: number | null;
  description: string;
};

export default function Home() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<keyof Model>('model');
  const [sortAsc, setSortAsc] = useState(true);
  const [freeOnly, setFreeOnly] = useState(false);

  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        setModels(data.models || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch models:', err);
        setLoading(false);
      });
  }, []);

  const sorted = [...models]
    .filter(m => !freeOnly || (m.prompt_price === 0 && m.completion_price === 0))
    .sort((a, b) => {
      const aVal = a[sortKey] == null ? 0 : a[sortKey];
      const bVal = b[sortKey] == null ? 0 : b[sortKey];
      if (typeof aVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

  const handleSort = (key: keyof Model) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">LLM Price Comparison</h1>
      <div className="mb-4 flex items-center gap-4">
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            checked={freeOnly}
            onChange={e => setFreeOnly(e.target.checked)}
            className="form-checkbox h-5 w-5 text-blue-600"
          />
          <span className="ml-2 text-gray-700">Show free models only</span>
        </label>
        <span className="text-sm text-gray-500">
          {loading ? 'Loading...' : `${sorted.length} models`}
        </span>
      </div>
      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('provider')}>Provider {sortKey==='provider'?(sortAsc?'↑':'↓'):''}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('model')}>Model {sortKey==='model'?(sortAsc?'↑':'↓'):''}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('context_length')}>Context {sortKey==='context_length'?(sortAsc?'↑':'↓'):''}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('prompt_price')}>Prompt $/1M {sortKey==='prompt_price'?(sortAsc?'↑':'↓'):''}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('completion_price')}>Completion $/1M {sortKey==='completion_price'?(sortAsc?'↑':'↓'):''}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sorted.map((m, i) => (
              <tr key={i}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{m.provider}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{m.model}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.context_length?.toLocaleString() || '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.prompt_price != null ? `$${m.prompt_price.toFixed(4)}` : '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.completion_price != null ? `$${m.completion_price.toFixed(4)}` : '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate" title={m.description}>{m.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

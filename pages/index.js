import { useEffect, useState } from 'react';

export default function Home() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sortKey, setSortKey] = useState('model');
  const [sortAsc, setSortAsc] = useState(true);
  const [freeOnly, setFreeOnly] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);

  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        setModels(data.models || []);
        setLastUpdated(new Date().toLocaleString());
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
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? aVal - bVal : bVal - aVal;
    });

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const openModal = (model) => setSelectedModel(model);
  const closeModal = () => setSelectedModel(null);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">LLM Price Comparison</h1>
      <p className="text-sm text-gray-500 mb-4">Last updated: {lastUpdated || '…'}</p>

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
              <tr key={i} onClick={() => openModal(m)} className="cursor-pointer hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{m.provider}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {m.prompt_price === 0 && m.completion_price === 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mr-2">Free</span>
                  )}
                  {m.model}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.context_length?.toLocaleString() || '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.prompt_price != null ? `$${m.prompt_price.toFixed(4)}` : '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.completion_price != null ? `$${m.completion_price.toFixed(4)}` : '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate" title={m.description}>{m.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedModel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-2">{selectedModel.provider} — {selectedModel.model}</h2>
            <p className="text-gray-600 mb-1">Context: {selectedModel.context_length?.toLocaleString() || '—'}</p>
            <p className="text-gray-600 mb-1">Prompt: ${selectedModel.prompt_price != null ? selectedModel.prompt_price.toFixed(4) : '—'} / 1M tokens</p>
            <p className="text-gray-600 mb-4">Completion: ${selectedModel.completion_price != null ? selectedModel.completion_price.toFixed(4) : '—'} / 1M tokens</p>
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-gray-700 whitespace-pre-line">{selectedModel.description || 'No description provided.'}</p>
            </div>
            <button onClick={closeModal} className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';

const PROVIDER_LABELS = {
  apollo:      'Apollo',
  hunter:      'Hunter.io',
  rocketreach: 'RocketReach',
  instantly:   'Instantly',
  lemlist:     'Lemlist',
  clay:        'Clay',
  serper:      'Serper (Google)',
  arkai:       'ARK AI',
  webscrape:   'Web Scrape',
};

export default function BatchSelector({ missingEmails, providers, onSelect }) {
  // Initialize all configured providers as selected
  const [selectedProviders, setSelectedProviders] = useState(
    () => (providers || []).filter((p) => p.configured).map((p) => p.name)
  );

  const toggleProvider = (name) => {
    setSelectedProviders((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const selectAll = () => {
    setSelectedProviders((providers || []).filter((p) => p.configured).map((p) => p.name));
  };

  const selectNone = () => {
    setSelectedProviders([]);
  };

  const handleStart = (batchSize) => {
    if (selectedProviders.length === 0) return;
    onSelect(batchSize, selectedProviders);
  };

  const batchOptions = [10, 25, 50, 100].filter((n) => n < missingEmails);
  const configuredProviders = (providers || []).filter((p) => p.configured);
  const unconfiguredProviders = (providers || []).filter((p) => !p.configured);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-5">
      {/* Provider Selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">
            Select Enrichment Providers
          </h3>
          <div className="flex gap-2 text-xs">
            <button
              onClick={selectAll}
              className="text-blue-600 hover:text-blue-800"
            >
              Select all
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={selectNone}
              className="text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {configuredProviders.map((provider) => {
            const isSelected = selectedProviders.includes(provider.name);
            return (
              <button
                key={provider.name}
                onClick={() => toggleProvider(provider.name)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                }`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                }`}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                {PROVIDER_LABELS[provider.name] || provider.name}
              </button>
            );
          })}

          {unconfiguredProviders.map((provider) => (
            <div
              key={provider.name}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-100 bg-gray-50 text-sm text-gray-400 cursor-not-allowed"
              title="API key not configured"
            >
              <span className="w-4 h-4 rounded border border-gray-200 bg-gray-100 flex-shrink-0" />
              {PROVIDER_LABELS[provider.name] || provider.name}
              <span className="text-[10px] ml-auto">no key</span>
            </div>
          ))}
        </div>
      </div>

      {/* Batch Size Selection */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-2">
          How many rows to enrich?
        </h3>
        <p className="text-sm text-gray-500 mb-3">
          {missingEmails} rows have missing emails. Choose how many to enrich now.
        </p>
        <div className="flex flex-wrap gap-3">
          {batchOptions.map((n) => (
            <button
              key={n}
              onClick={() => handleStart(n)}
              disabled={selectedProviders.length === 0}
              className={`px-5 py-2.5 rounded-lg border font-medium transition-colors ${
                selectedProviders.length === 0
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700'
              }`}
            >
              First {n}
            </button>
          ))}
          <button
            onClick={() => handleStart('all')}
            disabled={selectedProviders.length === 0}
            className={`px-5 py-2.5 rounded-lg font-medium transition-colors ${
              selectedProviders.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            All {missingEmails}
          </button>
        </div>
        {selectedProviders.length === 0 && (
          <p className="text-xs text-red-500 mt-2">
            Please select at least one provider to start enrichment.
          </p>
        )}
      </div>
    </div>
  );
}

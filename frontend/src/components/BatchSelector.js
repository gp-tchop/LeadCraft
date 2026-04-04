export default function BatchSelector({ missingEmails, onSelect }) {
  const options = [10, 25, 50, 100].filter((n) => n < missingEmails);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 className="font-semibold text-gray-800 mb-2">
        How many rows do you want to enrich?
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        {missingEmails} rows have missing emails. Choose how many to enrich now.
      </p>
      <div className="flex flex-wrap gap-3">
        {options.map((n) => (
          <button
            key={n}
            onClick={() => onSelect(n)}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-colors"
          >
            First {n}
          </button>
        ))}
        <button
          onClick={() => onSelect('all')}
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          All {missingEmails}
        </button>
      </div>
    </div>
  );
}

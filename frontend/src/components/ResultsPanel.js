export default function ResultsPanel({ result, preview, onDownload, onReset }) {
  if (!result) return null;

  const successRate = result.needEnrichment > 0
    ? Math.round((result.enriched / result.needEnrichment) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Dashboard */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 text-lg mb-4">
          Enrichment Complete
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <StatBox label="Total Rows" value={result.totalRows} color="text-gray-800" />
          <StatBox label="Unchanged" value={result.unchanged} color="text-gray-500" />
          <StatBox label="Enriched" value={result.enriched} color="text-green-600" />
          <StatBox label="Not Found" value={result.failed} color="text-red-500" />
          <StatBox label="Success Rate" value={`${successRate}%`} color="text-blue-600" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onDownload}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          Download Enriched CSV
        </button>
        <button
          onClick={onReset}
          className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Upload Another
        </button>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div>
      <p className="text-gray-500 text-sm">{label}</p>
      <p className={`font-bold text-xl ${color}`}>{value}</p>
    </div>
  );
}

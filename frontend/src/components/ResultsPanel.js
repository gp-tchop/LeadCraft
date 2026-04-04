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

      {/* Preview of enriched rows */}
      {preview && preview.enrichedRows && preview.enrichedRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">
            Enriched Rows Preview
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 font-medium text-gray-600">Row #</th>
                  <th className="px-4 py-2 font-medium text-gray-600">Email Found</th>
                  <th className="px-4 py-2 font-medium text-gray-600">Provider</th>
                  <th className="px-4 py-2 font-medium text-gray-600">Confidence</th>
                  <th className="px-4 py-2 font-medium text-gray-600">Verified</th>
                </tr>
              </thead>
              <tbody>
                {preview.enrichedRows.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-600">{row.rowIndex + 1}</td>
                    <td className="px-4 py-2 font-mono text-gray-800">{row.email}</td>
                    <td className="px-4 py-2">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {row.provider}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <ConfidenceBadge level={row.confidence} />
                    </td>
                    <td className="px-4 py-2">
                      {row.verified ? (
                        <span className="text-green-600 text-xs font-medium">Yes</span>
                      ) : (
                        <span className="text-gray-400 text-xs">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.enrichedRows.length > 50 && (
              <p className="text-sm text-gray-400 mt-2 text-center">
                Showing first 50 of {preview.enrichedRows.length} enriched rows
              </p>
            )}
          </div>
        </div>
      )}

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

function ConfidenceBadge({ level }) {
  const styles = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-red-100 text-red-700',
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
        styles[level] || 'bg-gray-100 text-gray-600'
      }`}
    >
      {level || 'unknown'}
    </span>
  );
}

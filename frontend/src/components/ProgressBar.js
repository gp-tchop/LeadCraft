export default function ProgressBar({ progress }) {
  if (!progress) return null;

  const { phase, total, needEnrichment, processed, enriched, failed } = progress;

  if (phase === 'complete') return null;

  const percent = needEnrichment > 0
    ? Math.round((processed / needEnrichment) * 100)
    : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-gray-800">Enriching Emails...</h3>
        <span className="text-sm text-gray-500">{percent}%</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
        <div
          className="bg-blue-600 h-3 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-4 text-center text-sm">
        <div>
          <p className="text-gray-500">Total Rows</p>
          <p className="font-semibold text-gray-800">{total || 0}</p>
        </div>
        <div>
          <p className="text-gray-500">Need Enrichment</p>
          <p className="font-semibold text-amber-600">{needEnrichment || 0}</p>
        </div>
        <div>
          <p className="text-gray-500">Found</p>
          <p className="font-semibold text-green-600">{enriched || 0}</p>
        </div>
        <div>
          <p className="text-gray-500">Not Found</p>
          <p className="font-semibold text-red-500">{failed || 0}</p>
        </div>
      </div>
    </div>
  );
}

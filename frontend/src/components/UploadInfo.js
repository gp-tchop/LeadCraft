export default function UploadInfo({ info, liveResults }) {
  if (!info) return null;

  // Build a map of rowIndex -> enrichment result for live updates
  const enrichedMap = {};
  if (liveResults) {
    liveResults.forEach((entry) => {
      if (entry.status === 'enriched' && entry.email) {
        enrichedMap[entry.rowIndex] = entry;
      }
    });
  }

  // Also build not_found/error map
  const failedMap = {};
  if (liveResults) {
    liveResults.forEach((entry) => {
      if (entry.status === 'not_found' || entry.status === 'error') {
        failedMap[entry.rowIndex] = true;
      }
    });
  }

  const emailColumn = info.emailColumn;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 className="font-semibold text-gray-800 mb-3">File Uploaded</h3>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Total Rows</p>
          <p className="font-semibold">{info.totalRows}</p>
        </div>
        <div>
          <p className="text-gray-500">Missing Emails</p>
          <p className="font-semibold text-amber-600">{info.missingEmails}</p>
        </div>
        <div>
          <p className="text-gray-500">Email Column</p>
          <p className="font-semibold font-mono">{info.emailColumn}</p>
        </div>
      </div>

      {info.preview && info.preview.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-500 mb-2">
            All {info.preview.length} rows with missing emails:
          </p>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-1.5 font-medium text-gray-600 whitespace-nowrap">
                    Row #
                  </th>
                  {info.headers.map((h) => (
                    <th key={h} className={`px-3 py-1.5 font-medium whitespace-nowrap ${
                      h === emailColumn ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
                    }`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {info.preview.map((row, i) => {
                  const rowIndex = row.__rowIndex != null ? row.__rowIndex : i;
                  const enriched = enrichedMap[rowIndex];
                  const notFound = failedMap[rowIndex];

                  return (
                    <tr key={i} className={`border-t border-gray-100 ${
                      enriched ? 'bg-green-50' : notFound ? 'bg-red-50/30' : ''
                    }`}>
                      <td className="px-3 py-1.5 text-gray-500 font-mono">
                        {rowIndex + 1}
                      </td>
                      {info.headers.map((h) => {
                        const isEmailCol = h === emailColumn;
                        const cellValue = row[h];

                        if (isEmailCol && enriched) {
                          return (
                            <td key={h} className="px-3 py-1.5 whitespace-nowrap">
                              <span className="text-green-700 font-semibold font-mono">
                                {enriched.email}
                              </span>
                              <span className="ml-1 text-green-500 text-[10px]">
                                ({enriched.provider})
                              </span>
                            </td>
                          );
                        }

                        if (isEmailCol && notFound) {
                          return (
                            <td key={h} className="px-3 py-1.5 whitespace-nowrap">
                              <span className="text-red-400 italic text-[10px]">not found</span>
                            </td>
                          );
                        }

                        if (isEmailCol && !cellValue) {
                          return (
                            <td key={h} className="px-3 py-1.5 whitespace-nowrap">
                              <span className="text-gray-300 italic">pending...</span>
                            </td>
                          );
                        }

                        return (
                          <td key={h} className="px-3 py-1.5 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                            {cellValue || <span className="text-gray-300">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

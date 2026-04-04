export default function UploadInfo({ info }) {
  if (!info) return null;

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
          <p className="text-sm text-gray-500 mb-2">Preview (first {info.preview.length} rows):</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50">
                <tr>
                  {info.headers.map((h) => (
                    <th key={h} className="px-3 py-1.5 font-medium text-gray-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {info.preview.map((row, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    {info.headers.map((h) => (
                      <td key={h} className="px-3 py-1.5 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                        {row[h] || <span className="text-red-400 italic">empty</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

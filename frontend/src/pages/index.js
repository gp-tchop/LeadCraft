import Head from 'next/head';
import FileUpload from '../components/FileUpload';
import UploadInfo from '../components/UploadInfo';
import ProgressBar from '../components/ProgressBar';
import ResultsPanel from '../components/ResultsPanel';
import useEnrichment from '../hooks/useEnrichment';

export default function Home() {
  const {
    state,
    uploadInfo,
    progress,
    result,
    preview,
    error,
    uploadFile,
    downloadFile,
    reset,
  } = useEnrichment();

  return (
    <>
      <Head>
        <title>LeadCraft - Email Enrichment</title>
        <meta name="description" content="Upload a CSV and enrich missing email addresses using multiple data sources." />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">LeadCraft</h1>
              <p className="text-sm text-gray-500">Automated Email Enrichment</p>
            </div>
            {state !== 'idle' && (
              <button
                onClick={reset}
                className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                Start Over
              </button>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-6 py-10">
          <div className="space-y-6">
            {/* Upload Area */}
            {state === 'idle' && (
              <div className="space-y-4">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    Enrich Your Contact List
                  </h2>
                  <p className="text-gray-500 max-w-lg mx-auto">
                    Upload a CSV file with contact data. LeadCraft will find missing email
                    addresses using Apollo, Hunter.io, RocketReach, Clay, and web scraping.
                  </p>
                </div>
                <FileUpload onFileSelected={uploadFile} disabled={false} />
                <div className="text-center text-xs text-gray-400 space-y-1">
                  <p>Supported: CSV files up to 50MB</p>
                  <p>Your CSV must have an &quot;email&quot; column and name/company columns</p>
                </div>
              </div>
            )}

            {/* Uploading State */}
            {state === 'uploading' && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Uploading and analyzing your file...</p>
              </div>
            )}

            {/* Upload Info */}
            {(state === 'processing' || state === 'complete') && (
              <UploadInfo info={uploadInfo} />
            )}

            {/* Progress */}
            {state === 'processing' && <ProgressBar progress={progress} />}

            {/* Results */}
            {state === 'complete' && (
              <ResultsPanel
                result={result}
                preview={preview}
                onDownload={downloadFile}
                onReset={reset}
              />
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <h3 className="font-semibold text-red-800 mb-1">Error</h3>
                <p className="text-red-600 text-sm">{error}</p>
                <button
                  onClick={reset}
                  className="mt-3 text-sm text-red-700 hover:text-red-900 underline"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 mt-20">
          <div className="max-w-4xl mx-auto px-6 py-4 text-center text-xs text-gray-400">
            LeadCraft &mdash; GDPR-compliant email enrichment. Uploaded data is not stored permanently.
          </div>
        </footer>
      </div>
    </>
  );
}

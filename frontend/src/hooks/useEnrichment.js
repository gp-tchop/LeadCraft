import { useState, useRef, useCallback } from 'react';
import axios from 'axios';

const POLL_INTERVAL = 2000;

export default function useEnrichment() {
  const [state, setState] = useState('idle'); // idle | uploading | processing | complete | error
  const [jobId, setJobId] = useState(null);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [liveResults, setLiveResults] = useState([]);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollJobStatus = useCallback((id) => {
    pollRef.current = setInterval(async () => {
      try {
        const resp = await axios.get(`/api/jobs/${id}/status`);
        const data = resp.data;

        setProgress(data.progress);

        // Update live results from enrichmentLog
        if (data.enrichmentLog) {
          setLiveResults(data.enrichmentLog);
        }

        if (data.state === 'completed') {
          stopPolling();
          setResult(data.result);
          setState('complete');

          // Set final enrichment log as live results
          if (data.result?.enrichmentLog) {
            setLiveResults(data.result.enrichmentLog);
          }

          // Fetch preview of enriched rows
          try {
            const previewResp = await axios.get(`/api/jobs/${id}/preview`);
            setPreview(previewResp.data);
          } catch {
            // Preview is optional
          }
        } else if (data.state === 'failed') {
          stopPolling();
          setError(data.error || 'Enrichment job failed');
          setState('error');
        }
      } catch (err) {
        // Don't stop polling on transient network errors
        console.error('Poll error:', err.message);
      }
    }, POLL_INTERVAL);
  }, [stopPolling]);

  const uploadFile = useCallback(async (file) => {
    setState('uploading');
    setError(null);
    setResult(null);
    setPreview(null);
    setProgress(null);
    setLiveResults([]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const resp = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data = resp.data;
      setJobId(data.jobId);
      setUploadInfo(data);
      setState('processing');

      // Start polling for progress
      pollJobStatus(data.jobId);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Upload failed';
      setError(msg);
      setState('error');
    }
  }, [pollJobStatus]);

  const downloadFile = useCallback(async () => {
    if (!jobId) return;
    try {
      const resp = await axios.get(`/api/jobs/${jobId}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'enriched_contacts.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Download failed. Please try again.');
    }
  }, [jobId]);

  const reset = useCallback(() => {
    stopPolling();
    setState('idle');
    setJobId(null);
    setUploadInfo(null);
    setProgress(null);
    setResult(null);
    setPreview(null);
    setLiveResults([]);
    setError(null);
  }, [stopPolling]);

  return {
    state,
    jobId,
    uploadInfo,
    progress,
    result,
    preview,
    liveResults,
    error,
    uploadFile,
    downloadFile,
    reset,
  };
}

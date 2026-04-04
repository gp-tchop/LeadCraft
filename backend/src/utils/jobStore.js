/**
 * In-memory job store — replaces BullMQ/Redis for simple setups.
 * Jobs are stored in a Map and processed directly.
 */
const jobs = new Map();

function createJob(id, data) {
  const job = {
    id,
    data,
    state: 'waiting',
    progress: {},
    returnvalue: null,
    failedReason: null,
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

function getJob(id) {
  return jobs.get(id) || null;
}

function updateJob(id, updates) {
  const job = jobs.get(id);
  if (job) {
    Object.assign(job, updates);
  }
}

// Auto-cleanup jobs older than 1 hour
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) {
      jobs.delete(id);
    }
  }
}, 5 * 60 * 1000);

module.exports = { createJob, getJob, updateJob };

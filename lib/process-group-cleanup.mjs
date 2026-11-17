function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function probeProcessGroup(groupId) {
  if (!groupId) return false;
  if (!Number.isInteger(groupId) || groupId <= 1) return null;
  try {
    process.kill(-groupId, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    if (error?.code === 'EPERM') return true;
    return null;
  }
}

export async function cleanupProcessGroup(groupId, {
  gracefulMs = 3000,
  forceMs = 2000,
  pollMs = 50,
  probe = probeProcessGroup,
  signal = (id, value) => process.kill(-id, value),
} = {}) {
  if (!groupId) {
    return {
      groupPresentAtCleanupStart: false,
      groupAbsentAfterCleanup: true,
      groupClosedConfirmed: true,
      forcedCleanup: false,
    };
  }
  if (!Number.isInteger(groupId) || groupId <= 1) {
    return {
      groupPresentAtCleanupStart: null,
      groupAbsentAfterCleanup: false,
      groupClosedConfirmed: false,
      forcedCleanup: false,
    };
  }

  const groupPresentAtCleanupStart = probe(groupId);
  let forcedCleanup = false;
  const waitUntilAbsent = async (timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      if (probe(groupId) === false) return true;
      if (Date.now() >= deadline) return false;
      await sleep(Math.min(pollMs, Math.max(1, deadline - Date.now())));
    }
  };

  if (groupPresentAtCleanupStart !== false) {
    try { signal(groupId, 'SIGTERM'); } catch (error) {
      if (error?.code !== 'ESRCH') {
        // Keep probing; an independently exiting group may still close cleanly.
      }
    }
    if (!(await waitUntilAbsent(gracefulMs))) {
      if (probe(groupId) !== false) {
        forcedCleanup = true;
        try { signal(groupId, 'SIGKILL'); } catch (error) {
          if (error?.code !== 'ESRCH') {
            // Final probe below determines whether closure can be confirmed.
          }
        }
      }
      await waitUntilAbsent(forceMs);
    }
  }

  const groupAbsentAfterCleanup = probe(groupId) === false;
  return {
    groupPresentAtCleanupStart,
    groupAbsentAfterCleanup,
    groupClosedConfirmed: groupAbsentAfterCleanup,
    forcedCleanup,
  };
}

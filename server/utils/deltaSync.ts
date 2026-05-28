/**
 * A simple delta-sync utility that computes a shallow diff for objects,
 * or falls back to full state replacement for complex types.
 * For Phase 2, this provides a foundation for reducing payload size.
 */
export function computeDelta(oldState: any, newState: any): any {
    if (oldState === null || typeof oldState !== 'object') {
        return newState; // Cannot compute delta
    }

    const delta: any = {};
    let hasChanges = false;

    for (const key in newState) {
        if (JSON.stringify(oldState[key]) !== JSON.stringify(newState[key])) {
            delta[key] = newState[key];
            hasChanges = true;
        }
    }

    return hasChanges ? delta : null;
}

export function applyDelta(oldState: any, delta: any): any {
    if (!delta) return oldState;
    if (typeof delta !== 'object') return delta;

    return {
        ...oldState,
        ...delta
    };
}

export async function runConfirmedAction(
  confirmAction: (message: string) => boolean,
  message: string,
  action: () => Promise<void>,
): Promise<'cancelled' | 'completed'> {
  if (!confirmAction(message)) {
    return 'cancelled'
  }

  await action()
  return 'completed'
}

export async function runSingleFlightAction<T>(
  startedRef: { current: boolean },
  action: () => Promise<T>,
): Promise<T | 'ignored'> {
  if (startedRef.current) return 'ignored'

  startedRef.current = true
  try {
    return await action()
  } finally {
    startedRef.current = false
  }
}

export function restoreActionFocus(
  target: { focus: () => void } | null,
  schedule: (callback: () => void) => void = requestAnimationFrame,
): void {
  schedule(() => target?.focus())
}

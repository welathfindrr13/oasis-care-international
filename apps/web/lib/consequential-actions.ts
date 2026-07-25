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

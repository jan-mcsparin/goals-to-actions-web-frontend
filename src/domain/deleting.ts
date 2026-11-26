// What each delete asks (spec 038): it names the thing and says what goes with it. Only a goal,
// where the most goes, says there's no undo. Never worded like Drop, which is a decision.

export const DELETE_FAILED = "Couldn't delete that. Try again."

export const REMOVE_FAILED = "Couldn't remove that. Try again."

// Remove is a drop (spec 082): a decision kept in history, worded apart from Delete.
export function removeTaskLine(title: string): string {
  return `Remove “${title}”? It's not done, and nothing counts against you.`
}

export function deleteTaskLine(title: string): string {
  return `Delete “${title}”? It goes as if it was never made.`
}

// A one-off goal's milestones are its steps.
export function deleteMilestoneLine(noun: 'milestone' | 'step'): string {
  return `Delete this ${noun}? Its check-ins go with it.`
}

export function deleteGoalLine(title: string): string {
  return `Delete “${title}”? Its tasks, milestones and check-ins go with it. There's no undo.`
}

export function deleteAspirationLine(name: string): string {
  return `Delete “${name}”? Its goals and recurring items stay, with no aspiration.`
}

export function deleteRecurringLine(name: string): string {
  return `Delete “${name}”? Its open tasks go with it; the ones done stay in your history.`
}

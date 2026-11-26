import { describe, expect, it } from 'vitest'
import {
  DELETE_FAILED,
  deleteAspirationLine,
  deleteGoalLine,
  deleteMilestoneLine,
  deleteRecurringLine,
  deleteTaskLine,
  removeTaskLine,
} from './deleting.ts'

describe('what each delete asks', () => {
  it('names the task and says it goes as if never made', () => {
    expect(deleteTaskLine('Pay rent')).toBe('Delete “Pay rent”? It goes as if it was never made.')
  })

  it('says a milestone or a step takes its check-ins', () => {
    expect(deleteMilestoneLine('milestone')).toBe('Delete this milestone? Its check-ins go with it.')
    expect(deleteMilestoneLine('step')).toBe('Delete this step? Its check-ins go with it.')
  })

  it('says only a goal has no undo', () => {
    expect(deleteGoalLine('Be strong')).toBe(
      "Delete “Be strong”? Its tasks, milestones and check-ins go with it. There's no undo.",
    )
  })

  it("says an aspiration's goals and items stay", () => {
    expect(deleteAspirationLine('Be fit')).toBe('Delete “Be fit”? Its goals and recurring items stay, with no aspiration.')
  })

  it("says a recurring item's done tasks stay in history", () => {
    expect(deleteRecurringLine('Laundry')).toBe(
      'Delete “Laundry”? Its open tasks go with it; the ones done stay in your history.',
    )
  })

  it('has one failure message', () => {
    expect(DELETE_FAILED).toBe("Couldn't delete that. Try again.")
  })
})

describe('what Remove asks', () => {
  it('names the task and says nothing counts against you, never worded like Delete', () => {
    expect(removeTaskLine('Dentist cleaning')).toBe("Remove “Dentist cleaning”? It's not done, and nothing counts against you.")
  })
})

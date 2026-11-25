// Saves that show at once and wait for the server, without the queue (ADR-010
// queues only the plan's changes). Every save that fails says so. Once none
// are left on their way, a failure has the screen read its record again from
// the API, so it ends on what the server has rather than on a guess at what to
// put back. A save that starts while that read is on its way has it read once
// more when the saves are done, so the read can't wipe the save from the screen.
import { useRef, type Dispatch, type SetStateAction } from 'react'

export const SAVE_FAILED = "Couldn't save that. Try again."

// Returns `track`: hand it each save as it starts.
export function useSavesOnTheirWay(
  reload: () => Promise<void>,
  setMessage: Dispatch<SetStateAction<string | undefined>>,
): (save: Promise<unknown>) => void {
  const onTheirWay = useRef(0)
  const reloadDue = useRef(false)
  const reloading = useRef(false)

  function settled() {
    onTheirWay.current -= 1
    if (onTheirWay.current > 0 || !reloadDue.current) return
    reloadDue.current = false
    reloading.current = true
    void reload().finally(() => {
      reloading.current = false
    })
  }

  return function track(save: Promise<unknown>) {
    onTheirWay.current += 1
    if (reloading.current) reloadDue.current = true
    setMessage(undefined)
    save.then(settled, () => {
      reloadDue.current = true
      setMessage(SAVE_FAILED)
      settled()
    })
  }
}

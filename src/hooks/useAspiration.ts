// One aspiration's page, ready to render. Loads through the API client; the
// layout comes from domain/aspiration.ts. An aspiration that isn't there is
// reported as not found, so the screen can go back quietly.
import { useEffect, useState } from 'react'
import { getAspiration, NotFoundError } from '../api/client.ts'
import type { AspirationDetail } from '../api/types.ts'
import { aspirationPage, type AspirationPage } from '../domain/aspiration.ts'

const LOAD_FAILED = "Couldn't load this aspiration. Try again in a moment."

export type UseAspiration = {
  page?: AspirationPage
  message?: string
  notFound: boolean
}

export function useAspiration(aspirationId: string, today: string): UseAspiration {
  const [detail, setDetail] = useState<AspirationDetail>()
  const [message, setMessage] = useState<string>()
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let current = true
    getAspiration(aspirationId)
      .then((loaded) => current && setDetail(loaded))
      .catch((error: unknown) => {
        if (!current) return
        if (error instanceof NotFoundError) setNotFound(true)
        else setMessage(LOAD_FAILED)
      })
    return () => {
      current = false
    }
  }, [aspirationId])

  return { page: detail && aspirationPage(detail, today), message, notFound }
}

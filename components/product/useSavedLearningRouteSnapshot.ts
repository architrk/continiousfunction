import { useEffect, useState } from 'react'
import {
  getSavedLearningRouteSnapshot,
  learningRouteSnapshotEventName,
  type LearningRouteSnapshot,
} from '@/lib/learningRouteSnapshot'

export function useSavedLearningRouteSnapshot() {
  const [snapshot, setSnapshot] = useState<LearningRouteSnapshot | null>(null)

  useEffect(() => {
    const refreshSnapshot = () => {
      setSnapshot(getSavedLearningRouteSnapshot())
    }

    refreshSnapshot()
    window.addEventListener('storage', refreshSnapshot)
    window.addEventListener(learningRouteSnapshotEventName, refreshSnapshot)

    return () => {
      window.removeEventListener('storage', refreshSnapshot)
      window.removeEventListener(learningRouteSnapshotEventName, refreshSnapshot)
    }
  }, [])

  return snapshot
}

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { buildAccountLearnerMemoryPreview } from '@/lib/accountLearnerMemory'
import type { AccountLearnerMemoryImportResult } from '@/lib/accountLearnerMemoryServer'
import type { AccountLearnerMemoryPersistenceHandoff } from '@/lib/accountLearnerMemoryPersistenceHandoff'
import {
  buildAdaptiveLearningLoopPacket,
  type AdaptiveLearningLoopPacket,
  type AdaptiveLearningSignalInput,
} from '@/lib/adaptiveLearningLoop'
import type { LearningRouteSnapshot } from '@/lib/learningRouteSnapshot'
import { useSavedLearningRouteSnapshot } from '@/components/product/useSavedLearningRouteSnapshot'

type ServerCheckState =
  | { status: 'idle'; message: string }
  | { status: 'checking'; message: string }
  | { status: 'done'; message: string; resultStatus: AccountLearnerMemoryImportResult['status'] }
  | { status: 'error'; message: string }

type AdaptiveCheckState =
  | { status: 'idle'; message: string }
  | { status: 'checking'; message: string }
  | { status: 'done'; message: string; packetStatus: AdaptiveLearningLoopPacket['status'] }
  | { status: 'error'; message: string }

function statusLabel(status: ReturnType<typeof buildAccountLearnerMemoryPreview>['status']) {
  switch (status) {
    case 'ready':
      return 'Persistence handoff'
    case 'blocked':
      return 'Needs identity repair'
    case 'empty':
    default:
      return 'No local route'
  }
}

function tableLabel(table: string) {
  return table.replaceAll('_', ' ')
}

function sourceLabel(source: string) {
  return source.replaceAll('-', ' ')
}

function formatObservationNumber(value: number) {
  if (value >= 100) return String(Math.round(value))
  if (value >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

function observationUnitLabel(
  unit: NonNullable<NonNullable<ReturnType<typeof buildAccountLearnerMemoryPreview>['workbenchObservation']>['result']>['unit']
) {
  if (unit === 'GB-decimal') return 'GB'
  return unit
}

function resultLabel(result: NonNullable<ReturnType<typeof buildAccountLearnerMemoryPreview>['workbenchObservation']>['result']) {
  if (!result) return null

  const unit = observationUnitLabel(result.unit)
  const direction = result.after < result.before ? 'reduction' : result.after > result.before ? 'increase' : 'same'

  return `${formatObservationNumber(result.before)} -> ${formatObservationNumber(result.after)} ${unit}, ${formatObservationNumber(result.ratio)}x ${direction}`
}

type AccountMemoryServerCheckResponse = {
  result?: AccountLearnerMemoryImportResult
  persisted?: false
  serverMode?: 'contract-only'
  persistenceHandoff?: AccountLearnerMemoryPersistenceHandoff
}

function serverCheckMessage(response: Required<Pick<AccountMemoryServerCheckResponse, 'result'>> & AccountMemoryServerCheckResponse) {
  const { result } = response

  switch (result.status) {
    case 'write-ready':
      if (result.workbenchRestore) {
        return `${result.reason ?? 'Server prepared a deterministic persistence handoff for route, observation, and restorable workbench state. Live persistence is still gated.'} Workbench restore state is included.`
      }
      return result.reason ?? 'Server prepared a deterministic persistence handoff. Live persistence is still gated.'
    case 'auth-required':
      if (result.workbenchRestore) {
        return `${result.reason ?? 'Server validated a restorable workbench packet. A signed-in app user is the next missing piece.'} Workbench restore state is included.`
      }
      return result.reason ?? 'Server reached. A signed-in app user is the next missing piece.'
    case 'blocked':
      return result.reason ?? 'Server blocked this snapshot until object identity is repaired.'
    case 'invalid':
    default:
      return result.reason ?? 'Server rejected the route snapshot contract.'
  }
}

function adaptiveSignalsForSnapshot(snapshot: LearningRouteSnapshot | null): AdaptiveLearningSignalInput[] {
  if (!snapshot) return []

  const objectKey = snapshot.currentObject?.objectKey
  const signals: AdaptiveLearningSignalInput[] = []

  if (snapshot.currentObject) {
    signals.push({
      type: 'concept-revisited',
      objectKey,
      value: snapshot.currentObject.title,
      timestamp: snapshot.createdAt,
    })
  }

  if (snapshot.lastObservation) {
    signals.push({
      type: 'note-saved',
      objectKey,
      value: snapshot.lastObservation.value,
      timestamp: snapshot.lastObservation.updatedAt,
    })
  }

  return signals
}

function adaptiveCheckMessage(packet: AdaptiveLearningLoopPacket) {
  if (packet.status === 'ready') {
    return `Adaptive contract returned ${packet.learnerModel.posture.replaceAll('-', ' ')} and ${packet.nextExperience.action.replaceAll('-', ' ')}.`
  }

  if (packet.status === 'empty') {
    return 'Adaptive contract reached. It needs a saved route or object signal before it can personalize.'
  }

  return packet.blockers[0]?.detail ?? 'Adaptive contract blocked this signal until it is attached to a learning object.'
}

export default function AccountMemoryPreview() {
  const snapshot = useSavedLearningRouteSnapshot()
  const preview = useMemo(() => buildAccountLearnerMemoryPreview(snapshot), [snapshot])
  const adaptiveSignals = useMemo(() => adaptiveSignalsForSnapshot(snapshot), [snapshot])
  const adaptivePacket = useMemo(
    () => buildAdaptiveLearningLoopPacket({ routeSnapshot: snapshot, signals: adaptiveSignals }),
    [snapshot, adaptiveSignals]
  )
  const workbenchObservation = preview.workbenchObservation
  const workbenchResultLabel = resultLabel(workbenchObservation?.result)
  const workbenchResumeHref = workbenchObservation?.restoreHref ?? workbenchObservation?.objectHref
  const snapshotIdentity = `${snapshot?.createdAt ?? 'empty'}:${snapshot?.currentObject?.objectKey ?? 'none'}:${snapshot?.lastObservation?.updatedAt ?? 'none'}`
  const [serverCheck, setServerCheck] = useState<ServerCheckState>({
    status: 'idle',
    message: 'The server contract has not checked this local snapshot yet.',
  })
  const [adaptiveCheck, setAdaptiveCheck] = useState<AdaptiveCheckState>({
    status: 'idle',
    message: 'The adaptive loop has not checked this local snapshot yet.',
  })
  const routeHref = snapshot?.currentObject?.href ?? snapshot?.routeConcepts?.[0]?.href ?? '/paper-map/'

  useEffect(() => {
    setServerCheck({
      status: 'idle',
      message: snapshot
        ? 'The server contract has not checked this local snapshot yet.'
        : 'Start or save a local route before checking the server contract.',
    })
  }, [snapshot, snapshotIdentity])

  useEffect(() => {
    setAdaptiveCheck({
      status: 'idle',
      message: snapshot
        ? 'The adaptive loop has not checked this local snapshot yet.'
        : 'Start or save a local route before checking the adaptive loop.',
    })
  }, [snapshot, snapshotIdentity])

  async function checkServerContract() {
    if (!snapshot) {
      setServerCheck({
        status: 'error',
        message: 'Start or save a local route before checking the account-memory contract.',
      })
      return
    }

    setServerCheck({
      status: 'checking',
      message: 'Checking the server contract...',
    })

    try {
      const response = await fetch('/api/me/learning-route-snapshots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ snapshot }),
      })
      const body = (await response.json()) as AccountMemoryServerCheckResponse

      if (!body.result) {
        setServerCheck({
          status: 'error',
          message: `Server returned ${response.status} without an import result.`,
        })
        return
      }

      setServerCheck({
        status: 'done',
        resultStatus: body.result.status,
        message: serverCheckMessage({
          result: body.result,
          persisted: body.persisted,
          serverMode: body.serverMode,
          persistenceHandoff: body.result.persistenceHandoff,
        }),
      })
    } catch {
      setServerCheck({
        status: 'error',
        message: 'Could not reach the account-memory contract from this browser session.',
      })
    }
  }

  async function checkAdaptiveLoop() {
    setAdaptiveCheck({
      status: 'checking',
      message: 'Checking the adaptive learning loop...',
    })

    try {
      const response = await fetch('/api/learning/adaptive-loop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          routeSnapshot: snapshot,
          signals: adaptiveSignals,
        }),
      })
      const body = (await response.json()) as { packet?: AdaptiveLearningLoopPacket }

      if (!body.packet) {
        setAdaptiveCheck({
          status: 'error',
          message: `Server returned ${response.status} without an adaptive packet.`,
        })
        return
      }

      setAdaptiveCheck({
        status: 'done',
        packetStatus: body.packet.status,
        message: adaptiveCheckMessage(body.packet),
      })
    } catch {
      setAdaptiveCheck({
        status: 'error',
        message: 'Could not reach the adaptive learning loop from this browser session.',
      })
    }
  }

  return (
    <div className="account-memory-page" data-account-memory-status={preview.status}>
      <section className="memory-hero" aria-labelledby="account-memory-title">
        <div className="memory-hero-copy">
          <p className="memory-kicker">Personal study space</p>
          <h1 id="account-memory-title">Preview the thread this browser can carry.</h1>
          <p>
            The north star is simple: every question, object, prediction, source check, and next repair should become
            portable account memory once sign-in persistence is connected.
          </p>
        </div>
        <div className={`memory-status-card ${preview.status}`}>
          <span>{statusLabel(preview.status)}</span>
          <strong>{preview.routeTitle}</strong>
          <p>{preview.routeObjectKey ?? 'Waiting for a route object key.'}</p>
        </div>
      </section>

      <section className="memory-grid" aria-label="Account memory readiness">
        <div className="memory-panel primary">
          <div className="panel-heading">
            <p className="memory-kicker">Import plan</p>
            <h2>What would be written after sign-in</h2>
          </div>
          {preview.writePlan.length > 0 ? (
            <div className="write-plan">
              {preview.writePlan.map((item) => (
                <article className={`write-row ${item.ready ? 'ready' : 'blocked'}`} key={`${item.table}-${item.label}`}>
                  <div>
                    <span>{tableLabel(item.table)}</span>
                    <strong>{item.label}</strong>
                  </div>
                  <p>{item.detail}</p>
                  {item.objectKey ? <code>{item.objectKey}</code> : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-plan">
              <p>Start a local route from Home, Graph, Paper Mapper, or a concept notebook. This surface will show the exact rows ready for account memory.</p>
              <Link href="/paper-map/" className="memory-button">
                Map a paper clue
              </Link>
            </div>
          )}
        </div>

        <div className="memory-panel object-panel">
          <div className="panel-heading">
            <p className="memory-kicker">Selected object</p>
            <h2>{preview.currentObject?.title ?? 'No object selected yet'}</h2>
          </div>
          {preview.currentObject ? (
            <>
              <dl className="object-facts">
                <div>
                  <dt>Type</dt>
                  <dd>{sourceLabel(preview.currentObject.type)}</dd>
                </div>
                <div>
                  <dt>Object key</dt>
                  <dd>{preview.currentObject.objectKey ?? 'missing'}</dd>
                </div>
                <div>
                  <dt>Question</dt>
                  <dd>{preview.currentQuestion ?? 'No active question saved.'}</dd>
                </div>
              </dl>
              <Link href={routeHref} className="memory-button secondary">
                Open current object
              </Link>
            </>
          ) : (
            <p className="quiet-copy">Select an equation, concept, code witness, source, claim, demo, or route object to attach memory cleanly.</p>
          )}
        </div>

        <div className="memory-panel observation-panel">
          <div className="panel-heading">
            <p className="memory-kicker">{workbenchObservation ? 'Workbench memory preview' : 'Last observation'}</p>
            <h2>{workbenchObservation?.label ?? preview.lastObservation?.label ?? 'Observation not saved yet'}</h2>
          </div>
          {workbenchObservation ? (
            <div className="workbench-memory-card" data-workbench-observation="true">
              <div className="workbench-object">
                <span>{workbenchObservation.objectType ? sourceLabel(workbenchObservation.objectType) : 'Selected object'}</span>
                <strong>{workbenchObservation.objectTitle ?? preview.currentObject?.title ?? 'Saved workbench object'}</strong>
                {workbenchObservation.objectKey ? <code>{workbenchObservation.objectKey}</code> : null}
              </div>

              <div className="workbench-memory-grid">
                <article>
                  <span>Committed prediction before reveal</span>
                  <strong>{workbenchObservation.predictionLabel ?? preview.lastObservation?.value}</strong>
                  {workbenchObservation.predictionId ? <em>{workbenchObservation.predictionId}</em> : null}
                </article>
                <article>
                  <span>Observed lab evidence</span>
                  <strong>{workbenchObservation.evidence}</strong>
                  {workbenchResultLabel ? <em>{workbenchResultLabel}</em> : null}
                </article>
                {workbenchObservation.invariant ? (
                  <article>
                    <span>Invariant to reuse</span>
                    <strong>{workbenchObservation.invariant}</strong>
                  </article>
                ) : null}
                {workbenchObservation.nextMove ? (
                  <article>
                    <span>Next move</span>
                    <strong>{workbenchObservation.nextMove}</strong>
                  </article>
                ) : null}
              </div>

              {workbenchObservation.changed || workbenchObservation.heldFixed.length > 0 ? (
                <div className="workbench-variable-strip" aria-label="Workbench variables">
                  {workbenchObservation.changed ? (
                    <span className="changed-variable">
                      changed {workbenchObservation.changed.symbol}: {workbenchObservation.changed.from} {'->'} {workbenchObservation.changed.to}
                    </span>
                  ) : null}
                  {workbenchObservation.heldFixed.map((item) => (
                    <span key={`${item.symbol}-${item.value}`}>
                      fixed {item.symbol} = {item.value}
                    </span>
                  ))}
                </div>
              ) : null}

              {workbenchResumeHref ? (
                <div className="workbench-actions">
                  <Link href={workbenchResumeHref} className="memory-button secondary">
                    Resume this workbench
                  </Link>
                  {workbenchObservation.objectHref && workbenchObservation.objectHref !== workbenchResumeHref ? (
                    <Link href={workbenchObservation.objectHref} className="memory-button quiet">
                      Open equation object
                    </Link>
                  ) : null}
                </div>
              ) : null}

              <div className="workbench-boundary">
                <span>browser-local preview</span>
                {snapshot?.groundingStatus ? <span>{sourceLabel(snapshot.groundingStatus)}</span> : null}
                <span>{sourceLabel(workbenchObservation.source)}</span>
                {workbenchObservation.labId ? <span>{workbenchObservation.labId}</span> : null}
                {workbenchObservation.labVersion ? <span>v{workbenchObservation.labVersion}</span> : null}
                <span>not account-backed</span>
              </div>
              {workbenchObservation.caveat ? <p className="workbench-caveat">{workbenchObservation.caveat}</p> : null}
            </div>
          ) : preview.lastObservation ? (
            <div className="observation-card">
              <strong>{preview.lastObservation.value}</strong>
              {preview.lastObservation.detail ? <p>{preview.lastObservation.detail}</p> : null}
              {preview.lastObservation.nextQuestion ? <span>{preview.lastObservation.nextQuestion}</span> : null}
            </div>
          ) : (
            <p className="quiet-copy">Prediction-first demos can save the smallest useful result: what changed, what stayed fixed, and what to test next.</p>
          )}
        </div>

        <div
          className="memory-panel adaptive-panel"
          data-adaptive-loop-status={adaptivePacket.status}
          data-adaptive-loop-posture={adaptivePacket.learnerModel.posture}
        >
          <div className="panel-heading">
            <p className="memory-kicker">Adaptive next move</p>
            <h2>{adaptivePacket.nextExperience.label}</h2>
          </div>
          <div className="adaptive-card">
            <header>
              <span className="posture-pill">{sourceLabel(adaptivePacket.learnerModel.posture)}</span>
              <strong>{adaptivePacket.learnerModel.confidenceTrend} confidence trend</strong>
            </header>
            <p>{adaptivePacket.nextExperience.prompt}</p>
            {adaptivePacket.nextExperience.objectKey ? <code>{adaptivePacket.nextExperience.objectKey}</code> : null}
          </div>

          <div className="adaptive-needs" aria-label="Inferred learner needs">
            {adaptivePacket.learnerModel.inferredNeeds.map((need) => (
              <span key={need}>{need}</span>
            ))}
          </div>

          {adaptivePacket.improvementDraft ? (
            <div className="improvement-draft">
              <strong>{adaptivePacket.improvementDraft.title}</strong>
              <p>{adaptivePacket.improvementDraft.reason}</p>
            </div>
          ) : null}

          <div className={`server-contract-box adaptive ${adaptiveCheck.status}`} role="status" aria-live="polite">
            <button type="button" onClick={checkAdaptiveLoop} disabled={adaptiveCheck.status === 'checking'}>
              {adaptiveCheck.status === 'checking' ? 'Checking...' : 'Check adaptive loop'}
            </button>
            <p>{adaptiveCheck.message}</p>
          </div>
        </div>

        <div className="memory-panel">
          <div className="panel-heading">
            <p className="memory-kicker">Route signal</p>
            <h2>Compact, not noisy</h2>
          </div>
          <div className="metric-grid">
            <span>
              <strong>{preview.counts.routeSteps}</strong>
              route steps
            </span>
            <span>
              <strong>{preview.counts.sourceObjects}</strong>
              objects
            </span>
            <span>
              <strong>{preview.counts.readyStages}</strong>
              ready stages
            </span>
            <span>
              <strong>{preview.counts.savedCheckpoints}</strong>
              checkpoints
            </span>
          </div>
          <p className="contract-line">{preview.nextServerContract}</p>
          <div className={`server-contract-box ${serverCheck.status}`} role="status" aria-live="polite">
            <button type="button" onClick={checkServerContract} disabled={serverCheck.status === 'checking' || !snapshot}>
              {serverCheck.status === 'checking' ? 'Checking...' : 'Check server contract'}
            </button>
            <p>{serverCheck.message}</p>
          </div>
        </div>
      </section>

      {preview.blockers.length > 0 ? (
        <section className="blocker-strip" aria-label="Account memory blockers">
          {preview.blockers.map((blocker) => (
            <article key={blocker.id}>
              <strong>{blocker.label}</strong>
              <p>{blocker.detail}</p>
            </article>
          ))}
        </section>
      ) : null}

      <style jsx>{`
        .account-memory-page {
          --memory-ink: #16212d;
          --memory-muted: #607080;
          --memory-paper: rgba(255, 251, 245, 0.88);
          --memory-quiet: rgba(247, 242, 233, 0.82);
          --memory-line: rgba(24, 36, 48, 0.12);
          --memory-teal: #1f6f78;
          --memory-blue: #1f4b99;
          --memory-rust: #b85b45;
          --memory-gold: #d7b15f;
          color: var(--memory-ink);
        }

        .account-memory-page :global(h2::before) {
          display: none !important;
          content: none !important;
        }

        .memory-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.52fr);
          gap: clamp(1rem, 2vw, 1.5rem);
          align-items: stretch;
          padding: clamp(1rem, 2vw, 1.4rem);
          border: 1px solid var(--memory-line);
          border-radius: 18px;
          background:
            linear-gradient(135deg, rgba(31, 111, 120, 0.12), transparent 45%),
            linear-gradient(90deg, rgba(31, 75, 153, 0.08), rgba(184, 91, 69, 0.08)),
            var(--memory-paper);
        }

        .memory-hero-copy h1,
        .panel-heading h2 {
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          letter-spacing: 0;
        }

        .memory-hero-copy h1 {
          max-width: 760px;
          font-size: clamp(2.15rem, 5.2vw, 5rem);
          line-height: 0.95;
        }

        .memory-hero-copy p {
          max-width: 720px;
          margin: 1rem 0 0;
          color: var(--memory-muted);
          font-size: clamp(1rem, 1.3vw, 1.14rem);
          line-height: 1.65;
        }

        .memory-kicker {
          margin: 0 0 0.55rem;
          color: var(--memory-teal);
          font-size: 0.76rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .memory-status-card,
        .memory-panel,
        .blocker-strip article {
          border: 1px solid var(--memory-line);
          border-radius: 12px;
          background: var(--memory-paper);
          box-shadow: 0 18px 44px rgba(7, 15, 28, 0.08);
        }

        .memory-status-card {
          display: flex;
          min-height: 220px;
          flex-direction: column;
          justify-content: space-between;
          padding: 1rem;
        }

        .memory-status-card span {
          width: fit-content;
          border: 1px solid rgba(31, 111, 120, 0.24);
          border-radius: 999px;
          padding: 0.35rem 0.62rem;
          color: var(--memory-teal);
          background: rgba(31, 111, 120, 0.1);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .memory-status-card.blocked span {
          border-color: rgba(184, 91, 69, 0.28);
          color: #8d3b2c;
          background: rgba(184, 91, 69, 0.12);
        }

        .memory-status-card.empty span {
          border-color: rgba(31, 75, 153, 0.24);
          color: var(--memory-blue);
          background: rgba(31, 75, 153, 0.1);
        }

        .memory-status-card strong {
          font-size: 1.45rem;
          line-height: 1.12;
        }

        .memory-status-card p,
        .write-row p,
        .quiet-copy,
        .observation-card p,
        .blocker-strip p {
          margin: 0;
          color: var(--memory-muted);
          line-height: 1.55;
        }

        .memory-status-card p,
        .write-row code,
        .contract-line {
          overflow-wrap: anywhere;
        }

        .memory-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.12fr) minmax(260px, 0.78fr);
          gap: 1rem;
          margin-top: 1rem;
        }

        .memory-panel {
          min-width: 0;
          padding: clamp(1rem, 1.6vw, 1.25rem);
        }

        .memory-panel.primary {
          grid-row: span 2;
        }

        .panel-heading {
          margin-bottom: 1rem;
        }

        .panel-heading h2 {
          font-size: clamp(1.45rem, 2.4vw, 2.2rem);
          line-height: 1.05;
        }

        .object-panel .panel-heading h2,
        .observation-panel .panel-heading h2 {
          font-size: clamp(1.18rem, 1.65vw, 1.55rem);
          line-height: 1.12;
        }

        .write-plan {
          display: grid;
          gap: 0.75rem;
        }

        .write-row {
          display: grid;
          gap: 0.65rem;
          padding: 0.85rem;
          border: 1px solid var(--memory-line);
          border-left: 4px solid var(--memory-teal);
          border-radius: 10px;
          background: rgba(255, 251, 245, 0.72);
        }

        .write-row.blocked {
          border-left-color: var(--memory-rust);
        }

        .write-row span,
        .object-facts dt,
        .contract-line {
          color: var(--memory-muted);
          font-size: 0.76rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .write-row strong {
          display: block;
          margin-top: 0.2rem;
          font-size: 1.02rem;
        }

        .write-row code {
          width: fit-content;
          max-width: 100%;
          border-radius: 8px;
          padding: 0.38rem 0.48rem;
          color: #17324a;
          background: rgba(31, 75, 153, 0.08);
          font-size: 0.8rem;
        }

        .empty-plan {
          display: grid;
          gap: 1rem;
        }

        :global(.account-memory-page .memory-button) {
          display: inline-flex;
          width: fit-content;
          min-height: 44px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(31, 111, 120, 0.28);
          border-radius: 999px;
          padding: 0.66rem 0.95rem;
          color: #fff9ee;
          background: #1f6f78;
          font-weight: 800;
          text-decoration: none;
        }

        :global(.account-memory-page .memory-button.secondary) {
          margin-top: 0.9rem;
          color: var(--memory-ink);
          background: rgba(31, 111, 120, 0.1);
        }

        :global(.account-memory-page .memory-button.quiet) {
          color: var(--memory-ink);
          background: rgba(255, 255, 255, 0.5);
        }

        .object-facts {
          display: grid;
          gap: 0.75rem;
          margin: 0;
        }

        .object-facts div {
          display: grid;
          gap: 0.2rem;
          min-width: 0;
          border-bottom: 1px solid var(--memory-line);
          padding-bottom: 0.7rem;
        }

        .object-facts dd {
          margin: 0;
          overflow-wrap: anywhere;
          color: var(--memory-ink);
          line-height: 1.45;
        }

        .observation-card {
          display: grid;
          gap: 0.7rem;
          border-radius: 12px;
          padding: 0.95rem;
          background: linear-gradient(135deg, rgba(215, 177, 95, 0.18), rgba(31, 111, 120, 0.1));
        }

        .workbench-memory-card {
          display: grid;
          gap: 0.8rem;
          border: 1px solid rgba(31, 111, 120, 0.16);
          border-radius: 14px;
          padding: 0.95rem;
          background:
            linear-gradient(135deg, rgba(31, 111, 120, 0.12), rgba(255, 251, 245, 0.78)),
            rgba(255, 251, 245, 0.88);
        }

        .workbench-object {
          display: grid;
          gap: 0.38rem;
          border-bottom: 1px solid var(--memory-line);
          padding-bottom: 0.75rem;
        }

        .workbench-object span,
        .workbench-memory-grid span,
        .workbench-boundary span {
          color: var(--memory-teal);
          font-size: 0.7rem;
          font-weight: 850;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .workbench-object strong {
          line-height: 1.25;
        }

        .workbench-object code {
          width: fit-content;
          max-width: 100%;
          overflow-wrap: anywhere;
          border-radius: 8px;
          padding: 0.32rem 0.45rem;
          color: #17324a;
          background: rgba(31, 75, 153, 0.08);
          font-size: 0.76rem;
        }

        .workbench-memory-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.58rem;
        }

        .workbench-memory-grid article {
          display: grid;
          align-content: start;
          gap: 0.38rem;
          min-width: 0;
          border: 1px solid var(--memory-line);
          border-radius: 10px;
          padding: 0.72rem;
          background: rgba(255, 251, 245, 0.7);
        }

        .workbench-memory-grid strong {
          overflow-wrap: anywhere;
          font-size: 0.94rem;
          line-height: 1.35;
        }

        .workbench-memory-grid em {
          color: var(--memory-muted);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          font-style: normal;
          line-height: 1.35;
        }

        .workbench-variable-strip,
        .workbench-actions,
        .workbench-boundary {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .workbench-actions {
          margin-top: 0.15rem;
        }

        :global(.account-memory-page .workbench-actions .memory-button) {
          margin-top: 0;
        }

        .workbench-variable-strip span {
          max-width: 100%;
          border: 1px solid rgba(31, 75, 153, 0.14);
          border-radius: 999px;
          padding: 0.34rem 0.52rem;
          color: #29425e;
          background: rgba(255, 251, 245, 0.72);
          font-size: 0.76rem;
          font-weight: 750;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .workbench-variable-strip .changed-variable {
          border-color: rgba(215, 177, 95, 0.36);
          color: #6b4b12;
          background: rgba(215, 177, 95, 0.16);
        }

        .workbench-boundary span {
          max-width: 100%;
          border: 1px solid rgba(31, 111, 120, 0.16);
          border-radius: 999px;
          padding: 0.3rem 0.5rem;
          background: rgba(31, 111, 120, 0.08);
          overflow-wrap: anywhere;
        }

        .workbench-caveat {
          margin: 0;
          border-left: 4px solid var(--memory-rust);
          padding-left: 0.62rem;
          color: var(--memory-muted);
          line-height: 1.45;
        }

        .observation-card strong {
          font-size: 1.05rem;
          line-height: 1.35;
        }

        .observation-card span {
          color: #70412f;
          font-weight: 800;
          line-height: 1.4;
        }

        .adaptive-panel {
          display: grid;
          align-content: start;
          gap: 0.9rem;
        }

        .adaptive-card,
        .improvement-draft {
          display: grid;
          gap: 0.68rem;
          border: 1px solid var(--memory-line);
          border-radius: 12px;
          padding: 0.85rem;
          background: rgba(31, 75, 153, 0.06);
        }

        .adaptive-card header {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
          align-items: center;
          justify-content: space-between;
        }

        .posture-pill {
          border: 1px solid rgba(31, 111, 120, 0.24);
          border-radius: 999px;
          padding: 0.32rem 0.55rem;
          color: var(--memory-teal);
          background: rgba(31, 111, 120, 0.1);
          font-size: 0.74rem;
          font-weight: 800;
          text-transform: capitalize;
        }

        .adaptive-card strong {
          color: var(--memory-muted);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .adaptive-card p,
        .improvement-draft p {
          margin: 0;
          color: var(--memory-muted);
          line-height: 1.48;
        }

        .adaptive-card code {
          width: fit-content;
          max-width: 100%;
          overflow-wrap: anywhere;
          border-radius: 8px;
          padding: 0.38rem 0.48rem;
          color: #17324a;
          background: rgba(255, 251, 245, 0.8);
          font-size: 0.78rem;
        }

        .adaptive-needs {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .adaptive-needs span {
          border: 1px solid rgba(31, 75, 153, 0.16);
          border-radius: 999px;
          padding: 0.34rem 0.52rem;
          color: #29425e;
          background: rgba(255, 251, 245, 0.72);
          font-size: 0.76rem;
          font-weight: 700;
          line-height: 1.2;
        }

        .improvement-draft {
          border-left: 4px solid var(--memory-gold);
          background: rgba(215, 177, 95, 0.12);
        }

        .improvement-draft strong {
          line-height: 1.25;
        }

        .metric-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.6rem;
        }

        .metric-grid span {
          min-height: 78px;
          border: 1px solid var(--memory-line);
          border-radius: 10px;
          padding: 0.75rem;
          color: var(--memory-muted);
          background: var(--memory-quiet);
          line-height: 1.2;
        }

        .metric-grid strong {
          display: block;
          color: var(--memory-ink);
          font-size: 1.65rem;
          line-height: 1;
        }

        .contract-line {
          margin: 1rem 0 0;
        }

        .server-contract-box {
          display: grid;
          gap: 0.7rem;
          margin-top: 0.9rem;
          border: 1px solid var(--memory-line);
          border-radius: 10px;
          padding: 0.75rem;
          background: rgba(31, 75, 153, 0.06);
        }

        .server-contract-box.done {
          border-color: rgba(31, 111, 120, 0.26);
          background: rgba(31, 111, 120, 0.08);
        }

        .server-contract-box.error {
          border-color: rgba(184, 91, 69, 0.3);
          background: rgba(184, 91, 69, 0.08);
        }

        .server-contract-box button {
          min-height: 44px;
          width: fit-content;
          border: 1px solid rgba(31, 75, 153, 0.24);
          border-radius: 999px;
          padding: 0.55rem 0.85rem;
          color: var(--memory-ink);
          background: rgba(255, 251, 245, 0.86);
          font-weight: 800;
          cursor: pointer;
        }

        .server-contract-box button:disabled {
          cursor: not-allowed;
          opacity: 0.58;
        }

        .server-contract-box p {
          margin: 0;
          color: var(--memory-muted);
          line-height: 1.45;
        }

        .blocker-strip {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .blocker-strip article {
          padding: 0.9rem;
          border-left: 4px solid var(--memory-rust);
        }

        .blocker-strip strong {
          display: block;
          margin-bottom: 0.35rem;
        }

        @media (max-width: 920px) {
          .memory-hero,
          .memory-grid,
          .blocker-strip {
            grid-template-columns: 1fr;
          }

          .memory-panel.primary {
            grid-row: auto;
          }
        }

        @media (max-width: 520px) {
          .account-memory-page {
            margin-inline: -0.35rem;
          }

          .memory-hero,
          .memory-panel,
          .blocker-strip article {
            border-radius: 10px;
          }

          .memory-hero {
            gap: 0.8rem;
            padding: 0.95rem;
          }

          .memory-hero-copy h1 {
            font-size: clamp(2rem, 10.4vw, 3rem);
            line-height: 0.92;
          }

          .memory-hero-copy p {
            margin-top: 0.8rem;
            font-size: 0.95rem;
            line-height: 1.48;
          }

          .memory-status-card {
            min-height: 150px;
            padding: 0.85rem;
          }

          .memory-status-card strong {
            font-size: 1.18rem;
          }

          .metric-grid {
            grid-template-columns: 1fr;
          }

          .workbench-memory-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

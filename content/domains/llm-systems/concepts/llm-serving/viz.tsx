import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { emitDemoState } from '../../../../../lib/demoState'

const ServingLatencyViz = dynamic(() => import('@/components/foundations/ServingLatencyViz'), {
  ssr: false,
})

type PredictionKey = 'prefill-compute' | 'decode-kv' | 'batch-scheduler' | 'goodput-slo'

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  'prefill-compute': {
    label: 'Prefill compute',
    response: 'Prefill is the time-to-first-token phase: long prompts create large parallel attention and matmul work before generation starts.',
  },
  'decode-kv': {
    label: 'Decode KV reads',
    response: 'Decode advances one token at a time and repeatedly reads the KV cache, so memory bandwidth and KV allocation often dominate serving behavior.',
  },
  'batch-scheduler': {
    label: 'Batch scheduler',
    response: 'Continuous batching keeps the GPU busy across requests, but it must schedule around prefill spikes, decode steps, and KV cache growth.',
  },
  'goodput-slo': {
    label: 'Goodput SLO',
    response: 'Goodput is the product target: serve as many requests as possible while meeting TTFT and TPOT latency constraints.',
  },
}

const SERVING_EVIDENCE_STEPS = [
  {
    label: 'Predict',
    text: 'Choose the first serving bottleneck before the lab mounts.',
  },
  {
    label: 'Observe',
    text: 'Reveal TTFT, TPOT, batching, and KV pressure signals.',
  },
  {
    label: 'Ground',
    text: 'Tie prefill and decode behavior to concrete latency terms.',
  },
  {
    label: 'Carry',
    text: 'Optimize goodput under SLOs, not single-pass speed alone.',
  },
] as const

export default function LLMServingViz() {
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)

  const expected: PredictionKey = 'decode-kv'
  const expectedPrediction = PREDICTIONS[expected]
  const predictionCorrect = prediction === expected
  const evidenceActiveIndex = revealed ? 3 : prediction ? 1 : 0
  const evidencePhase = SERVING_EVIDENCE_STEPS[evidenceActiveIndex]?.label ?? 'Predict'

  useEffect(() => {
    const routeState = {
      conceptId: 'llm-serving',
      label: 'Prediction-first serving bottleneck reveal',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; serving reveals ${expectedPrediction.label}.`
        : 'Learner is predicting the bottleneck that should explain LLM serving before the latency lab is mounted.',
      values: [
        'evidence loop: predict -> observe -> ground -> carry',
        `evidence phase: ${evidencePhase}`,
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected bottleneck: ${revealed ? expectedPrediction.label : 'hidden until reveal'}`,
        `serving invariant: ${revealed ? expectedPrediction.response : 'hidden until reveal'}`,
        `latency lab: ${revealed ? 'mounted' : 'hidden until reveal'}`,
      ],
    }

    emitDemoState(routeState)

    if (!revealed || typeof window === 'undefined') return undefined

    const timer = window.setTimeout(() => emitDemoState(routeState), 350)
    return () => window.clearTimeout(timer)
  }, [evidencePhase, expectedPrediction.label, expectedPrediction.response, prediction, predictionCorrect, revealed])

  return (
    <div className="wrap">
      <section
        className="predictionPanel"
        data-child-demo-gate="llm-serving-bottleneck"
        aria-live="polite"
      >
        <div className="predictionCopy">
          <span>prediction checkpoint</span>
          <strong>Which bottleneck should explain LLM serving first?</strong>
          <p>
            Pick the constraint before the latency lab appears. Serving is not one forward pass:
            prefill, decode, scheduling, and latency SLOs compete at every request.
          </p>
        </div>

        <div className="servingPreview" aria-hidden="true">
          <div className="prefillLane">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="decodeLane">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="kvBlocks">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>

        <div className="choiceRow" role="group" aria-label="LLM serving bottleneck prediction">
          {(Object.keys(PREDICTIONS) as PredictionKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={prediction === key}
              className={prediction === key ? 'selected' : ''}
              onClick={() => {
                setPrediction(key)
                setRevealed(false)
              }}
            >
              {PREDICTIONS[key].label}
            </button>
          ))}
        </div>
        <div className="evidenceStrip" aria-label="LLM serving evidence loop">
          {SERVING_EVIDENCE_STEPS.map((step, index) => (
            <div
              key={step.label}
              className={index <= evidenceActiveIndex ? 'evidenceStep evidence-step active' : 'evidenceStep evidence-step'}
            >
              <strong>{step.label}</strong>
              <span>{step.text}</span>
            </div>
          ))}
        </div>

        <button type="button" className="reveal" disabled={prediction === null} onClick={() => setRevealed(true)}>
          Reveal serving bottleneck
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedPrediction.label} is the bottleneck this route emphasizes.`}</h4>
            <p>{expectedPrediction.response} Use the lab below to test prompt length, output length, and batch size.</p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose a bottleneck to unlock the latency lab.' : 'Reveal the bottleneck to mount the latency lab.'}</p>
        )}
      </section>

      <div className="panel">
        {revealed ? (
          <ServingLatencyViz />
        ) : (
          <div className="panelGate">
            <span>LLM serving latency lab</span>
            <strong>Hidden until prediction reveal</strong>
            <p>Commit to the bottleneck first, then inspect TTFT, TPOT, batching, and workload mix.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          min-width: 0;
        }

        .predictionPanel,
        .result,
        .panel {
          display: grid;
          gap: 0.72rem;
          min-width: 0;
          padding: 0.82rem;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          background: rgba(8, 12, 20, 0.18);
        }

        .predictionCopy {
          display: grid;
          gap: 0.32rem;
          min-width: 0;
        }

        .predictionCopy span,
        .panelGate span {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
            monospace;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0;
          color: var(--text-secondary);
        }

        .predictionCopy strong,
        .result h4,
        .panelGate strong {
          color: var(--text-primary);
          line-height: 1.28;
          overflow-wrap: anywhere;
        }

        .predictionCopy p,
        .result p,
        .panelGate p {
          margin: 0;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .servingPreview {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 0.85fr);
          gap: 0.7rem;
          min-width: 0;
          min-height: 7rem;
          padding: 0.72rem;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: calc(var(--radius-lg) - 4px);
          background:
            linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            rgba(8, 12, 20, 0.24);
          background-size: 24px 24px;
        }

        .prefillLane,
        .decodeLane,
        .kvBlocks {
          position: relative;
          min-width: 0;
          overflow: hidden;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.38);
        }

        .prefillLane i {
          position: absolute;
          left: 12%;
          right: 12%;
          height: 0.42rem;
          border-radius: 999px;
          background: rgba(20, 184, 166, 0.72);
          animation: prefillFlash 2.7s ease-in-out infinite;
        }

        .prefillLane i:nth-child(1) { top: 22%; animation-delay: -0.15s; }
        .prefillLane i:nth-child(2) { top: 38%; animation-delay: -0.3s; }
        .prefillLane i:nth-child(3) { top: 54%; animation-delay: -0.45s; }
        .prefillLane i:nth-child(4) { top: 70%; animation-delay: -0.6s; }

        .decodeLane i {
          position: absolute;
          left: 12%;
          top: 50%;
          width: 0.55rem;
          height: 0.55rem;
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.9);
          transform: translateY(-50%);
          animation: decodeStep 3.2s ease-in-out infinite;
        }

        .decodeLane i:nth-child(1) { animation-delay: -0.1s; }
        .decodeLane i:nth-child(2) { animation-delay: -0.4s; }
        .decodeLane i:nth-child(3) { animation-delay: -0.7s; }
        .decodeLane i:nth-child(4) { animation-delay: -1s; }
        .decodeLane i:nth-child(5) { animation-delay: -1.3s; }

        .kvBlocks {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.32rem;
          padding: 0.48rem;
        }

        .kvBlocks i {
          border-radius: 7px;
          background: rgba(99, 102, 241, 0.22);
          border: 1px solid rgba(99, 102, 241, 0.28);
          animation: kvPulse 2.4s ease-in-out infinite;
        }

        .kvBlocks i:nth-child(2) { animation-delay: -0.25s; }
        .kvBlocks i:nth-child(3) { animation-delay: -0.5s; }
        .kvBlocks i:nth-child(4) { animation-delay: -0.75s; }
        .kvBlocks i:nth-child(5) { animation-delay: -1s; }
        .kvBlocks i:nth-child(6) { animation-delay: -1.25s; }

        .choiceRow {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.5rem;
          min-width: 0;
        }

        .evidenceStrip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.5rem;
          padding: 0.58rem;
          border-radius: 12px;
          border: 1px solid rgba(20, 184, 166, 0.18);
          background:
            linear-gradient(135deg, rgba(20, 184, 166, 0.16), rgba(8, 12, 20, 0.95)),
            rgba(8, 12, 20, 0.86);
        }

        .evidenceStep {
          display: grid;
          gap: 0.22rem;
          min-width: 0;
          padding: 0.58rem;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: rgba(15, 23, 42, 0.5);
          opacity: 0.58;
        }

        .evidenceStep.active {
          opacity: 1;
          border-color: rgba(20, 184, 166, 0.34);
          background: rgba(15, 118, 110, 0.28);
        }

        .evidenceStep strong {
          color: #ccfbf1;
          font-size: 0.72rem;
          line-height: 1.2;
        }

        .evidenceStep span {
          color: #d7e8ea;
          font-size: 0.7rem;
          line-height: 1.34;
          overflow-wrap: anywhere;
        }

        .choiceRow button,
        .reveal {
          min-width: 0;
          min-height: 2.7rem;
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          background: rgba(8, 12, 20, 0.35);
          color: var(--text-primary);
          padding: 0.45rem 0.62rem;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }

        .choiceRow button.selected {
          border-color: rgba(99, 102, 241, 0.58);
          background: rgba(99, 102, 241, 0.18);
        }

        .reveal {
          justify-self: start;
          background: rgba(99, 102, 241, 0.88);
          border-color: rgba(99, 102, 241, 0.7);
          color: #fffaf2;
        }

        .reveal:disabled {
          opacity: 0.58;
          cursor: not-allowed;
        }

        .result {
          min-height: 5rem;
        }

        .result.shown {
          border-color: rgba(245, 158, 11, 0.28);
          background: rgba(245, 158, 11, 0.1);
        }

        .result h4 {
          margin: 0;
          font-size: 1rem;
        }

        .panelGate {
          display: grid;
          gap: 0.38rem;
          min-height: 13rem;
          align-content: center;
          padding: 1rem;
          border-radius: calc(var(--radius-lg) - 4px);
          background:
            linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            rgba(8, 12, 20, 0.22);
          background-size: 28px 28px;
          text-align: center;
        }

        @keyframes prefillFlash {
          0%, 100% { transform: scaleX(0.55); opacity: 0.48; }
          50% { transform: scaleX(1); opacity: 1; }
        }

        @keyframes decodeStep {
          0%, 100% { left: 12%; opacity: 0.5; }
          50% { left: 78%; opacity: 1; }
        }

        @keyframes kvPulse {
          0%, 100% { opacity: 0.46; transform: scale(0.96); }
          50% { opacity: 1; transform: scale(1); }
        }

        @media (max-width: 720px) {
          .servingPreview,
          .choiceRow,
          .evidenceStrip {
            grid-template-columns: 1fr;
          }

          .servingPreview {
            min-height: 13rem;
          }
        }

        @media (max-width: 520px) {
          .choiceRow {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

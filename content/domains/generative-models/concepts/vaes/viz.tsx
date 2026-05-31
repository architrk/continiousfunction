'use client'

import { useEffect, useMemo, useState } from 'react'

import { clearDemoState, emitDemoState } from '../../../../../lib/demoState'

type DecoderMode = 'linear' | 'two-causes'
type GapDiagnostic = 'tight' | 'shift-scale' | 'family-mismatch'

const SIGMA_X = 0.45
const SIGMA_X_VAR = SIGMA_X * SIGMA_X
const Z_MIN = -6
const Z_MAX = 6
const POINTS = 961
const DZ = (Z_MAX - Z_MIN) / (POINTS - 1)
const GAP_TIGHT = 0.05
const TWO_CAUSE_X = 0.65
const Z_GRID = Array.from({ length: POINTS }, (_, index) => Z_MIN + index * DZ)

const DIAGNOSTIC_CHOICES: Array<{ id: GapDiagnostic; label: string; description: string }> = [
  {
    id: 'tight',
    label: 'Tight bound',
    description: 'q already hugs the hidden target curve, so the inference gap should be small.',
  },
  {
    id: 'shift-scale',
    label: 'Shift or scale mismatch',
    description: 'The hidden target is essentially one mode, but q is misplaced or has the wrong width.',
  },
  {
    id: 'family-mismatch',
    label: 'Family mismatch',
    description: 'The decoder creates multiple plausible causes, and one Gaussian q cannot cover the hidden target tightly.',
  },
]

const VAE_EVIDENCE_STEPS = [
  {
    label: 'Predict',
    detail: 'Diagnose the gap before posterior values appear.',
  },
  {
    label: 'Observe',
    detail: 'Reveal posterior, ELBO, and evidence.',
  },
  {
    label: 'Ground',
    detail: 'Compare the gap to KL(q || posterior).',
  },
  {
    label: 'Carry',
    detail: 'Use the gap as an inference-family diagnostic.',
  },
]

function logNormal(x: number, mean: number, variance: number) {
  return -0.5 * (Math.log(2 * Math.PI * variance) + ((x - mean) ** 2) / variance)
}

function decoderMean(z: number, mode: DecoderMode) {
  return mode === 'linear' ? z : z * z
}

function integrate(values: number[]) {
  return values.reduce((acc, value) => acc + value, 0) * DZ
}

function logIntegrateExp(logValues: number[]) {
  const maxLog = Math.max(...logValues)
  const area = logValues.reduce((acc, value) => acc + Math.exp(value - maxLog), 0) * DZ
  return maxLog + Math.log(area)
}

function fmt(value: number) {
  const clean = Math.abs(value) < 0.0005 ? 0 : value
  return clean.toFixed(3)
}

function fmtErr(value: number) {
  return value < 0.001 ? value.toExponential(1) : value.toFixed(3)
}

function diagnosticLabel(diagnostic: GapDiagnostic) {
  return DIAGNOSTIC_CHOICES.find((choice) => choice.id === diagnostic)?.label ?? diagnostic
}

function classifyGapDiagnostic(mode: DecoderMode, xObs: number, gap: number): GapDiagnostic {
  if (gap <= GAP_TIGHT) return 'tight'
  if (mode === 'two-causes' && xObs >= TWO_CAUSE_X) return 'family-mismatch'
  return 'shift-scale'
}

function posteriorShape(mode: DecoderMode, xObs: number) {
  if (mode === 'linear') return 'linear-unimodal'
  if (xObs < TWO_CAUSE_X) return 'quadratic-near-merged'
  return 'quadratic-two-cause'
}

export default function VAEsDemo() {
  const [mode, setMode] = useState<DecoderMode>('linear')
  const [xObs, setXObs] = useState(1.2)
  const [qMu, setQMu] = useState(0.2)
  const [qLogStd, setQLogStd] = useState(Math.log(0.75))
  const [prediction, setPrediction] = useState<GapDiagnostic | null>(null)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)

  const qStd = Math.exp(qLogStd)

  const data = useMemo(() => {
    const logPrior = Z_GRID.map((z) => logNormal(z, 0, 1))
    const prior = logPrior.map(Math.exp)
    const logLikelihood = Z_GRID.map((z) => logNormal(xObs, decoderMean(z, mode), SIGMA_X_VAR))
    const likelihood = logLikelihood.map(Math.exp)
    const logJoint = logPrior.map((value, index) => value + logLikelihood[index])
    const logEvidence = logIntegrateExp(logJoint)
    const logPosterior = logJoint.map((value) => value - logEvidence)
    const posterior = logPosterior.map((value) => (value < -745 ? 0 : Math.exp(value)))

    const logQRaw = Z_GRID.map((z) => logNormal(z, qMu, qStd * qStd))
    const qRaw = logQRaw.map((value) => (value < -745 ? 0 : Math.exp(value)))
    const qMass = integrate(qRaw)
    const q = qRaw.map((value) => value / qMass)
    const logQ = logQRaw.map((value) => value - Math.log(qMass))

    const reconLogLik = integrate(q.map((value, index) => value * logLikelihood[index]))
    const klToPrior = integrate(q.map((value, index) => value * (logQ[index] - logPrior[index])))
    const elbo = reconLogLik - klToPrior
    const gap = logEvidence - elbo
    const klToPosterior = integrate(
      q.map((value, index) => value * (logQ[index] - logPosterior[index])),
    )
    const identityError = Math.abs(gap - klToPosterior)

    const likelihoodMax = Math.max(...likelihood)
    const visibleDensityMax = Math.max(...prior, ...q)
    const revealedDensityMax = Math.max(...prior, ...posterior, ...q)
    const likelihoodDisplayHidden = likelihood.map((value) => (value / likelihoodMax) * visibleDensityMax * 0.72)
    const likelihoodDisplayRevealed = likelihood.map((value) => (value / likelihoodMax) * revealedDensityMax * 0.72)
    const yMaxHidden = Math.max(visibleDensityMax, ...likelihoodDisplayHidden) * 1.08
    const yMaxRevealed = Math.max(revealedDensityMax, ...likelihoodDisplayRevealed) * 1.08

    return {
      prior,
      likelihoodDisplayHidden,
      likelihoodDisplayRevealed,
      posterior,
      q,
      reconLogLik,
      klToPrior,
      elbo,
      logEvidence,
      gap,
      klToPosterior,
      identityError,
      qMass,
      yMaxHidden,
      yMaxRevealed,
    }
  }, [mode, qMu, qStd, xObs])

  const scenarioKey = `${mode}:${xObs.toFixed(2)}:${qMu.toFixed(2)}:${qLogStd.toFixed(3)}`
  const isRevealed = revealedKey === scenarioKey && prediction !== null
  const expectedDiagnostic = classifyGapDiagnostic(mode, xObs, data.gap)
  const predictionCorrect = prediction === expectedDiagnostic
  const shapeDiagnostic = posteriorShape(mode, xObs)
  const plotLikelihoodDisplay = isRevealed ? data.likelihoodDisplayRevealed : data.likelihoodDisplayHidden
  const plotYMax = isRevealed ? data.yMaxRevealed : data.yMaxHidden
  const evidenceActiveIndex = isRevealed ? 3 : prediction ? 1 : 0
  const evidencePhase = VAE_EVIDENCE_STEPS[evidenceActiveIndex].label.toLowerCase()

  const resetReveal = (clearPrediction = true) => {
    if (clearPrediction) setPrediction(null)
    setRevealedKey(null)
    clearDemoState('vaes')
  }

  const updateMode = (value: DecoderMode) => {
    setMode(value)
    resetReveal()
  }

  const updateXObs = (value: number) => {
    setXObs(value)
    resetReveal()
  }

  const updateQMu = (value: number) => {
    setQMu(value)
    resetReveal()
  }

  const updateQLogStd = (value: number) => {
    setQLogStd(value)
    resetReveal()
  }

  const matchPosterior = () => {
    const postVar = SIGMA_X_VAR / (1 + SIGMA_X_VAR)
    const postMu = xObs / (1 + SIGMA_X_VAR)
    resetReveal()
    setQMu(Number(postMu.toFixed(3)))
    setQLogStd(Math.log(Math.sqrt(postVar)))
  }

  const focusPositiveCause = () => {
    resetReveal()
    setQMu(Math.sqrt(Math.max(xObs, 0)))
    setQLogStd(Math.log(0.28))
  }

  const focusNegativeCause = () => {
    resetReveal()
    setQMu(-Math.sqrt(Math.max(xObs, 0)))
    setQLogStd(Math.log(0.28))
  }

  const claim =
    expectedDiagnostic === 'tight'
      ? 'q is close enough to the true posterior that the ELBO is nearly tight.'
      : expectedDiagnostic === 'family-mismatch'
        ? 'Positive x has two separated plausible latent causes. Because the gap is KL(q || posterior), one Gaussian q often chooses one mode; the remaining gap shows the restricted q-family.'
        : mode === 'linear'
          ? 'The posterior is single-peaked here. Move q toward that hidden target or resize q to shrink the KL inference gap.'
          : 'Here the quadratic causes are not separated enough for family mismatch to be the main diagnosis; the gap mostly comes from q being shifted or scaled wrong.'

  const revealGap = () => {
    if (!prediction) return
    setRevealedKey(scenarioKey)
  }

  useEffect(() => {
    if (!isRevealed || !prediction) return

    emitDemoState({
      conceptId: 'vaes',
      label: 'VAE ELBO gap reveal',
      summary:
        `decoder=${mode}; x=${fmt(xObs)}; q=N(${fmt(qMu)}, ${fmt(qStd)}^2); ` +
        `prediction=${prediction}; actual=${expectedDiagnostic}; correct=${predictionCorrect ? 'yes' : 'no'}; ` +
        `log p(x)=${fmt(data.logEvidence)}; ELBO=${fmt(data.elbo)}; gap=${fmt(data.gap)}; ` +
        `KL(q||posterior)=${fmt(data.klToPosterior)}; identity error=${fmtErr(data.identityError)}.`,
      values: [
        'evidence loop: predict -> observe -> ground -> carry',
        `evidence phase=${evidencePhase}`,
        `decoder=${mode}`,
        `observed x=${fmt(xObs)}`,
        `q mean=${fmt(qMu)}`,
        `q std=${fmt(qStd)}`,
        `prediction=${prediction}`,
        `prediction label=${diagnosticLabel(prediction)}`,
        `actual diagnostic=${expectedDiagnostic}`,
        `actual label=${diagnosticLabel(expectedDiagnostic)}`,
        `prediction correct=${predictionCorrect ? 'yes' : 'no'}`,
        `posterior shape=${shapeDiagnostic}`,
        `E_q[log p_theta(x|z)]=${fmt(data.reconLogLik)}`,
        `KL(q||prior)=${fmt(data.klToPrior)}`,
        `ELBO=${fmt(data.elbo)}`,
        `log p(x)=${fmt(data.logEvidence)}`,
        `gap=${fmt(data.gap)}`,
        `KL(q||posterior)=${fmt(data.klToPosterior)}`,
        `identity error=${fmtErr(data.identityError)}`,
        `q grid mass=${fmt(data.qMass)}`,
      ],
    })
  }, [
    data.elbo,
    data.gap,
    data.identityError,
    data.klToPosterior,
    data.klToPrior,
    data.logEvidence,
    data.qMass,
    data.reconLogLik,
    evidencePhase,
    expectedDiagnostic,
    isRevealed,
    mode,
    prediction,
    predictionCorrect,
    qMu,
    qStd,
    shapeDiagnostic,
    xObs,
  ])

  useEffect(() => {
    clearDemoState('vaes')
    return () => clearDemoState('vaes')
  }, [])

  return (
    <div className="demo">
      <div className="controls" aria-label="VAE ELBO controls">
        <div className="modeButtons">
          <button type="button" aria-pressed={mode === 'linear'} onClick={() => updateMode('linear')}>
            linear decoder
          </button>
          <button type="button" aria-pressed={mode === 'two-causes'} onClick={() => updateMode('two-causes')}>
            quadratic decoder
          </button>
        </div>

        <label>
          <span>observed x</span>
          <input type="range" min="0.1" max="2.4" step="0.05" value={xObs} onChange={(event) => updateXObs(Number(event.target.value))} />
          <strong>{fmt(xObs)}</strong>
        </label>

        <label>
          <span>q mean mu_q</span>
          <input type="range" min="-2.5" max="2.5" step="0.02" value={qMu} onChange={(event) => updateQMu(Number(event.target.value))} />
          <strong>{fmt(qMu)}</strong>
        </label>

        <label>
          <span>q std sigma_q</span>
          <input type="range" min={Math.log(0.12)} max={Math.log(1.2)} step="0.02" value={qLogStd} onChange={(event) => updateQLogStd(Number(event.target.value))} />
          <strong>{fmt(qStd)}</strong>
        </label>

        {isRevealed ? (
          <div className="quickActions">
            {mode === 'linear' ? (
              <button type="button" onClick={matchPosterior}>
                match posterior
              </button>
            ) : (
              <>
                <button type="button" onClick={focusNegativeCause}>
                  choose -sqrt(x)
                </button>
                <button type="button" onClick={focusPositiveCause}>
                  choose +sqrt(x)
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="quickActions lockedAction">
            <span>alignment helpers hidden</span>
          </div>
        )}
      </div>

      <section
        className="predictionPanel"
        data-child-demo-gate="vae-elbo-gap-diagnostic"
        aria-label="VAE ELBO gap prediction"
      >
        <div className="predictionCopy">
          <span>predict the inference gap</span>
          <strong>What will the hidden ELBO gap diagnose for this q(z|x)?</strong>
          <p>
            The prior, likelihood shape, and approximate q are visible. The hidden target curve and ELBO numbers open only after you choose a diagnosis.
          </p>
        </div>
        <div className="choiceRow" role="group" aria-label="ELBO gap diagnostic choices">
          {DIAGNOSTIC_CHOICES.map((choice) => (
            <button
              key={choice.id}
              type="button"
              aria-pressed={prediction === choice.id}
              className={prediction === choice.id ? 'selected' : ''}
              onClick={() => {
                setPrediction(choice.id)
                resetReveal(false)
              }}
            >
              <strong>{choice.label}</strong>
              <span>{choice.description}</span>
            </button>
          ))}
        </div>
        <div className="evidenceStrip" aria-label="VAE evidence loop">
          {VAE_EVIDENCE_STEPS.map((step, index) => (
            <div
              key={step.label}
              className={`evidenceStep ${index === evidenceActiveIndex ? 'active' : ''} ${
                index < evidenceActiveIndex ? 'complete' : ''
              }`}
            >
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </div>
          ))}
        </div>
        <button type="button" className="reveal" disabled={prediction === null} onClick={revealGap}>
          Reveal ELBO gap
        </button>
      </section>

      <div className="top">
        <div className="plotPanel">
          <svg
            viewBox="0 0 720 320"
            role="img"
            aria-label={isRevealed ? 'Prior, likelihood shape, posterior, and approximate q over z' : 'Prior, likelihood shape, and approximate q over z'}
          >
            <title>{isRevealed ? 'VAE posterior and ELBO gap in a one-dimensional latent model' : 'VAE hidden-gap prediction setup in a one-dimensional latent model'}</title>
            <rect x="0" y="0" width="720" height="320" rx="8" fill="#fffdf8" />
            <line x1="46" y1="268" x2="692" y2="268" className="axis" />
            <line x1="360" y1="40" x2="360" y2="268" className="zero" />
            <text x="48" y="292" className="axisLabel">z = {Z_MIN}</text>
            <text x="346" y="292" className="axisLabel">0</text>
            <text x="642" y="292" className="axisLabel">z = {Z_MAX}</text>

            <Path values={data.prior} yMax={plotYMax} color="#8a98a8" />
            <Path values={plotLikelihoodDisplay} yMax={plotYMax} color="#b25f2c" dash="5 5" />
            {isRevealed ? <Path values={data.posterior} yMax={plotYMax} color="#205e63" width={3} /> : null}
            <Path values={data.q} yMax={plotYMax} color="#5f5aa2" width={3} />
          </svg>

          <div className="legend">
            <span><i style={{ background: '#8a98a8' }} /> prior p(z)</span>
            <span><i style={{ background: '#b25f2c' }} /> normalized likelihood shape</span>
            {isRevealed ? <span><i style={{ background: '#205e63' }} /> posterior p(z|x)</span> : null}
            <span><i style={{ background: '#5f5aa2' }} /> q(z|x)</span>
          </div>
        </div>

        <div className="identityPanel">
          <p className="eyebrow">ELBO identity</p>
          <div className="identity">
            <div>
              <span>log p(x)</span>
              <strong>{isRevealed ? fmt(data.logEvidence) : 'hidden'}</strong>
            </div>
            <b>=</b>
            <div>
              <span>ELBO</span>
              <strong>{isRevealed ? fmt(data.elbo) : 'hidden'}</strong>
            </div>
            <b>+</b>
            <div>
              <span>gap</span>
              <strong>{isRevealed ? fmt(data.gap) : 'hidden'}</strong>
            </div>
          </div>
          {isRevealed ? (
            <>
              <p className="claim">{claim}</p>
              <p className="diagnosis">
                Actual diagnosis: {diagnosticLabel(expectedDiagnostic)} | Your prediction:{' '}
                {prediction ? diagnosticLabel(prediction) : 'none'} | {predictionCorrect ? 'correct' : 'not this time'}
              </p>
              <div className="check">
                <span>gap</span>
                <strong>{fmt(data.gap)}</strong>
                <span>KL(q || posterior)</span>
                <strong>{fmt(data.klToPosterior)}</strong>
                <span>identity error</span>
                <strong>{fmtErr(data.identityError)}</strong>
              </div>
            </>
          ) : (
            <p className="claim lockedClaim">
              Commit to a diagnosis before opening the posterior curve, identity values, and KL check.
            </p>
          )}
        </div>
      </div>

      {isRevealed ? (
        <div className="metrics">
          {[
            ['E_q[log p_theta(x|z)]', data.reconLogLik],
            ['KL(q || prior)', data.klToPrior],
            ['ELBO', data.elbo],
            ['log p(x)', data.logEvidence],
            ['gap', data.gap],
            ['KL(q || p_theta(z|x))', data.klToPosterior],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{fmt(value as number)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="metrics lockedMetrics" aria-label="Hidden VAE ELBO diagnostics">
          {['reconstruction term', 'prior pressure', 'bound value', 'evidence value', 'gap size', 'target distance'].map((label) => (
            <div key={label}>
              <span>{label}</span>
              <strong>hidden</strong>
            </div>
          ))}
        </div>
      )}

      <p className="note">
        {isRevealed
          ? `The likelihood curve is normalized only for drawing. The numbers use the model density, prior, and approximate posterior on the z grid. Current q mass inside the grid is ${fmt(data.qMass)}.`
          : 'The likelihood curve is normalized only for drawing. Numerical ELBO diagnostics are hidden until reveal.'}
      </p>

      <style jsx>{`
        .demo {
          display: grid;
          gap: 0.85rem;
        }

        .controls,
        .predictionPanel,
        .plotPanel,
        .identityPanel,
        .metrics > div {
          min-width: 0;
          border: 1px solid rgba(25, 36, 48, 0.11);
          border-radius: 8px;
          background: rgba(255, 252, 246, 0.82);
        }

        .controls {
          display: grid;
          grid-template-columns: minmax(10rem, 0.85fr) repeat(3, minmax(0, 1fr)) minmax(9rem, 0.7fr);
          gap: 0.65rem;
          align-items: end;
          padding: 0.75rem;
        }

        .modeButtons,
        .quickActions {
          display: grid;
          gap: 0.4rem;
        }

        .predictionPanel {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.75fr) auto;
          grid-template-areas:
            'copy choices reveal'
            'evidence evidence evidence';
          gap: 0.75rem;
          align-items: center;
          padding: 0.75rem;
        }

        .predictionCopy {
          grid-area: copy;
          display: grid;
          gap: 0.28rem;
          min-width: 0;
        }

        .predictionCopy > span {
          color: #205e63;
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .predictionCopy strong {
          color: #1b2430;
          font-size: 0.92rem;
          line-height: 1.25;
        }

        .predictionCopy p {
          margin: 0;
          color: #4f5f6d;
          font-size: 0.8rem;
          line-height: 1.45;
        }

        .choiceRow {
          grid-area: choices;
          display: grid;
          gap: 0.42rem;
          min-width: 0;
        }

        button {
          min-height: 34px;
          border: 1px solid rgba(25, 36, 48, 0.14);
          border-radius: 8px;
          background: #fff8eb;
          color: #1b2430;
          padding: 0 0.7rem;
          font-size: 0.78rem;
          cursor: pointer;
          text-align: left;
        }

        .choiceRow button {
          display: grid;
          gap: 0.16rem;
          padding: 0.55rem 0.62rem;
          line-height: 1.25;
        }

        .choiceRow button span {
          color: #536170;
          font-size: 0.72rem;
        }

        button[aria-pressed='true'],
        button.selected {
          border-color: rgba(32, 94, 99, 0.55);
          background: rgba(224, 242, 238, 0.9);
        }

        .evidenceStrip {
          grid-area: evidence;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.44rem;
          min-width: 0;
          padding: 0.5rem;
          border: 1px solid rgba(25, 36, 48, 0.12);
          border-radius: 8px;
          background: #1b2430;
        }

        .evidenceStep {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.15rem 0.38rem;
          min-width: 0;
          padding: 0.48rem;
          border: 1px solid rgba(255, 250, 240, 0.12);
          border-radius: 7px;
          background: rgba(255, 250, 240, 0.06);
        }

        .evidenceStep span {
          display: inline-grid;
          width: 1.18rem;
          height: 1.18rem;
          place-items: center;
          border-radius: 999px;
          background: rgba(255, 250, 240, 0.12);
          color: #f8ead9;
          font-size: 0.68rem;
          font-weight: 800;
        }

        .evidenceStep strong,
        .evidenceStep small {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .evidenceStep strong {
          color: #fffaf0;
          font-size: 0.76rem;
          line-height: 1.2;
        }

        .evidenceStep small {
          grid-column: 1 / -1;
          color: #d4d1e7;
          font-size: 0.68rem;
          line-height: 1.35;
        }

        .evidenceStep.active {
          border-color: rgba(95, 90, 162, 0.72);
          background: rgba(95, 90, 162, 0.26);
        }

        .evidenceStep.active span,
        .evidenceStep.complete span {
          background: #5f5aa2;
          color: #fffaf1;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.48;
        }

        .reveal {
          grid-area: reveal;
          align-self: stretch;
          min-width: 8rem;
          background: #205e63;
          color: #fffaf1;
          font-weight: 780;
          text-align: center;
        }

        .lockedAction {
          min-height: 34px;
          align-items: center;
          color: #65717d;
          font-size: 0.74rem;
        }

        label {
          display: grid;
          gap: 0.35rem;
          color: #4f5f6d;
          font-size: 0.76rem;
        }

        input {
          width: 100%;
        }

        label strong,
        .metrics strong,
        .identity strong,
        .check strong {
          color: #1b2430;
          font-family: var(--font-mono);
        }

        .top {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(18rem, 0.65fr);
          gap: 0.75rem;
        }

        .plotPanel,
        .identityPanel {
          padding: 0.75rem;
        }

        svg {
          display: block;
          width: 100%;
          height: auto;
        }

        .axis,
        .zero {
          stroke: rgba(25, 36, 48, 0.24);
          stroke-width: 1;
        }

        .zero {
          stroke-dasharray: 4 5;
        }

        .axisLabel {
          fill: #71808f;
          font-size: 12px;
          font-family: var(--font-mono);
        }

        .legend {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem 0.85rem;
          margin-top: 0.6rem;
          color: #4f5f6d;
          font-size: 0.76rem;
        }

        .legend span {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }

        .legend i {
          display: inline-block;
          width: 0.75rem;
          height: 0.75rem;
          border-radius: 999px;
        }

        .eyebrow {
          margin: 0 0 0.55rem;
          color: #65717d;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .identity {
          display: grid;
          grid-template-columns: 1fr auto 1fr auto 1fr;
          gap: 0.5rem;
          align-items: center;
        }

        .identity div {
          min-width: 0;
          border: 1px solid rgba(25, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.65);
          padding: 0.55rem;
        }

        .identity span,
        .check span,
        .metrics span {
          display: block;
          color: #65717d;
          font-size: 0.7rem;
        }

        .identity b {
          color: #748290;
          font-family: var(--font-mono);
          font-weight: 600;
        }

        .claim {
          margin: 0.75rem 0;
          color: #273443;
          font-size: 0.88rem;
          line-height: 1.45;
        }

        .diagnosis {
          margin: -0.35rem 0 0.75rem;
          color: #205e63;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          line-height: 1.45;
        }

        .lockedClaim {
          color: #65717d;
        }

        .check {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.4rem 0.75rem;
          border-top: 1px solid rgba(25, 36, 48, 0.1);
          padding-top: 0.65rem;
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 0.6rem;
        }

        .metrics > div {
          padding: 0.65rem;
        }

        .lockedMetrics > div {
          background: rgba(248, 249, 246, 0.7);
        }

        .note {
          margin: 0;
          color: #65717d;
          font-size: 0.76rem;
          line-height: 1.45;
        }

        @media (max-width: 980px) {
          .controls,
          .predictionPanel,
          .top {
            grid-template-columns: 1fr;
          }

          .predictionPanel {
            grid-template-areas:
              'copy'
              'choices'
              'evidence'
              'reveal';
          }

          .reveal {
            justify-self: start;
            min-height: 2.6rem;
          }

          .metrics {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .evidenceStrip {
            grid-template-columns: 1fr;
          }

          .metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .identity {
            grid-template-columns: 1fr;
          }

          .identity b {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}

function Path({
  values,
  yMax,
  color,
  dash,
  width = 2,
}: {
  values: number[]
  yMax: number
  color: string
  dash?: string
  width?: number
}) {
  const path = values
    .map((value, index) => {
      const x = 46 + (index / (POINTS - 1)) * 646
      const y = 268 - (value / yMax) * 222
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')

  return <path d={path} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
}

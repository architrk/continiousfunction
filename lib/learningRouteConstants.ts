export const kvMemoryEquation = 'Mem_KV = B * N_layers * T * H_kv * d_head * 2 * bytes'

export const kvMemoryQuestion = 'Which KV-cache memory term is this method reducing?'

export const learningRoutePathAliases: Record<string, string> = {
  'kv-cache': 'kv-cache',
  'mamba-ssm': 'mamba',
  mamba: 'mamba',
  'preference-optimization': 'dpo',
  dpo: 'dpo',
  'muon-optimization': 'muon',
  muon: 'muon',
  'diffusion-flow': 'diffusion-flow',
}

export function normalizeLearningRoutePathId(value?: string) {
  return value ? learningRoutePathAliases[value] : undefined
}

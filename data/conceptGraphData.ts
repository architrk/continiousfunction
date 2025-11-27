export const conceptGraphData = {
  nodes: [
    { id: 'Optimizers Overview' },
    { id: 'SGD & Momentum' },
    { id: 'AdamW' },
    { id: 'RMSProp' },
    { id: 'Muon' }
  ],
  links: [
    { source: 'Optimizers Overview', target: 'SGD & Momentum' },
    { source: 'Optimizers Overview', target: 'AdamW' },
    { source: 'Optimizers Overview', target: 'RMSProp' },
    { source: 'Optimizers Overview', target: 'Muon' },
    { source: 'SGD & Momentum', target: 'AdamW' },
    { source: 'AdamW', target: 'Muon' }
  ]
}

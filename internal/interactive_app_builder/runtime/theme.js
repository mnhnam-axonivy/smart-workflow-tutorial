/**
 * Colours and metrics of the simulated Designer. Values were sampled from screenshots of the
 * Axon Ivy Designer (VS Code, dark theme) so the simulation reads like the real editor.
 */
export const theme = {
  canvas: '#1e1e1e',
  gridDot: '#4a4a4a',
  gridSpacing: 8,

  elementFill: '#202020',
  elementStroke: '#ffffff',
  label: '#ffffff',
  connector: '#ffffff',

  selection: '#2d66fe',
  handleStroke: '#d4d4d4',
  hover: '#6f93ff',
  executed: '#3e7145',
  active: '#5dc36a',
  error: '#f14c4c',
  breakpoint: '#e5484d',
  ghost: '#7a7a7a',
  ghostText: '#a8a8a8',

  scriptIconBg: '#d0e0fd',
  scriptIcon: '#4c82f5',
  agentIconBg: '#c8eddf',
  agentIconDark: '#1d4c81',
  agentIcon: '#2e74b8',

  card: '#252526',
  cardBorder: '#4a4a4a',
  cardText: '#e7e7e7',
  cardMuted: '#a3a3a3',
  toneSystem: '#c586c0',
  toneUser: '#4fc1ff',
  toneAssistant: '#5dc36a',
  toneModel: '#8b7cf6',
  toneTool: '#e8a23c',
  toneNeutral: '#a3a3a3',

  font: 'Arial, "Helvetica Neue", Helvetica, "Hiragino Sans", "Yu Gothic UI", Meiryo, sans-serif',
  uiFont: '"Segoe UI", system-ui, -apple-system, "Hiragino Sans", "Yu Gothic UI", Meiryo, sans-serif',
  labelSize: 12,
  lineHeight: 15
};

/** '#rrggbb' → [r, g, b] in 0..1, for shader uniforms. */
export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

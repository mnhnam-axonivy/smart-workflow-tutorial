/**
 * Line icons, drawn for this simulation (16×16, stroke = currentColor). They echo the kind
 * of icon the Designer uses in each place without copying its artwork.
 */
const PATHS = {
  // editor tabs
  process: '<circle cx="3.5" cy="4" r="1.6"/><circle cx="12.5" cy="4" r="1.6"/><circle cx="8" cy="12" r="1.6"/><path d="M5.1 4h5.8M4.4 5.3L7.2 10.6M11.6 5.3L8.8 10.6"/>',
  yaml: '<path d="M4 2.5h5l3 3V13.5H4z"/><path d="M9 2.5v3h3M6 8.5h4M6 10.8h4"/>',
  trace: '<path d="M2.6 3.6h7M4.6 6.6h8.8M6.6 9.6h4.6M4.6 12.6h6"/>',
  // toolbar
  pointer: '<path d="M4 2.6l7.6 4.6-3.3 1 1.9 3.5-1.5.8-1.9-3.5L4.4 11.4z"/>',
  marquee: '<path d="M2.5 5V3.2c0-.4.3-.7.7-.7H5M8 2.5h1.5M12.5 5V3.2c0-.4-.3-.7-.7-.7H11M2.5 8v1.5M2.5 12.3c0 .4.3.7.7.7H5M8 13H6.5"/><path d="M9.2 9.2l4.6 1.7-2 .8-.8 2z"/>',
  undo: '<path d="M5.4 3.6L2.6 6.4l2.8 2.8"/><path d="M2.9 6.4h6a3.4 3.4 0 010 6.8H7"/>',
  redo: '<path d="M10.6 3.6l2.8 2.8-2.8 2.8"/><path d="M13.1 6.4h-6a3.4 3.4 0 000 6.8H9"/>',
  list: '<path d="M2.6 4.2h10.8M2.6 8h10.8M2.6 11.8h10.8"/>',
  event: '<circle cx="8" cy="8" r="5.2"/>',
  callStart: '<circle cx="8" cy="8" r="6.4"/><path d="M6.2 4.6Q8 4.6 8 6.4V11.2M6.2 9.4L8 11.2 9.8 9.4"/>',
  callEnd: '<circle cx="8" cy="8" r="6.4" stroke-width="1.8"/><path d="M6.2 11.4Q8 11.4 8 9.6V4.8M6.2 6.6L8 4.8 9.8 6.6"/>',
  gateway: '<path d="M8 2.2L13.8 8 8 13.8 2.2 8z"/>',
  activity: '<rect x="2.8" y="2.8" width="10.4" height="10.4" rx="1.3"/>',
  artifact: '<rect x="2.4" y="3" width="11.2" height="10" rx="1.3"/><path d="M6.2 3v10"/>',
  extension: '<path d="M6.3 4.4V3.5a1.5 1.5 0 013 0v.9h3.2v3h-.9a1.5 1.5 0 000 3h.9v3.1H9.6v-.9a1.5 1.5 0 00-3 0v.9H3.5v-3.1h.9a1.5 1.5 0 000-3h-.9v-3z"/>',
  database: '<ellipse cx="7" cy="4.2" rx="4.4" ry="1.8"/><path d="M2.6 4.2v7c0 1 2 1.8 4.4 1.8M11.4 4.2v3M2.6 7.7c0 1 2 1.8 4.4 1.8"/><path d="M10 10.6h4M12 8.6v4"/>',
  settings: '<circle cx="8" cy="8" r="2"/><path d="M8 1.9v1.6M8 12.5v1.6M1.9 8h1.6M12.5 8h1.6M3.7 3.7l1.1 1.1M11.2 11.2l1.1 1.1M12.3 3.7l-1.1 1.1M4.8 11.2l-1.1 1.1"/>',
  panelRight: '<rect x="2.2" y="2.8" width="11.6" height="10.4" rx="1.4"/><path d="M9.8 2.8v10.4"/>',
  // quick actions
  trash: '<path d="M2.9 4.4h10.2M6.2 4.4V3h3.6v1.4M4.1 4.4l.6 8.2c0 .5.4.9.9.9h4.8c.5 0 .9-.4.9-.9l.6-8.2M6.7 6.9v4M9.3 6.9v4"/>',
  info: '<circle cx="8" cy="8" r="5.5"/><path d="M8 7.4v3.5"/><circle cx="8" cy="5.2" r=".5" fill="currentColor"/>',
  bug: '<path d="M5.4 7a2.6 2.6 0 015.2 0v2.6a2.6 2.6 0 01-5.2 0z"/><path d="M6.3 4.9a1.8 1.8 0 013.4 0M5.4 8.3H2.9M13.1 8.3h-2.5M5.6 10.6l-2 1.5M10.4 10.6l2 1.5M5.6 6.2L3.8 4.9M10.4 6.2l1.8-1.3"/>',
  wrap: '<path d="M2.6 2.6l3 3M5.8 3.2v2.6H3.2M13.4 2.6l-3 3M10.2 3.2v2.6h2.6M2.6 13.4l3-3M5.8 12.8v-2.6H3.2M13.4 13.4l-3-3M10.2 12.8v-2.6h2.6"/>',
  tag: '<path d="M2.7 2.7h4.9l5.7 5.7-4.9 4.9-5.7-5.7z"/><circle cx="5.5" cy="5.5" r=".9"/>',
  image: '<rect x="2.4" y="2.9" width="11.2" height="10.2" rx="1.4"/><circle cx="5.7" cy="6" r="1.1"/><path d="M2.8 11.4l3.2-2.9 2.3 2 2-1.7 2.9 2.6"/>',
  droplet: '<path d="M8 2.3c2.1 2.5 3.7 4.5 3.7 6.5a3.7 3.7 0 01-7.4 0c0-2 1.6-4 3.7-6.5z"/>',
  // run controls
  play: '<path d="M4.8 3l7.8 5-7.8 5z" fill="currentColor"/>',
  pause: '<path d="M5.6 3.6v8.8M10.4 3.6v8.8" stroke-width="2.2"/>',
  stop: '<rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor"/>',
  step: '<path d="M3.6 3.3l6 4.7-6 4.7z" fill="currentColor"/><path d="M12 3.4v9.2"/>',
  reset: '<path d="M3.3 8a4.7 4.7 0 109-1.9"/><path d="M12.9 2.6v3.6H9.3"/>',
  fast: '<path d="M2.8 3.6L7.6 8l-4.8 4.4zM8.4 3.6L13.2 8l-4.8 4.4z" fill="currentColor"/>',
  // canvas controls
  plus: '<path d="M8 3.2v9.6M3.2 8h9.6"/>',
  minus: '<path d="M3.2 8h9.6"/>',
  fit: '<path d="M2.8 5.8V3.4c0-.3.3-.6.6-.6h2.4M10.2 2.8h2.4c.3 0 .6.3.6.6v2.4M13.2 10.2v2.4c0 .3-.3.6-.6.6h-2.4M5.8 13.2H3.4c-.3 0-.6-.3-.6-.6v-2.4"/>',
  maximize: '<path d="M9.4 2.8h3.8v3.8M13 3L9 7M6.6 13.2H2.8V9.4M3 13l4-4"/>',
  minimize: '<path d="M13.2 6.6H9.4V2.8M9.6 6.4l3.6-3.6M2.8 9.4h3.8v3.8M6.4 9.6L2.8 13.2"/>',
  // misc
  chevronDown: '<path d="M4.2 6.2L8 10l3.8-3.8"/>',
  chevronRight: '<path d="M6.2 4.2L10 8l-3.8 3.8"/>',
  chevronLeft: '<path d="M9.8 4.2L6 8l3.8 3.8"/>',
  close: '<path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6"/>',
  search: '<circle cx="7.1" cy="7.1" r="4.1"/><path d="M10.2 10.2l3.2 3.2"/>',
  check: '<path d="M3.4 8.4l3 3 6.2-6.6"/>',
  help: '<circle cx="8" cy="8" r="5.5"/><path d="M6.3 6.4a1.8 1.8 0 113 1.4c-.7.5-1.3.9-1.3 1.7"/><circle cx="8" cy="11.2" r=".5" fill="currentColor"/>',
  code: '<path d="M5.6 4.6L2.4 8l3.2 3.4M10.4 4.6L13.6 8l-3.2 3.4M9 3.4L7 12.6"/>',
  warning: '<path d="M8 2.6l5.8 10.2H2.2z"/><path d="M8 6.6v3"/><circle cx="8" cy="11.3" r=".5" fill="currentColor"/>',
  error: '<circle cx="8" cy="8" r="5.5"/><path d="M6 6l4 4M10 6l-4 4"/>',
  bulb: '<path d="M5.4 9.6A3.9 3.9 0 118 10.6h0a3.9 3.9 0 002.6-1M6.4 12.2h3.2M7 13.8h2"/><path d="M6.4 10.4v1.8h3.2v-1.8"/>',
  chat: '<path d="M2.6 3.4h10.8v7.4H7.4L4.6 13v-2.2h-2z"/>',
  braces: '<path d="M6 2.8c-1.4 0-1.8.6-1.8 1.8v1.6c0 .9-.4 1.4-1.4 1.8 1 .4 1.4.9 1.4 1.8v1.6c0 1.2.4 1.8 1.8 1.8M10 2.8c1.4 0 1.8.6 1.8 1.8v1.6c0 .9.4 1.4 1.4 1.8-1 .4-1.4.9-1.4 1.8v1.6c0 1.2-.4 1.8-1.8 1.8"/>',
  spark: '<path d="M8 2.2v3M8 10.8v3M2.2 8h3M10.8 8h3M4.1 4.1l2 2M9.9 9.9l2 2M11.9 4.1l-2 2M6.1 9.9l-2 2"/>',
  arrowRight: '<path d="M2.8 8h10M9.4 4.4L13 8l-3.6 3.6"/>'
};

/** Inline SVG markup for an icon. */
export function svg(name, size = 16) {
  return '<svg class="icon" viewBox="0 0 16 16" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[name] || '') + '</svg>';
}

/** A <span> containing the icon. */
export function icon(name, size) {
  const span = document.createElement('span');
  span.className = 'i';
  span.innerHTML = svg(name, size);
  return span;
}

/** Small coloured tiles used next to element names (inscription header). */
export function elementGlyph(element) {
  const span = document.createElement('span');
  span.className = 'glyph glyph-' + (element.isAgent ? 'agent' : element.kind);
  if (element.isAgent) span.textContent = 'AI';
  else if (element.kind === 'script') span.innerHTML = svg('braces', 12);
  else if (element.kind === 'task') span.innerHTML = svg('list', 12);
  else if (element.type === 'CallSubStart') span.innerHTML = svg('callStart', 12);
  else if (element.type === 'CallSubEnd') span.innerHTML = svg('callEnd', 12);
  else if (element.shape === 'event') span.innerHTML = svg('event', 12);
  else if (element.shape === 'gateway') span.innerHTML = svg('gateway', 12);
  else span.innerHTML = svg('activity', 12);
  return span;
}

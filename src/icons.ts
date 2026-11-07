const paths: Record<string, string> = {
  mark:'<path d="M12 2v20M2 12h20M12 4l2.2 5.8L20 12l-5.8 2.2L12 20l-2.2-5.8L4 12l5.8-2.2Z"/><circle cx="12" cy="12" r="8"/>',
  steel:'<path d="m14.5 14.5 5.3-5.3 1.1-6.1-6.1 1.1-5.3 5.3m-2 1 6 6m-4.7-3.3-5.1 5.1a1.4 1.4 0 0 0 2 2l5.1-5.1M10 10l4 4"/>',
  book:'<path d="M12 5.5c-3-2.6-6-2.6-9-1V19c3-1.6 6-1.6 9 1 3-2.6 6-2.6 9-1V4.5c-3-1.6-6-1.6-9 1V20M6 8.5l3 .5m-3 3 3 .5m6-3.5 3-.5m-3 4 3-.5"/>',
  bag:'<path d="M8 7V5a4 4 0 0 1 8 0v2m-11 0h14l2 13H3L5 7Zm4 4 3 3 3-3m-3 3v3"/>',
  dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  install:'<path d="M12 3v11m-4-4 4 4 4-4M4 14v6h16v-6"/>',
  next:'<path d="M3 12h16m-6-6 6 6-6 6"/>',
  back:'<path d="M21 12H5m6-6-6 6 6 6"/>',
  zoom:'<circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 5 5M7.5 10h5M10 7.5v5"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  ember:'<path d="M11 22c-6-1-8-6-5-10 0 3 2 3 2 3C6 8 13 6 13 2c1 4 5 7 6 11 2 6-3 10-8 9Z"/><path d="M12 21c-3-2-1-5 1-7 0 2 4 4-1 7Z"/>',
  rime:'<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 5l3 3 3-3m-6 14 3-3 3 3"/>',
  storm:'<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
  mend:'<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5Z"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 4v3"/>',
  shield:'<path d="M12 2l8 4v6c0 5-4 8-8 10-4-2-8-5-8-10V6l8-4Zm0 5v10m-4-5h8"/>'
};
export function icon(name: string): string {
  return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] ?? paths.mark) + '</svg>';
}

// Fixed SVG artwork shared by map markers, the layer legend, and result lists.
const artwork:Record<string,string>={
 'Power outages':'<path d="m13 2-9 12h7l-1 8 10-12h-7zM3 3l18 18"/>',
 'Wildfire incidents':'<path d="M12 2c3 5-2 7 2 10l3-5c5 6 5 14-5 15C2 21 3 13 7 9c-1 4 2 5 3 3 2-3 2-6 2-10z"/>',
 'Crossing status':'<path d="M3 8h18v7H3zM6 15v6M18 15v6M7 8l5 7M13 8l5 7M12 2v3"/>',
 'Stream & rain gauges':'<path d="M3 16c3-4 6 4 9 0s6 4 9 0M3 21c3-4 6 4 9 0s6 4 9 0M12 2c-2 3-4 5-4 7a4 4 0 0 0 8 0c0-2-2-4-4-7z"/>',
 'Hazard profiles':'<path d="m12 3 10 18H2zM12 9v5M12 17h.01"/>',
 'Fire stations':'<path d="M3 21V9l9-6 9 6v12H3M8 21v-7h8v7M9 9h6"/>',
 'EMS stations':'<path d="M3 21V8h18v13M9 21v-6h6v6M12 3v8M8 7h8"/>',
 'Police & sheriff':'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 11h8M12 7v8"/>',
 'Emergency districts':'<path d="m3 5 6-2 6 3 6-2v16l-6 2-6-3-6 2zM9 3v16M15 6v16"/>',
 'Water providers':'<path d="M12 2C9 7 5 10 5 15a7 7 0 0 0 14 0c0-5-4-8-7-13M8 16h8"/>',
 'Wastewater providers':'<path d="M3 4v7h7v5h11M6 4v4h7v5h8M3 20h18"/>',
 'Power & communications':'<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
 'Food & supplies':'<path d="M3 3h2l2.4 12h11.2L21 7H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
 Medical:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
 Fuel:'<path d="M3 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 11h11M1 21h15M17 5l3 3v9a2 2 0 0 1-4 0v-4h-2"/>',
 'Public services':'<path d="m3 8 9-5 9 5M3 9h18M5 9v10M10 9v10M14 9v10M19 9v10M3 21h18"/>',
 'Gathering places':'<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a5 5 0 0 1 10 0v3M16 4a3 3 0 0 1 0 6M16 13a5 5 0 0 1 5 5v3"/>',
 '311 reports':'<path d="M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4Z"/><path d="M8 9h8M8 13h5"/>',
 'Traffic incidents':'<path d="m5 8 2-5h10l2 5M3 9h18v9H3zM5 18v3M19 18v3M6 13h2M16 13h2"/>',
 'Fire incidents':'<path d="M12 2c1 5 5 5 5 9l3-3c3 7-1 14-8 14S1 15 5 9c1 3 3 3 3 3 0-4 4-6 4-10Z"/>',
 'Property records':'<path d="m3 10 9-7 9 7v11H3zM9 21v-8h6v8"/>',
 'Crime reports':'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM12 8v5M12 17h.01"/>',
 'FEMA floodplains':'<path d="M3 7c3-3 3 3 6 0s3 3 6 0 3 3 6 0M3 12c3-3 3 3 6 0s3 3 6 0 3 3 6 0M3 17c3-3 3 3 6 0s3 3 6 0 3 3 6 0"/>',
 'Austin modeled floodplains':'<path d="M12 2c-2 4-7 8-7 13a7 7 0 0 0 14 0c0-5-5-9-7-13Z"/><path d="M8 16c2-2 2 2 4 0s2 2 4 0"/>',
 'Low-water crossings':'<path d="M3 12h18M5 12V7M19 12V7M5 7c4 6 10 6 14 0M3 18c3-3 3 3 6 0s3 3 6 0 3 3 6 0"/>',
 Observation:'<path d="M4 3h16v12l-6 6H4zM14 21v-6h6M8 8h8M8 12h4"/>'
};
export function categoryIconSvg(category:string){return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${artwork[category]||artwork.Observation}</svg>`;}
export function CategoryIcon({category,color}:{category:string;color?:string}){return <span className="category-icon" style={{color}} aria-hidden="true" dangerouslySetInnerHTML={{__html:categoryIconSvg(category)}}/>;}

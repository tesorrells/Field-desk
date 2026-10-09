export const layerGroups=[
 {name:'Resources & gathering places',layers:['Food & supplies','Medical','Fuel','Public services','Gathering places']},
 {name:'Emergency services',layers:['Fire stations','EMS stations','Police & sheriff','Emergency districts']},
 {name:'Utilities & communications',layers:['Radio repeaters','Power outages','Water providers','Wastewater providers','Power & communications']},
 {name:'Cameras & surveillance',layers:['ALPR cameras']},
 {name:'Reports & incidents',layers:['311 reports','Traffic incidents','Fire incidents','Crime reports']},
 {name:'Property records',layers:['Property records']},
 {name:'Terrain & hazards',layers:['Wildfire incidents','Crossing status','Stream & rain gauges','Hazard profiles','FEMA floodplains','Austin modeled floodplains','Low-water crossings']},
];
export const categories=layerGroups.flatMap(g=>g.layers);
export function toggleGroup(enabled:string[],layers:string[]){return layers.every(c=>enabled.includes(c))?enabled.filter(c=>!layers.includes(c)):[...new Set([...enabled,...layers])];}

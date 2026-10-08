import type {Bounds} from './area-cache';
// Discovery extents select candidate sources, never establish legal jurisdiction.
export const localSourcePacks=[
 {id:'travis',countyFips:'48453',name:'Travis County',bounds:[30.05,-98.2,30.65,-97.35] as Bounds,portal:'https://gis.traviscountytx.gov/',parcel:true},
 {id:'hays',countyFips:'48209',name:'Hays County',bounds:[29.7,-98.3,30.37,-97.72] as Bounds,portal:'https://hays-county-haysgis.hub.arcgis.com/',parcel:true},
];
export const overlaps=(a:Bounds,b:Bounds)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
export function packsForArea(b:Bounds){return localSourcePacks.filter(p=>overlaps(p.bounds,b));}
export const haysRoot='https://services5.arcgis.com/bVphnK8rPe5MHUSr/arcgis/rest/services/';
export const haysSources={parcels:haysRoot+'Hays_County_Parcels/FeatureServer/0',closures:haysRoot+'RoadClosures_public_70230bed27084a58bcf6ebad428b8a2a/FeatureServer/0'};
export const pucViewer='https://www.puc.texas.gov/industry/water/utilities/map.aspx';
const pucRoot='https://services6.arcgis.com/N6Lzvtb46cpxThhu/arcgis/rest/services/';
export const pucSources={water:pucRoot+'Water_CCN_Service_Areas/FeatureServer/210',sewer:pucRoot+'Sewer_CCN_Service_Areas/FeatureServer/230'};
export const haysLinks=[
 {name:'Emergency notices & official maps',url:'https://www.haysinformed.com/',note:'County emergency-management notices, closure maps and alert registration.'},
 {name:'Fire / EMS district directory & maps',url:'https://www.hayscountytx.gov/346/Emergency-Services-Districts',note:'Wimberley fire: ESD 4; EMS: ESD 7. Verify the exact address with the agency; automatic response-boundary matching is not connected.'},
 {name:'Wimberley emergency contacts',url:'https://cityofwimberley.com/QuickLinks.aspx?CID=45',note:'Published non-emergency contacts: sheriff 512-393-7896, fire 512-847-3536, EMS 512-847-2526. Checked October 7, 2026.'},
 {name:'Wimberley utilities',url:'https://www.cityofwimberley.com/198/Utilities',note:'PEC electricity, Wimberley Water Supply and Aqua Texas resources. Confirm your provider from your bill; a county match does not assign an account.'},
 {name:'Wimberley Water Supply',url:'https://wimberleywatersupplycorp.com/',note:'Provider notices and contacts. Live water-service status is not connected.'},
 {name:'Pedernales Electric Cooperative',url:'https://www.pec.coop/',note:'Provider resources. PEC outage data is not automatically collected.'},
 {name:'Hays road closures',url:'https://www.haysinformed.com/maps/roadclosuresmaps',note:'Map loads official closure/block points. Open this complete map for closure lines, detours and road hazards.'},
];

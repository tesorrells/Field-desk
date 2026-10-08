import {cachedCondition} from '../../../lib/conditions-storage';
import {fetchAirNow} from '../../../lib/air-quality';
export async function GET(){return Response.json(await cachedCondition('airnow-austin-v1',900000,()=>fetchAirNow()),{headers:{'Cache-Control':'no-store'}});}

import {cachedCondition} from '../../../lib/conditions-storage';
import {fetchBluebonnet,fetchManorWater,fetchDistrictResources} from '../../../lib/lifelines';
export async function GET(){const [power,water,wilbarger]=await Promise.all([cachedCondition('bluebonnet-outages-v1',120000,()=>fetchBluebonnet()),cachedCondition('manor-water-notices-v1',300000,()=>fetchManorWater()),cachedCondition("wilbarger-creek-mud1-resources-v2",1800000,()=>fetchDistrictResources())]);return Response.json({power,water,wilbarger},{headers:{'Cache-Control':'no-store'}});}

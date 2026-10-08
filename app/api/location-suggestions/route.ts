import {configuredLocations} from '../../../lib/private-location-config';
export async function GET(){try{return Response.json({suggestions:configuredLocations()},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({suggestions:[],warning:'Private location configuration could not be read.'},{headers:{'Cache-Control':'no-store'}});}}

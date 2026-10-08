import {env} from './runtime-env';
import {z} from 'zod';
import {pointSchema} from './location-core';
export const configuredLocationsSchema=z.array(z.object({name:z.string().min(1).max(160),kind:z.enum(['Work','Bug out','Other']),address:z.string().max(300),point:pointSchema.optional(),sourceNote:z.string().max(500).optional()})).max(20);
export function configuredLocations(){const raw=(env as unknown as Record<string,string>).STUDY_STARTER_LOCATIONS;return raw?configuredLocationsSchema.parse(JSON.parse(raw)):[];}

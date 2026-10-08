import {env as local} from './local-env.mjs';
import type {StudyDatabase} from './storage-contract';
export const env={get DB(){return local.DB as unknown as StudyDatabase;},get OSRM_BASE_URL(){return local.OSRM_BASE_URL;}};

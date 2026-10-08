import {env} from './runtime-env';
import type {StudyDatabase} from './storage-contract';
export function storage():StudyDatabase {if(!env.DB)throw Error('Study storage is unavailable');return env.DB as unknown as StudyDatabase;}

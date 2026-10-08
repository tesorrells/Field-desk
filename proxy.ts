import {NextResponse,type NextRequest} from 'next/server';
import {localRequestAllowed} from './lib/local-request';
export function proxy(request:NextRequest){if(process.env.AREA_STUDY_LOCAL==='1'&&!localRequestAllowed(request))return new NextResponse('Local access only.',{status:403});return NextResponse.next();}

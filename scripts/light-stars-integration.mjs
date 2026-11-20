import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {sha256} from './resource-protocol.mjs';

export const LIGHT_REVISION='85163534ccae2b023928c877e002581a8f35f0cb';
export const LIGHT_INTEGRATION='light-stars-persist-v1';
export const LIGHT_APP_SHA256='50900439da27dad2faaef1ffabaa2e8c5461bf0c5aadf80f40014a40564e312b';

export function adaptLightStars(bytes) {
 if(sha256(bytes)!==LIGHT_APP_SHA256)throw Error('Unreviewed Light app bytes');
 const text=bytes.toString('utf8');
 const before='        state.stars[level.id] = stars;\n        rememberStars(level.id, stars);';
 if(text.split(before).length!==2)throw Error('Light stars save marker changed');
 // state.stars aliases store.data.stars. Mutating it first makes updateStars
 // believe there is no improvement and skip persistence.
 return Buffer.from(text.replace(before,'        rememberStars(level.id, stars);'));
}

export function integrateLightResource(source,directory) {
 if(source.id!=='light'||source.revision!==LIGHT_REVISION||source.resourceIntegration!==LIGHT_INTEGRATION)throw Error('Unreviewed Light resource identity');
 const file=join(directory,'scripts','app.js');writeFileSync(file,adaptLightStars(readFileSync(file)));
}

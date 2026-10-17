import {createCatalogAuthority} from './catalog-authority.mjs';
// Public SPKI only, byte-identical to the reviewed Android public DER. No secret.
export const PINNED_KEY_ID='resources-20261008';
export const PINNED_SPKI_BASE64='MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAzEvGahm9BAL5wbcq4urM62j6X/Q8X6wzZy/yJxE21V0ly8q3yny8Cw30Nwro033Y2lHOJMm9nINQVoAdSWOe3NOvYNCe8CULZTgQuHqLepPPRYs+IjdBlpIWC0ONyG4V8c7M0STucNGQ6SSnL+LxEU8XMknslYD7/7MHWL5rJiC4ZiKz0yzi1Rz0QmPTkVW0TEMtryrOvsiMGuKH4xk388+Fs6WLp+J13T6hHyMFLVGJrbDYkIdjq2hevbV5TOtDXv5kGsMAcqthWxG4NogznndCxFJPXxS9Cp/b066ZeHIAHajMC69JV3W2wn9G5VBBK9MOoNjzGerIUBJbqkKJoGNjTFT5GZIZjWBaiEF5tIrP7XSwCmyrg8Cazt3xYSA4B3QvEa9VAa5xUMqjU2gUde1VT+jUsOFegs+Jw3mhKjwsFMeSGBD/aFgJB524810pSNPPdmUbNZVwWyk/N2cck0afZ92cgooS1OPNiIdKUVydV/bBdSy1yDhCPpRU/TbJAgMBAAE=';
export function createPinnedAuthority(options){
  if(!options||Object.keys(options).length!==2||!Object.hasOwn(options,'origin')||!Object.hasOwn(options,'basePath'))throw Error('Production trust is fixed');
  return createCatalogAuthority({spki:Uint8Array.from(atob(PINNED_SPKI_BASE64),c=>c.charCodeAt(0)),keyId:PINNED_KEY_ID,origin:options.origin,basePath:options.basePath,crypto:globalThis.crypto});
}

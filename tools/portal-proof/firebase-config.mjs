const loopback=value=>typeof value==='string'&&/^(127\.0\.0\.1|localhost):([1-9][0-9]{0,4})$/.test(value)&&Number(value.split(':')[1])<=65535;
// Configuration references only. Do not accept service-account JSON or keys here.
export function firebaseConfiguration(config,env=process.env) {
  if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(x=>!['projectId','productId','databaseId','mode'].includes(x))||
    typeof config.projectId!=='string'||!/^[a-z][a-z0-9-]{5,29}$/.test(config.projectId)||
    typeof config.productId!=='string'||!/^[a-z][a-z0-9-]{1,62}$/.test(config.productId)||
    typeof config.databaseId!=='string'||!(/^\(default\)$/.test(config.databaseId)||/^[a-z][a-z0-9-]{2,62}$/.test(config.databaseId))||!['emulator','live'].includes(config.mode))throw Error('INVALID_CONFIGURATION');
  const hosts=[env.FIREBASE_AUTH_EMULATOR_HOST,env.FIRESTORE_EMULATOR_HOST];
  if(config.mode==='emulator') {
    if(!config.projectId.startsWith('demo-')||!hosts.every(loopback))throw Error('ISOLATED_EMULATORS_REQUIRED');
  } else if(config.projectId.startsWith('demo-')||hosts.some(x=>x!==undefined))throw Error('EMULATOR_ENVIRONMENT_FORBIDDEN');
  return Object.freeze({...config});
}

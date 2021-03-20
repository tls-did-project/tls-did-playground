import { rootCertificates } from 'tls';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { TLSDID } from '@digitalcredentials/tls-did';
import { getResolver } from '@digitalcredentials/tls-did-resolver';
import { Resolver } from 'did-resolver';
import localEnv from '../environment.json';
import publicEnv from '../publicEnv.json';

//To start the testnet: npm run testnet
//To deploy registry: npm run deployRegistry

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//Registry address has to be updated to registry contract address
//For testing we use ganache-cli
console.log('Example TLS-DID flow');

let REGISTRY;
let jsonRpcUrl;
let etherPrivateKey;

//setEnvironment reads the config file an sets local constants
function setEnvironment(config) {
  REGISTRY = config.registryAddress;
  etherPrivateKey = config.privateKey;
  jsonRpcUrl = config.rpcUrl;
}

setEnvironment(localEnv);

//Address of registry contract on local or public testnet
console.log('REGISTRY:', REGISTRY);

//Private ethereum key to create / register / updated TLS-DID contract
console.log('Ethereum private key:', etherPrivateKey);

//Setup ethereum provider
console.log('Json Rpc Url:', jsonRpcUrl);

//Private TLS key for signing
const pemKeyPath = '/ssl/private/privKey.pem';
const pemKey = readFileSync(__dirname + pemKeyPath, 'utf8');
console.log('TLS pem key: \n', `${pemKey.substring(0, 64)}...`);

//Setup TLS-DID object
const domain = 'tls-did.de';
const tlsDid = new TLSDID(domain, etherPrivateKey, {
  registry: REGISTRY,
  providerConfig: {
    rpcUrl: jsonRpcUrl,
  },
});

//Register ethereum account as claimant of TLS-DID identity (domain)
console.log('Register as claimant');
await tlsDid.register();
console.log('Is registered:', tlsDid.registered);

//Register TLS pem cert chain
//Registering is needed for the full chain except the root certificate
const certPath = '/ssl/certs/cert.pem';
const cert = readFileSync(__dirname + certPath, 'utf8');
const intermediateCertPath = '/ssl/certs/intermediateCert.pem';
const intermediateCert = readFileSync(__dirname + intermediateCertPath, 'utf8');
const chain = [cert, intermediateCert];
console.log(
  'Adding cert chain:',
  chain.map((cert) => `${cert.substring(0, 64)}...`)
);
await tlsDid.addChain(chain);

//Add attributes to DID Document (path, value)
console.log('Adding example attribute to DID Document');
//Adds {parent: {child: value}}
await tlsDid.addAttribute('parent/child', 'value');
//Adds {array: [{element: value}]}
await tlsDid.addAttribute('arrayA[0]/element', 'value');
//Adds {array: [value]}
await tlsDid.addAttribute('arrayB[0]', 'value');
//Add assertionMethod to DID Document
console.log('Adding assertionMethod to DID Document');
await tlsDid.addAttribute('assertionMethod[0]/id', `did:tls:${domain}#keys-2`);
await tlsDid.addAttribute('assertionMethod[0]/type', 'Ed25519VerificationKey2018');
await tlsDid.addAttribute('assertionMethod[0]/controller', `did:tls:${domain}`);
await tlsDid.addAttribute('assertionMethod[0]/publicKeyBase58', 'H3C2AVvLMv6gmMNam3uVAjZpfkcJCwDwnZn6z3wXmqPV');

//Add expiry to TLS-DID contract
console.log('Setting expiry');
await tlsDid.setExpiry(new Date('2040/12/12'));

//Add expiry to TLS-DID contract
console.log('Signing written data');
await tlsDid.sign(pemKey);

//Setup resolver
console.log('Resolving DID Document for did:', `did:tls:${domain}`);
const tlsResolver = getResolver(
  {
    rpcUrl: jsonRpcUrl,
  },
  REGISTRY,
  rootCertificates
);
const resolver = new Resolver({ ...tlsResolver });

//Resolve DID Document
try {
  const didDocument = await resolver.resolve(`did:tls:${tlsDid.domain}`);
  console.log('DID Document:', didDocument);
} catch (err) {
  console.error('Error while resolving did.', err.data);
}

//Delete TLS-DID
console.log('Deleting TLS-DID');
await tlsDid.delete();

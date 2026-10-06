/**
 * The only route name while `Register` names no Beacon. No route is called
 * this, so a route name a developer writes fails to compile and TypeScript
 * prints the fix as the type it expected.
 */
export type UnregisteredRouteName =
  'Register your Beacon: declare module "@priemskiyyy/beacon-react" { interface Register { beacon: typeof beacon } }';

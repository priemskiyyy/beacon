/** What an identity written as a text stands for on one route: who assigns it, and what it names, or `null` where the route says no domain. */
export type IdentityShorthand = {
  authority: string;
  domain: string | null;
};

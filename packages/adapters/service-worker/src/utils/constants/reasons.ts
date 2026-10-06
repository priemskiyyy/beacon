/** Why an activation is unsupported: no worker is registered for this page. */
export const NO_REGISTRATION = "no-registration";

/** Why a reload is unsupported: there is no browser document to reload. */
export const NO_DOCUMENT = "no-document";

/** The first worker of a registration is being installed, which is not an update. */
export const FIRST_INSTALL = "first-install";

/** A newer worker is installing and is not ready to activate yet. */
export const INSTALLING = "installing";

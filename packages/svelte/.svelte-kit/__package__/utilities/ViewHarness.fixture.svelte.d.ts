import type { RegisteredBeacon } from "../types/Register.js";
type Props = {
    beacon: RegisteredBeacon;
    start?: boolean | undefined;
    read: () => void;
};
declare const ViewHarness: import("svelte").Component<Props, {}, "">;
type ViewHarness = ReturnType<typeof ViewHarness>;
export default ViewHarness;

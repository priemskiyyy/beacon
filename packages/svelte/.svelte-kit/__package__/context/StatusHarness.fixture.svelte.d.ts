import type { RegisteredBeacon } from "../types/Register.js";
type Props = {
    beacon: RegisteredBeacon;
    seen?: string[] | undefined;
};
declare const StatusHarness: import("svelte").Component<Props, {}, "">;
type StatusHarness = ReturnType<typeof StatusHarness>;
export default StatusHarness;

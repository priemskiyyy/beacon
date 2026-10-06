import type { Compatibility } from "src/types/Compatibility";
import type { ReleaseIdentity } from "src/types/ReleaseIdentity";

/**
 * A release an authority names: its identity, and optionally a label for
 * people, what it is compatible with, and validated application metadata.
 * `metadata` is data, never configuration, and diagnostics leave it out.
 *
 * @example
 * ```ts
 * const release: Release<{ notes: string }> = {
 *   identity: { status: "known", authority: "com.example.notes", domain: "web-artifact", value: "web-build-a" },
 *   label: "September recovery release",
 *   metadata: { notes: "recovery-208" },
 * };
 * ```
 */
export type Release<TMetadata extends object | null = null> = {
  identity: ReleaseIdentity;
  label?: string;
  compatibility?: Compatibility;
  metadata?: TMetadata;
};

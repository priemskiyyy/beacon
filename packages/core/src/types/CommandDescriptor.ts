import type { CommandRunContext } from "src/types/CommandRunContext";
import type { Impact } from "src/types/Impact";
import type { ProviderResult } from "src/types/ProviderResult";
import type { RouteBody } from "src/types/RouteBody";
import type { TargetBinding } from "src/types/TargetBinding";

type CommandDeclaration = {
  impacts: Impact[];
  binding: TargetBinding;
};

/**
 * One command a route offers, declared before it can be called: which
 * reference it needs (`offer`, `prepared`, an optional offer or none), what it
 * can do to the running application, and how tightly it is bound. `run`
 * dispatches once and reports the provider's evidence. The route facade always
 * enters Beacon's admission first, so a typed `route.requestReload()` can never
 * bypass a guard or the journal.
 *
 * @example
 * ```ts
 * const requestReload: CommandDescriptor<Browser, RouteBody, RouteBody, Record<never, never>, ReloadReceipt> = {
 *   reference: "offer",
 *   impacts: ["document-replacement"],
 *   binding: "unpinned-navigation",
 *   run: async ({ native }) => {
 *     native.reload();
 *
 *     return { status: "accepted", receipt: { kind: "reload-requested" } };
 *   },
 * };
 * ```
 */
export type CommandDescriptor<
  TNative,
  TOffer extends RouteBody,
  TPrepared extends RouteBody,
  TParameters extends object,
  TReceipt extends { kind: string },
> =
  | (CommandDeclaration & {
      reference: "offer";
      run(
        context: CommandRunContext<TNative, TParameters> & { offer: TOffer },
      ): Promise<ProviderResult<TReceipt>>;
    })
  | (CommandDeclaration & {
      reference: "prepared";
      run(
        context: CommandRunContext<TNative, TParameters> & {
          prepared: TPrepared;
        },
      ): Promise<ProviderResult<TReceipt>>;
    })
  | (CommandDeclaration & {
      reference: "optional-offer";
      run(
        context: CommandRunContext<TNative, TParameters> & {
          offer: TOffer | null;
        },
      ): Promise<ProviderResult<TReceipt>>;
    })
  | (CommandDeclaration & {
      reference: "none";
      run(
        context: CommandRunContext<TNative, TParameters>,
      ): Promise<ProviderResult<TReceipt>>;
    });

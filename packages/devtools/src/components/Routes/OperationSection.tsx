import { Field } from "src/components/shared/Field";
import { Fields } from "src/components/shared/Fields";
import { Section } from "src/components/shared/Section";
import { formatOptionalText } from "src/formatting/formatOptionalText";
import type { ObservedRouteSnapshot } from "src/types/internal/ObservedRouteSnapshot";
import { assertUnreachable } from "src/utils/assertUnreachable";
import { boundText } from "src/utils/boundText";

type OperationSectionProps = {
  operation: ObservedRouteSnapshot["operation"];
};

/** The command the route is carrying out. Indeterminate means it may have taken effect, so nothing retries it blindly. */
export const OperationSection = (props: OperationSectionProps) => (
  <Section title="Operation">
    {(() => {
      const { operation } = props;

      if (operation.state === "idle") {
        return (
          <Fields>
            <Field label="State">idle</Field>
          </Fields>
        );
      }

      if (operation.state === "running") {
        return (
          <Fields>
            <Field label="State">running</Field>
            <Field label="Command">{boundText(operation.command)}</Field>
            <Field label="Operation">{operation.operation.id}</Field>
            <Field label="Progress">
              {operation.progress === null
                ? "not reported"
                : `${Math.round(operation.progress * 100)}%`}
            </Field>
          </Fields>
        );
      }

      if (operation.state === "indeterminate") {
        return (
          <Fields>
            <Field label="State">indeterminate</Field>
            <Field label="Command">{boundText(operation.command)}</Field>
            <Field label="Operation">{operation.operation.id}</Field>
            <Field label="Reason">{formatOptionalText(operation.reason)}</Field>
          </Fields>
        );
      }

      return assertUnreachable(operation);
    })()}
  </Section>
);

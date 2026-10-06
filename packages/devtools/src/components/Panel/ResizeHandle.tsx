import type { PanelPosition } from "src/types/internal/PanelPosition";
import { PANEL_SIZE } from "src/utils/constants/defaults";

type ResizeHandleProps = {
  position: PanelPosition;
  size: number;
  onSizeChange: (size: number) => void;
};

/** The panel's free edge: drag it, or focus it and use the arrow keys. */
export const ResizeHandle = (props: ResizeHandleProps) => {
  // The window along the docked edge, less a margin, is as large as the panel gets.
  const maxSize = () => {
    const available =
      props.position === "bottom" ? window.innerHeight : window.innerWidth;

    return available - PANEL_SIZE.margin;
  };

  const resizeTo = (size: number) => {
    props.onSizeChange(Math.min(Math.max(size, PANEL_SIZE.min), maxSize()));
  };

  // Dragging the handle away from its edge grows the panel on either axis.
  const dragDistance = (start: PointerEvent, move: PointerEvent) => {
    if (props.position === "bottom") {
      return start.clientY - move.clientY;
    }

    return start.clientX - move.clientX;
  };

  const startDrag = (event: PointerEvent & { currentTarget: HTMLElement }) => {
    const handle = event.currentTarget;
    const startSize = props.size;

    const drag = (move: PointerEvent) => {
      resizeTo(startSize + dragDistance(event, move));
    };

    const endDrag = () => {
      handle.removeEventListener("pointermove", drag);
      handle.removeEventListener("pointerup", endDrag);
      handle.removeEventListener("pointercancel", endDrag);
    };

    handle.setPointerCapture(event.pointerId);
    handle.addEventListener("pointermove", drag);
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  };

  const resizeByKey = (event: KeyboardEvent) => {
    const grow = props.position === "bottom" ? "ArrowUp" : "ArrowLeft";
    const shrink = props.position === "bottom" ? "ArrowDown" : "ArrowRight";

    if (event.key === grow) {
      event.preventDefault();
      resizeTo(props.size + PANEL_SIZE.step);

      return;
    }

    if (event.key !== shrink) {
      return;
    }

    event.preventDefault();
    resizeTo(props.size - PANEL_SIZE.step);
  };

  return (
    <div
      class="resize"
      data-position={props.position}
      role="separator"
      aria-orientation={props.position === "bottom" ? "horizontal" : "vertical"}
      aria-label="Resize devtools"
      aria-valuemin={PANEL_SIZE.min}
      aria-valuemax={maxSize()}
      aria-valuenow={props.size}
      tabIndex={0}
      onPointerDown={startDrag}
      onKeyDown={resizeByKey}
    />
  );
};

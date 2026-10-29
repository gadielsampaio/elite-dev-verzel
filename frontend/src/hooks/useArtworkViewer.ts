import { useEffect, useRef, useState } from "react";
export function useArtworkViewer(imageUrl: string) {
  const scene = useRef<HTMLDivElement>(null),
    figure = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [imageUrl]);
  const target = useRef({ x: 0, y: 0, z: 1, panX: 0, panY: 0 });
  const dragged = useRef(false);
  const schedule = useRef(() => {});
  useEffect(() => {
    target.current.z = zoom;
    target.current.x = target.current.y = 0;
    if (zoom === 1) target.current.panX = target.current.panY = 0;
    schedule.current();
  }, [zoom]);
  function resetView() {
    target.current = { x: 0, y: 0, z: 1, panX: 0, panY: 0 };
    setZoom(1);
    schedule.current();
  }
  useEffect(() => {
    const element = scene.current!,
      image = figure.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      x = 0,
      y = 0,
      z = 1;
    let drag: {
      id: number;
      x: number;
      y: number;
      panX: number;
      panY: number;
    } | null = null;
    function draw() {
      frame = 0;
      const ease = reduced.matches ? 1 : 0.13;
      x += (target.current.x - x) * ease;
      y += (target.current.y - y) * ease;
      z += (target.current.z - z) * (reduced.matches ? 1 : 0.17);
      const artwork = image.querySelector("img");
      const maxX =
        ((artwork?.offsetWidth ?? image.offsetWidth) * (target.current.z - 1)) /
        2;
      const maxY =
        ((artwork?.offsetHeight ?? image.offsetHeight) *
          (target.current.z - 1)) /
        2;
      target.current.panX = Math.max(
        -maxX,
        Math.min(maxX, target.current.panX),
      );
      target.current.panY = Math.max(
        -maxY,
        Math.min(maxY, target.current.panY),
      );
      image.style.transform = `translate(${target.current.panX}px, ${target.current.panY}px) rotateX(${x.toFixed(3)}deg) rotateY(${y.toFixed(3)}deg) scale(${z.toFixed(4)})`;
      if (
        Math.abs(target.current.x - x) > 0.006 ||
        Math.abs(target.current.y - y) > 0.006 ||
        Math.abs(target.current.z - z) > 0.0006
      )
        schedule.current();
    }
    schedule.current = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    function down(e: PointerEvent) {
      dragged.current = false;
      if (
        target.current.z <= 1 ||
        e.button !== 0 ||
        !e.isPrimary ||
        (e.target as HTMLElement).closest("button,input,.hs-zoom-tools")
      )
        return;
      e.preventDefault();
      element.focus({ preventScroll: true });
      drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        panX: target.current.panX,
        panY: target.current.panY,
      };
      element.setPointerCapture(e.pointerId);
      element.dataset.dragging = "true";
    }
    function end(e: PointerEvent) {
      if (drag?.id !== e.pointerId) return;
      drag = null;
      delete element.dataset.dragging;
      if (element.hasPointerCapture(e.pointerId))
        element.releasePointerCapture(e.pointerId);
    }
    function key(e: KeyboardEvent) {
      if (e.target !== element) return;
      if (e.key === "Home") {
        e.preventDefault();
        resetView();
        return;
      }
      const steps: Record<string, [number, number]> = {
        ArrowLeft: [-40, 0],
        ArrowRight: [40, 0],
        ArrowUp: [0, -40],
        ArrowDown: [0, 40],
      };
      const step = steps[e.key];
      if (!step || target.current.z <= 1) return;
      e.preventDefault();
      target.current.panX += step[0];
      target.current.panY += step[1];
      schedule.current();
    }
    function move(e: PointerEvent) {
      if (drag?.id === e.pointerId) {
        const dx = e.clientX - drag.x,
          dy = e.clientY - drag.y;
        if (Math.hypot(dx, dy) > 4) dragged.current = true;
        target.current.panX = drag.panX + dx;
        target.current.panY = drag.panY + dy;
        schedule.current();
        return;
      }
      if (target.current.z > 1) return;
      if (reduced.matches || !["mouse", "pen"].includes(e.pointerType)) return;
      const rect = element.getBoundingClientRect();
      target.current.x =
        -Math.max(
          -0.5,
          Math.min(0.5, (e.clientY - rect.top) / rect.height - 0.5),
        ) * 17;
      target.current.y =
        Math.max(
          -0.5,
          Math.min(0.5, (e.clientX - rect.left) / rect.width - 0.5),
        ) * 19;
      schedule.current();
    }
    function leave() {
      target.current.x = 0;
      target.current.y = 0;
      schedule.current();
    }
    function wheel(e: WheelEvent) {
      if ((e.target as HTMLElement).closest(".hs-zoom-tools")) return;
      e.preventDefault();
      setZoom((z) => Math.min(3, Math.max(1, z - e.deltaY * 0.0025)));
    }
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", end);
    element.addEventListener("lostpointercapture", end);
    element.addEventListener("keydown", key);
    const resize = new ResizeObserver(() => schedule.current());
    resize.observe(element);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", leave);
    element.addEventListener("wheel", wheel, { passive: false });
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      schedule.current = () => {};
      resize.disconnect();
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointerup", end);
      element.removeEventListener("pointercancel", end);
      element.removeEventListener("lostpointercapture", end);
      element.removeEventListener("keydown", key);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", leave);
      element.removeEventListener("wheel", wheel);
    };
  }, []);
  return {
    scene,
    figure,
    zoom,
    setZoom,
    resetView,
    imageFailed,
    setImageFailed,
    dragged,
  };
}

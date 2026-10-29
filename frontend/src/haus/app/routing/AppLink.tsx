import type { ComponentProps } from "react";
import { useLinkClickHandler } from "react-router";

type AppLinkProps = Omit<ComponentProps<"a">, "href"> & {
  to: string;
};

export function AppLink({ to, onClick, target, ...props }: AppLinkProps) {
  const handleClick = useLinkClickHandler<HTMLAnchorElement>(to, { target });

  return (
    <a
      {...props}
      href={`/#${to}`}
      target={target}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;

        // Keep canonical shared URLs and let unknown document paths recover at the root.
        if (window.location.pathname === "/") handleClick(event);
      }}
    />
  );
}

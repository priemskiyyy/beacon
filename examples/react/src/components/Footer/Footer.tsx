import type React from "react";

export const Footer: React.FunctionComponent = () => (
  <footer className="border-t border-zinc-200/70 dark:border-zinc-800">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-8 text-sm text-zinc-500 sm:px-6">
      <span>
        Beacon reads a scripted release service and simulates the reload. Nothing
        leaves your browser, and nothing here installs anything.
      </span>
      <a
        href="https://github.com/priemskiyyy/beacon"
        className="underline-offset-2 hover:underline sm:ml-auto"
      >
        Beacon on GitHub
      </a>
    </div>
  </footer>
);

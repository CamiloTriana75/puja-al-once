import type { ReactNode } from "react";

export function PhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-[2.4rem] bg-white p-2 shadow-[0_40px_70px_-34px_rgba(4,23,38,.6)] ring-1 ring-line ${className}`}>
      <div className="relative aspect-[9/19] overflow-hidden rounded-[1.95rem] bg-canvas">
        <div aria-hidden="true" className="absolute left-1/2 top-2 z-40 h-5 w-20 -translate-x-1/2 rounded-full bg-black/85" />
        {children}
      </div>
    </div>
  );
}

export function LaptopFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="rounded-t-[1.35rem] bg-[#E6EBF2] p-2.5 shadow-[0_50px_80px_-50px_rgba(4,23,38,.55)] ring-1 ring-line">
        <div className="relative aspect-[16/10] overflow-hidden rounded-[0.7rem] bg-canvas">{children}</div>
      </div>
      <div aria-hidden="true" className="relative -mx-[5%] h-3.5 rounded-b-[1.4rem] bg-gradient-to-b from-[#DDE3EC] to-[#C3CCD9]">
        <div className="absolute left-1/2 top-0 h-1.5 w-24 -translate-x-1/2 rounded-b-lg bg-[#B6C0CE]" />
      </div>
    </div>
  );
}

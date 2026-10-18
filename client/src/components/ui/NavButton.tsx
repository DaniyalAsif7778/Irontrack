import type { ReactNode } from "react";

type NavButtonProps = {
  active: boolean;
  icon: ReactNode;
  children: string;
  onClick: () => void;
};

export default function NavButton({ active, icon, children, onClick }: NavButtonProps) {
  return (
    <button type="button" className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={onClick}>
      {icon}<span>{children}</span>
    </button>
  );
}

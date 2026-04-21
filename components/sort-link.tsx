import { ProgressLink } from "@/components/progress-link";

type SortLinkProps = {
  href: string;
  label: string;
  sortKey: string;
  activeSort?: string;
  activeDir?: string;
};

export function SortLink({ href, label, sortKey, activeSort, activeDir }: SortLinkProps) {
  const isActive = activeSort === sortKey;
  const isAsc = isActive && activeDir === "asc";
  const isDesc = isActive && activeDir === "desc";

  return (
    <ProgressLink className={`sort-link ${isActive ? "is-active" : ""}`} href={href}>
      <span>{label}</span>
      <span className="sort-link__icons" aria-hidden="true">
        <span className={`sort-link__icon ${isAsc ? "active" : ""}`}>▲</span>
        <span className={`sort-link__icon ${isDesc ? "active" : ""}`}>▼</span>
      </span>
    </ProgressLink>
  );
}

import { ProgressLink } from "@/components/progress-link";
import { QueryForm } from "@/components/query-form";

type PaginationControlsProps = {
  basePath: string;
  page: number;
  pageSize: number;
  totalItems: number;
  query: Record<string, string | undefined>;
};

const PAGE_SIZE_OPTIONS = [100, 300, 500, 1000];

function buildHref(basePath: string, query: Record<string, string | undefined>) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value && value.length) {
      params.set(key, value);
    }
  });

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function PaginationControls({
  basePath,
  page,
  pageSize,
  totalItems,
  query
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="pagination-bar">
      <div className="pagination-summary">
        Showing {start}-{end} of {totalItems}
      </div>

      <div className="pagination-actions">
        <QueryForm action={basePath} className="pagination-size-form">
          {Object.entries(query).map(([key, value]) => (
            key !== "pageSize" ? <input key={key} name={key} type="hidden" value={value ?? ""} /> : null
          ))}
          <input name="page" type="hidden" value="1" />
          <label className="field compact">
            Per page
            <select defaultValue={String(pageSize)} name="pageSize">
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button className="button-link" type="submit">
            Update
          </button>
        </QueryForm>

        <div className="pagination-nav">
          <ProgressLink
            className={`button-link ${currentPage <= 1 ? "is-disabled" : ""}`}
            href={buildHref(basePath, { ...query, page: String(currentPage - 1), pageSize: String(pageSize) })}
          >
            Previous
          </ProgressLink>
          <span className="pagination-page">
            Page {currentPage} of {totalPages}
          </span>
          <ProgressLink
            className={`button-link ${currentPage >= totalPages ? "is-disabled" : ""}`}
            href={buildHref(basePath, { ...query, page: String(currentPage + 1), pageSize: String(pageSize) })}
          >
            Next
          </ProgressLink>
        </div>
      </div>
    </div>
  );
}

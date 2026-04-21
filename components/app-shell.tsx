import Image from "next/image";
import type { ReactNode } from "react";
import { ProgressLink } from "@/components/progress-link";

type AppShellProps = {
  title: string;
  kicker: string;
  description: string;
  links: Array<{ href: string; label: string }>;
  children: ReactNode;
};

export function AppShell({
  title,
  kicker,
  description,
  links,
  children
}: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <ProgressLink className="site-brand" href="/">
            <div className="site-brand-copy brand-logo-wrap">
              <span className="site-brand-kicker">{kicker}</span>
              <Image
                alt="RebateClub"
                className="site-brand-logo"
                height={72}
                priority
                src="/rebateclub-logo.jpg"
                width={360}
              />
            </div>
          </ProgressLink>

          <nav className="site-nav">
            {links.map((link) => (
              <ProgressLink className="site-nav-link" href={link.href} key={link.href}>
                {link.label}
              </ProgressLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="shell-main">
        <div className="page-shell">
          <section className="page-header">
            <div className="page-header-head">
              <div className="page-title-wrap">
                <span className="page-kicker">{kicker}</span>
                <h1 className="page-title">{title}</h1>
                <p className="page-description">{description}</p>
              </div>
            </div>

            <div className="panel-nav">
              {links.map((link) => (
                <ProgressLink className="nav-chip" href={link.href} key={`chip-${link.href}`}>
                  {link.label}
                </ProgressLink>
              ))}
            </div>
          </section>

          {children}
        </div>
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div>RebateClub © 2026 v2.30.0</div>
          <div className="site-footer-links">
            <ProgressLink href="/">Home</ProgressLink>
            <ProgressLink href="/admin">Dashboard</ProgressLink>
            <ProgressLink href="/portal">Portal</ProgressLink>
          </div>
        </div>
      </footer>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function ExpensesListEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const isExpensesPage = pathname === '/expenses';
    document.body.classList.toggle('expenses-page-active', isExpensesPage);

    if (!isExpensesPage) return;

    let frame = 0;
    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const cards = Array.from(document.querySelectorAll<HTMLElement>('.finance-expense-list .finance-list-card'));

        cards.forEach((card) => {
          card.style.display = '';

          const tags = card.querySelector<HTMLElement>('.finance-tags');
          if (!tags) return;
          const hasJob = Boolean(tags.querySelector('a[href^="/jobs/"]'));
          let badge = card.querySelector<HTMLElement>('.expense-unassigned-badge');

          if (!hasJob) {
            if (!badge) {
              badge = document.createElement('span');
              badge.className = 'expense-unassigned-badge';
              badge.textContent = 'Not linked to a job';
              tags.prepend(badge);
            }
          } else if (badge) {
            badge.remove();
          }
        });
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.body.classList.remove('expenses-page-active');
      document.querySelectorAll<HTMLElement>('.finance-expense-list .finance-list-card').forEach((card) => {
        card.style.display = '';
      });
    };
  }, [pathname]);

  return (
    <style jsx global>{`
      .expense-unassigned-badge {
        display: inline-flex;
        align-items: center;
        min-height: 28px;
        padding: 4px 9px;
        margin-right: 8px;
        border: 1px solid rgba(158, 83, 58, 0.28);
        border-radius: 999px;
        background: rgba(255, 249, 246, 0.96);
        color: #7a4937;
        font-weight: 700;
      }

      .expenses-page-active .app-page-content > .page-header,
      .expenses-page-active .app-page-content > .page-header-wrap {
        margin-top: 20px !important;
      }

      @media (max-width: 640px) {
        .expenses-page-active .app-page-content > .page-header,
        .expenses-page-active .app-page-content > .page-header-wrap {
          margin-top: 24px !important;
        }
      }
    `}</style>
  );
}

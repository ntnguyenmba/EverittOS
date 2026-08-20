'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const PAGE_SIZE = 10;

export function ExpensesListEnhancer() {
  const pathname = usePathname();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (pathname !== '/expenses') return;
    setVisibleCount(PAGE_SIZE);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/expenses') return;

    let frame = 0;
    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const cards = Array.from(document.querySelectorAll<HTMLElement>('.finance-expense-list .finance-list-card'));
        setTotalCount(cards.length);

        cards.forEach((card, index) => {
          card.style.display = index < visibleCount ? '' : 'none';

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
      document.querySelectorAll<HTMLElement>('.finance-expense-list .finance-list-card').forEach((card) => {
        card.style.display = '';
      });
    };
  }, [pathname, visibleCount]);

  if (pathname !== '/expenses' || totalCount <= PAGE_SIZE) return null;

  return (
    <>
      <div className="expenses-list-more-control">
        <span>Showing {Math.min(visibleCount, totalCount)} / {totalCount}</span>
        {visibleCount < totalCount ? (
          <button type="button" className="btn" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
            Show 10 more
          </button>
        ) : null}
      </div>
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
        .expenses-list-more-control {
          display: grid;
          gap: 8px;
          margin-top: 14px;
          color: #66727c;
        }
        .expenses-list-more-control .btn {
          width: 100%;
          min-height: 48px;
        }
        @media (min-width: 721px) {
          .expenses-list-more-control .btn {
            width: fit-content;
          }
        }
      `}</style>
    </>
  );
}

import { normalizeLocale, type Locale } from '@/lib/i18n/config';

export type ExpensesPageCopy = {
  title: string;
  subtitle: string;
  gateTitle: string;
  gateBody: string;
  upgrade: string;
  addExpense: string;
  close: string;
  filters: string;
  hideFilters: string;
  total: string;
};

const byLocale: Record<Locale, ExpensesPageCopy> = {
  en: {
    title: 'Expenses',
    subtitle: 'Track fuel, supplies, materials, and other costs. Link expenses to jobs for profit estimates.',
    gateTitle: 'Expenses and job profit',
    gateBody:
      '{plan} and above unlock expense tracking, job profitability, and business performance reports.',
    upgrade: 'Upgrade to {plan}',
    addExpense: 'Add expense',
    close: 'Close',
    filters: 'Filters',
    hideFilters: 'Hide filters',
    total: 'Total'
  },
  es: {
    title: 'Gastos',
    subtitle:
      'Registre combustible, suministros, materiales y otros costos. Vincule gastos a trabajos para estimar la ganancia.',
    gateTitle: 'Gastos y ganancia por trabajo',
    gateBody:
      '{plan} y superiores desbloquean el seguimiento de gastos, la rentabilidad por trabajo y los informes de desempeño.',
    upgrade: 'Mejorar a {plan}',
    addExpense: 'Agregar gasto',
    close: 'Cerrar',
    filters: 'Filtros',
    hideFilters: 'Ocultar filtros',
    total: 'Total'
  },
  vi: {
    title: 'Chi phí',
    subtitle:
      'Theo dõi nhiên liệu, vật tư, nguyên liệu và chi phí khác. Liên kết chi phí với công việc để ước tính lợi nhuận.',
    gateTitle: 'Chi phí và lợi nhuận theo công việc',
    gateBody:
      '{plan} trở lên mở khóa theo dõi chi phí, lợi nhuận theo công việc và báo cáo hiệu suất kinh doanh.',
    upgrade: 'Nâng cấp lên {plan}',
    addExpense: 'Thêm chi phí',
    close: 'Đóng',
    filters: 'Bộ lọc',
    hideFilters: 'Ẩn bộ lọc',
    total: 'Tổng'
  }
};

export function getExpensesPageCopy(locale?: string | null): ExpensesPageCopy {
  return byLocale[normalizeLocale(locale)];
}

export function formatExpensesCopy(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
    template
  );
}

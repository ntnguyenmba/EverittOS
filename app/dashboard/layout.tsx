import styles from './dashboard-refresh.module.css';

export default function Layout(props: { children: React.ReactNode }) {
  return <div className={styles.dashboardRefresh}>{props.children}</div>;
}

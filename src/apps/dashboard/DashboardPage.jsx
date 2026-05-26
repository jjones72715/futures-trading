import AppCard from './AppCard.jsx';
import { APPS } from './appsConfig.js';

export default function DashboardPage() {
  return (
    <div style={{
      background: '#050816',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <h1 style={{ color: 'white', fontWeight: 'bold', fontSize: '2rem', marginBottom: '0.5rem' }}>
        My Apps
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1rem', marginBottom: '3rem' }}>
        Select an app to get started
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '1.5rem',
        width: '100%',
        maxWidth: '640px',
      }}>
        {APPS.map(app => (
          <AppCard
            key={app.id}
            label={app.label}
            route={app.route}
            accent={app.accent}
            icon={app.icon}
            disabled={app.disabled}
          />
        ))}
      </div>
    </div>
  );
}

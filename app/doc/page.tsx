'use client';

import dynamic from 'next/dynamic';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => <p style={{ padding: '2rem' }}>Chargement de la documentation…</p>,
});

import 'swagger-ui-react/swagger-ui.css';

const ApiDoc = () => {
  return <SwaggerUI url="/swagger.json" />;
};

export default ApiDoc;

import React, { useEffect, useState } from 'react';

const App: React.FC = () => {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    window.electronAPI?.getVersion().then(setVersion).catch(console.error);
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-void-bg text-void-text">
      <div className="text-center">
        <h1 className="text-4xl font-light tracking-widest text-void-accent mb-2">
          VOID
        </h1>
        <p className="text-void-secondary text-sm">AI Assistant</p>
        {version && (
          <p className="text-void-border text-xs mt-4">v{version}</p>
        )}
      </div>
    </div>
  );
};

export default App;

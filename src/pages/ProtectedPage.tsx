import { useEffect, useState } from 'react';
import EmbedBox from '../components/EmbedBox';

interface ProjectConfig {
  id: string;
  name: string;
  icon: string;
  url: string;
  domain: string;
  entryPath: string;
  port: number;
}

export default function ProtectedPage({ project }: { project: ProjectConfig }) {
  const [loaded, setLoaded] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth-token')
      .then(r => r.json())
      .then(({ token }) => {
        if (token) {
          setSrc(`/internal/router-auth?t=${token}&redirect=${project.entryPath}`);
        } else {
          setSrc(`${project.url}${project.entryPath}`);
        }
      })
      .catch(() => setSrc(`${project.url}${project.entryPath}`));
  }, [project]);

  return (
    <EmbedBox label={`Memuat ${project.name}`} loaded={loaded}>
      {src && <iframe src={src} title={project.name} onLoad={() => setLoaded(true)} />}
    </EmbedBox>
  );
}

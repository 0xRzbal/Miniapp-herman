import { useRef, useState } from 'react';
import EmbedBox from '../components/EmbedBox';

export default function MailPage() {
  const [loading, setLoading] = useState(true);
  const mailSrc = useRef(`/mail/?_=${Date.now()}`).current;

  return (
    <EmbedBox label="Memuat JoeMail" loaded={!loading}>
      <iframe src={mailSrc} title="JoeMail" onLoad={() => setLoading(false)} />
    </EmbedBox>
  );
}

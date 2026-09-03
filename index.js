import { getCurrentUser } from '../lib/auth';

export async function getServerSideProps(ctx) {
  const user = await getCurrentUser(ctx.req);
  return {
    redirect: {
      destination: user ? '/dashboard' : '/login',
      permanent: false
    }
  };
}

export default function Home() {
  return null;
}

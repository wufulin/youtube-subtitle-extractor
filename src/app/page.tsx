import { HomeTabProvider } from '@/components/home-tab-context';
import { HomeMain } from '@/components/home-main';

export default function Home() {
  return (
    <HomeTabProvider>
      <HomeMain />
    </HomeTabProvider>
  );
}

import { PropsWithChildren, useEffect } from 'react';
import { useUserStore } from '@/stores/user';
import { LucideTaroProvider } from 'lucide-react-taro';
import '@/app.css';
import { Toaster } from '@/components/ui/toast';

const App = ({ children }: PropsWithChildren) => {
  const loadUserFromStorage = useUserStore(state => state.loadUserFromStorage);

  // 应用启动时加载本地存储的用户信息
  useEffect(() => {
    loadUserFromStorage();
  }, []);

  return (
    <LucideTaroProvider defaultColor="#000" defaultSize={24}>
      {children}
      <Toaster />
    </LucideTaroProvider>
  );
};

export default App;

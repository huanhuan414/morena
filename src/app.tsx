import { PropsWithChildren, useEffect, Component } from 'react';
import Taro from '@tarojs/taro';
import { useUserStore } from '@/stores/user';
import { LucideTaroProvider } from 'lucide-react-taro';
import '@/app.css';

// 全局错误捕获 - 确保模块加载错误能被看到
const originalConsoleError = console.error;
console.error = (...args) => {
  originalConsoleError(...args);
  try {
    const errLog = Taro.getStorageSync('__error_log') || '';
    const msg = args.map(a => {
      try {
        return typeof a === 'string' ? a : JSON.stringify(a);
      } catch {
        return String(a);
      }
    }).join(' ');
    Taro.setStorageSync('__error_log', errLog + '\n' + new Date().toISOString() + ' ' + msg.slice(0, 500));
  } catch (e) { /* ignore */ }
};

class App extends Component<PropsWithChildren> {
  // Taro App 生命周期 - 捕获全局错误
  onError(err: string) {
    console.error('[App.onError] 全局错误:', err);
    try {
      Taro.showToast({ title: 'App错误: ' + err.slice(0, 30), icon: 'none', duration: 5000 });
    } catch (e) { /* ignore */ }
  }

  onLaunch() {
    // 捕获未处理的 Promise 拒绝
    // @ts-ignore
    if (typeof wx !== 'undefined' && wx.onUnhandledRejection) {
      // @ts-ignore
      wx.onUnhandledRejection((res: any) => {
        console.error('[App] 未处理的 Promise 拒绝:', res.reason);
      });
    }
  }

  render() {
    return (
      <AppInner>{this.props.children}</AppInner>
    );
  }
}

// 内部组件 - 处理 hooks 逻辑
const AppInner = ({ children }: PropsWithChildren) => {
  const loadUserFromStorage = useUserStore(state => state.loadUserFromStorage);

  useEffect(() => {
    try {
      loadUserFromStorage();
    } catch (e) {
      console.error('[App] loadUserFromStorage 失败:', e);
    }
  }, []);

  return (
    <LucideTaroProvider defaultColor="#000" defaultSize={24}>
      {children}
    </LucideTaroProvider>
  );
};

export default App;

import { useEffect } from 'react';
import Taro from '@tarojs/taro';

/**
 * 首页入口，直接重定向到 TabBar 第一个页面（分身）
 */
const IndexPage = () => {
  useEffect(() => {
    Taro.switchTab({ url: '/pages/avatar-profile/index' }).catch(() => {
      // 如果 switchTab 失败，尝试 redirectTo
      Taro.redirectTo({ url: '/pages/avatar-profile/index' });
    });
  }, []);

  return null;
};

export default IndexPage;
